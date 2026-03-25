from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.models.base import Base

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)
    marked_at = Column(DateTime(timezone=True), server_default=func.now())
    ip = Column(String)
    geo_lat = Column(Float, nullable=True)
    geo_lng = Column(Float, nullable=True)
    selfie_path = Column(String, nullable=True)
    token_slot = Column(Integer, nullable=False) # Which time_slot they used to mark
    suspicion_score = Column(Float, default=0.0)
    metadata_json = Column(JSONB, nullable=True)
    
    # Enforce one mark per user per session at db level
    __table_args__ = (
        UniqueConstraint('session_id', 'user_id', name='uix_session_user'),
    )
