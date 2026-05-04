from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime, timedelta
from collections import defaultdict
import time
from loguru import logger

from src.database.session import SessionLocal
from src.database.models import APIKey


# In-memory rate limit store: api_key -> list of timestamps
rate_limit_store = defaultdict(list)


class APIRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for public/auth/docs routes
        if request.url.path.startswith((
            "/api/auth/", 
            "/api/docs", 
            "/api/redoc", 
            "/api/openapi",
            "/metrics",
            "/health"
        )):
            return await call_next(request)

        # Extract API key from Authorization header
        authorization = request.headers.get("Authorization")
        if not authorization or not authorization.startswith("Bearer "):
            # Allow requests without API key (they will be handled by route-level auth)
            return await call_next(request)

        api_key = authorization.split(" ")[1].strip()

        # Rate limiting: 10 requests per minute per API key
        now = datetime.utcnow()
        minute_ago = now - timedelta(minutes=1)

        # Clean old timestamps
        rate_limit_store[api_key] = [
            ts for ts in rate_limit_store[api_key] if ts > minute_ago
        ]

        if len(rate_limit_store[api_key]) >= 10:
            logger.warning(f"Rate limit exceeded for API key: {api_key[:8]}...")
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Maximum 10 requests per minute per API key."
            )

        # Record this request timestamp
        rate_limit_store[api_key].append(now)

        # Process the request
        start_time = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000

        # Log usage
        try:
            db = SessionLocal()
            key_record = db.query(APIKey).filter(APIKey.api_key == api_key).first()
            if key_record:
                from datetime import datetime as dt
                key_record.last_used_at = dt.utcnow()
                db.commit()
        except Exception as e:
            logger.error(f"Failed to update API key last_used: {e}")
        finally:
            try:
                db.close()
            except Exception:
                pass

        return response
