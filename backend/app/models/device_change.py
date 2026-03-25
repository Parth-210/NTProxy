from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.models.base import Base

class DeviceChangeRequest(Base):
    __tablename__ = "device_change_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    old_device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    new_fingerprint_hash = Column(String, nullable=False)
    new_device_info = Column(Text, nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String, default="pending") # pending, approved, rejected
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
