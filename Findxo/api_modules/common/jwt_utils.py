import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt

SECRET = os.getenv("API_JWT_SECRET", "change-this-secret")
ALG = "HS256"

def create_access_token(sub: str, minutes: int = 30) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=minutes)
    payload = {"sub": sub, "iat": int(now.timestamp()), "exp": int(exp.timestamp())}
    return jwt.encode(payload, SECRET, algorithm=ALG)

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALG])
    except Exception:
        return None
