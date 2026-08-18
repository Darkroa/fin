    # --- sanitize and prepare MT5 inputs (existing code area) ---
    account_number = (data.account_number or data.api_key).strip()
    # Server names are case-sensitive at the broker boundary. Only remove
    # copied surrounding/non-breaking whitespace; never rewrite the name.
    server = re.sub(r"^[\s\u00a0]+|[\s\u00a0]+$", "", (data.server or data.passphrase or ""))
    password = (data.api_secret or "").strip()
    if not account_number or not server or not password:
        raise HTTPException(
            status_code=400,
            detail="MT5 requires account number, broker server, and trading password",
        )
    if not account_number.isdigit():
        raise HTTPException(status_code=400, detail="MT5 account number must contain digits only")
    label = data.label or data.broker or f"MT5 {account_number}"
    platform = (data.mt5_platform or "MT5").strip().upper()
    if platform not in {"MT4", "MT5"}:
        raise HTTPException(status_code=400, detail="Platform must be MT4 or MT5")

    # --- extra sanity: demo flag vs server name mismatch (helps many false positives) ---
    if data.is_demo:
        # simple heuristic: prevent connecting a demo flag to a server whose name includes 'real'
        if "real" in server.lower():
            raise HTTPException(
                status_code=400,
                detail="Server name looks like a REAL server while Demo is selected. Use your broker's demo server name (e.g., 'FBS-Demo') or uncheck Demo."
            )

    # MetaApi creates and verifies the cloud terminal. The broker password
    # is sent only to MetaApi during provisioning and is never persisted.
    try:
        metaapi_account = await metaapi_verify_account(
            login=account_number,
            password=password,
            server=server,
            platform=platform,
            name=label,
        )
    except MetaApiProviderError as exc:
        # Classify common provider responses so the UI shows actionable advice.
        prov_msg = str(exc).lower()
        # provider-specific hints
        if "top up" in prov_msg or "allow high reliability" in prov_msg or "minimum" in prov_msg:
            user_message = (
                "Broker/provisioning rejected the account. The broker indicates the account "
                "may require funding, activation, or a different account type to allow cloud "
                "provisioning. Check your broker dashboard (balance/activation) or try a demo "
                "account and then retry."
            )
        elif "authentication" in prov_msg or "invalid" in prov_msg or "failed to authenticate" in prov_msg:
            user_message = (
                "Authentication to the broker failed. Verify the exact account number, trading "
                "password, and server name (copy/paste the server from your broker's server list)."
            )
        else:
            user_message = (
                f"MetaApi could not verify this {platform} account. "
                f"MetaApi received login ending in {account_number[-2:]}, "
                f"server '{server}', platform '{platform}'. "
                f"Provider response: {exc}"
            )

        # Log the raw provider response for admin debugging (already sanitized in metaapi_provider).
        logger.warning("MetaApi provisioning failed for label=%s login=%s server=%s : %s",
                       label, account_number[-4:], server, prov_msg)
        raise HTTPException(status_code=502, detail=user_message) from exc
