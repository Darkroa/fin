from fastapi import Depends, HTTPException, status, Cookie, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import Response
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

from src.database.session import SessionLocal
from src.database.models import User

# ===================== Configuration =====================
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "").strip()
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY environment variable is not set. Add it to Replit Secrets.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# auto_error=False so we can fall through to cookie auth when no header is present.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def create_access_token(data: dict, token_version: int = 0) -> str:
    """Create JWT access token. Embeds token_version so the user's session
    can be invalidated by bumping token_version (e.g. on password change,
    admin demotion, or logout-all)."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "tv": token_version})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(
    request: Request,
    bearer_token: str | None = Depends(oauth2_scheme),
    finai_access: str | None = Cookie(default=None),
):
    """Decode JWT from the Authorization header OR the finai_access httpOnly
    cookie. The cookie path is used by the browser SPA so the JWT never has
    to live in localStorage; the header path is used by mobile + API clients.

    Resolution order:
      1. Authorization: Bearer <token>   (preferred for mobile/scripts)
      2. OAuth2 bearer in Authorization (auto-extracted by oauth2_scheme)
      3. finai_access cookie              (preferred for browsers)
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token: str | None = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    elif bearer_token:
        token = bearer_token
    elif finai_access:
        token = finai_access

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_tv: int = int(payload.get("tv", 0))
    except (JWTError, ValueError):
        raise credentials_exception

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise credentials_exception
        if (user.token_version or 0) != token_tv:
            raise credentials_exception
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user",
            )
        if user.is_banned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is banned",
            )
    finally:
        db.close()

    return {
        "id": user.id,
        "email": user.email,
        "is_admin": user.is_admin,
        "is_active": user.is_active,
        "full_name": user.full_name,
    }


async def get_current_active_user(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_active"):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def set_access_cookie(response: Response, token: str, max_age_days: int = ACCESS_TOKEN_EXPIRE_DAYS) -> None:
    """Attach the JWT as an httpOnly Secure SameSite=Lax cookie. The browser
    SPA should never persist the JWT to localStorage — relying on this cookie
    means an XSS page cannot exfiltrate the token."""
    response.set_cookie(
        key="finai_access",
        value=token,
        max_age=max_age_days * 24 * 3600,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def clear_access_cookie(response: Response) -> None:
    response.delete_cookie("finai_access", path="/")
