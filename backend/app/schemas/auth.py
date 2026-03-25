from pydantic import BaseModel, EmailStr
from typing import Optional

class UserCreate(BaseModel):
    name: str
    roll_number: Optional[str] = None
    email: EmailStr
    password: str
    device_fingerprint: str
    device_model: Optional[str] = None
    os: Optional[str] = None
    browser: Optional[str] = None

class UserRead(BaseModel):
    id: int
    name: str
    roll_number: Optional[str]
    email: EmailStr
    role: str

    class Config:
        from_attributes = True

class DeviceChangeRequestCreate(BaseModel):
    new_fingerprint: str
    new_device_info: str
    reason: str

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
