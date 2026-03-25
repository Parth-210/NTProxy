from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.models.base import Base

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    fingerprint_hash = Column(String, nullable=False, index=True)
    device_model = Column(String)
    os = Column(String)
    browser = Column(String)
    registration_ip = Column(String)
    registered_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    last_seen_at = Column(DateTime(timezone=True), onupdate=func.now())
