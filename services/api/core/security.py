from datetime import datetime, timedelta
from typing import Optional
import bcrypt as _bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from .config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user_role(token: str = Depends(oauth2_scheme)) -> str:
    payload = decode_token(token)
    return payload.get("role", "reporter")


async def require_reviewer(role: str = Depends(get_current_user_role)):
    if role not in ("reviewer", "admin"):
        raise HTTPException(status_code=403, detail="Reviewer access required")
    return role


async def require_admin(role: str = Depends(get_current_user_role)):
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return role
