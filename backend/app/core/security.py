import jwt
from datetime import datetime, timedelta, timezone
import base64
import hmac
import hashlib
from passlib.context import CryptContext
from typing import Optional

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(subject: str | int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "role": role}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(subject: str | int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        return None

def generate_qr_token(session_id: int, time_slot: int) -> str:
    # HMAC-SHA256: secret, "{session_id}|{time_slot}"
    message = f"{session_id}|{time_slot}".encode('utf-8')
    secret = settings.QR_SECRET_KEY.encode('utf-8')
    signature = hmac.new(secret, message, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(signature).decode('utf-8').rstrip('=')

def verify_qr_token(session_id: int, token: str, current_time_slot: int) -> bool:
    # Allow current slot, previous slot, and next slot for network jitter
    allowed_slots = [current_time_slot, current_time_slot - 1, current_time_slot + 1]
    
    # Pad base64url if needed
    padded_token = token + "=" * ((4 - len(token) % 4) % 4)
    
    for slot in allowed_slots:
        expected = generate_qr_token(session_id, slot)
        # We need to compare ignoring padding issues if any, but since we use urlsafe_b64encode and rstrip
        if hmac.compare_digest(token, expected):
            return True
    return False
