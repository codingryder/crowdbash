import jwt
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
import uuid
from datetime import datetime, timedelta, timezone

bearer = HTTPBearer(auto_error=False)


def create_jwt(user_id: str) -> str:
    """Create a JWT token for an authenticated user."""
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def verify_jwt(token: str) -> dict:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> uuid.UUID:
    """FastAPI dependency: extract user_id from JWT token."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_jwt(credentials.credentials)
    return uuid.UUID(payload["sub"])


def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> uuid.UUID | None:
    """FastAPI dependency: optionally extract user_id (returns None if not authenticated)."""
    if not credentials:
        return None
    try:
        payload = verify_jwt(credentials.credentials)
        return uuid.UUID(payload["sub"])
    except Exception:
        return None
