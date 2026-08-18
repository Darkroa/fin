"""Encryption helpers for MT5 broker credentials.

MT5 passwords are only needed by the server-side bridge.  They must never be
stored as plaintext in the user's JSON connection record or sent to the
browser.
"""

import os

from cryptography.fernet import Fernet, InvalidToken


class MT5CredentialError(RuntimeError):
    """Raised when MT5 credential encryption is not safely configured."""


def _fernet() -> Fernet:
    key = os.getenv("MT5_CREDENTIAL_ENCRYPTION_KEY", "").strip()
    if not key:
        raise MT5CredentialError(
            "MT5 credential encryption is not configured. "
            "Set MT5_CREDENTIAL_ENCRYPTION_KEY before saving broker accounts."
        )
    try:
        return Fernet(key.encode("utf-8"))
    except (ValueError, TypeError) as exc:
        raise MT5CredentialError(
            "MT5_CREDENTIAL_ENCRYPTION_KEY is invalid. "
            "Generate a Fernet key and keep it in the server secret store."
        ) from exc


def encrypt_mt5_password(password: str) -> str:
    if not password:
        raise MT5CredentialError("MT5 trading password cannot be empty")
    return _fernet().encrypt(password.encode("utf-8")).decode("utf-8")


def decrypt_mt5_password(connection: dict) -> str:
    """Decrypt a stored password, rejecting legacy plaintext records.

    Existing plaintext records are deliberately not sent to the bridge.  The
    user must reconnect that account after encryption is configured.
    """
    if not connection.get("api_secret_encrypted"):
        raise MT5CredentialError(
            "This MT5 connection uses legacy credential storage. "
            "Reconnect it after MT5 credential encryption is configured."
        )
    ciphertext = connection.get("api_secret")
    if not ciphertext:
        raise MT5CredentialError("MT5 trading password is missing")
    try:
        return _fernet().decrypt(str(ciphertext).encode("utf-8")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError) as exc:
        raise MT5CredentialError(
            "The stored MT5 trading password cannot be decrypted. Reconnect the account."
        ) from exc