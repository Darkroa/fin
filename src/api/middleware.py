from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime
from collections import defaultdict
import time
from loguru import logger

from src.database.session import SessionLocal
from src.database.models import APIKey


# Separate stores so per-IP and per-key limits don't share buckets.
_ip_store: dict = defaultdict(list)
_key_store: dict = defaultdict(list)


def _is_jwt(token: str) -> bool:
    """JWTs have 3 base64 segments separated by dots and start with eyJ."""
    parts = token.split(".")
    return len(parts) == 3 and token.startswith("eyJ")


def _check_and_record_ip(ip: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    cutoff = now - window_seconds
    bucket = _ip_store[ip]
    bucket[:] = [t for t in bucket if t > cutoff]
    if len(bucket) >= limit:
        logger.warning(f"IP rate limit exceeded: {ip}")
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Try again shortly.",
        )
    bucket.append(now)


def _check_and_record_key(token: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    cutoff = now - window_seconds
    bucket = _key_store[token]
    bucket[:] = [t for t in bucket if t > cutoff]
    if len(bucket) >= limit:
        logger.warning(f"API key rate limit exceeded: {token[:8]}...")
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 60 requests per minute per API key.",
        )
    bucket.append(now)


class APIRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        # Only docs/metrics/health are exempt — everything else is rate-limited.
        if path.startswith((
            "/api/docs", "/api/redoc", "/api/openapi",
            "/metrics", "/health",
        )):
            return await call_next(request)

        # Per-IP rate limit applies to ALL requests (including unauthenticated).
        client_ip = request.client.host if request.client else "unknown"
        _check_and_record_ip(client_ip, limit=120, window_seconds=60)

        authorization = request.headers.get("Authorization")
        api_key_token: str | None = None
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ")[1].strip()
            # Public API keys: extra per-key limit. JWT session tokens: IP limit only.
            if not _is_jwt(token):
                _check_and_record_key(token, limit=60, window_seconds=60)
                api_key_token = token

        start_time = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000

        # Update last_used_at for public API keys
        if api_key_token:
            try:
                db = SessionLocal()
                key_record = db.query(APIKey).filter(APIKey.api_key == api_key_token).first()
                if key_record:
                    key_record.last_used_at = datetime.utcnow()
                    db.commit()
            except Exception as e:
                logger.error(f"Failed to update API key last_used: {e}")
            finally:
                try:
                    db.close()
                except Exception:
                    pass

        return response
