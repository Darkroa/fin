from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
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
ACCESS_TOKEN_EXPIRE_DAYS = 7   # You can make this configurable

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def create_access_token(data: dict, token_version: int = 0) -> str:
    """Create JWT access token. Embeds token_version so the user's session
    can be invalidated by bumping token_version (e.g. on password change,
    admin demotion, or logout-all)."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "tv": token_version})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Decode JWT and return basic user info"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_tv: int = int(payload.get("tv", 0))
    except (JWTError, ValueError):
        raise credentials_exception

    # Fetch full user from database for better security & validation
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise credentials_exception
        # Token revocation: if the user's token_version has been bumped
        # since this JWT was issued, treat it as expired.
        if (user.token_version or 0) != token_tv:
            raise credentials_exception
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        if user.is_banned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is banned"
            )
    finally:
        db.close()

    # Return full user object (or dict) - better than just email
    return {
        "id": user.id,
        "email": user.email,
        "is_admin": user.is_admin,
        "is_active": user.is_active,
        "full_name": user.full_name,
    }


# Optional: Get current active user (can be used as dependency)
async def get_current_active_user(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_active"):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
