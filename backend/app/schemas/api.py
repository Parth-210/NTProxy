from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class SessionCreate(BaseModel):
    course_id: str
    start_time: datetime
    duration_minutes: int
    qr_refresh_seconds: int = 5

class SessionResponse(BaseModel):
    id: int
    course_id: str
    start_time: datetime
    end_time: datetime
    is_active: bool
    qr_refresh_seconds: int

    class Config:
        from_attributes = True

class AttendanceMarkRequest(BaseModel):
    session_id: int
    token: str
    device_fingerprint: str
    device_info: Optional[str] = None
    geo_lat: Optional[float] = None
    geo_lng: Optional[float] = None
    selfie_base64: Optional[str] = None

class AttendanceResponse(BaseModel):
    id: int
    user_id: int
    marked_at: datetime
    suspicion_score: float

    class Config:
        from_attributes = True
