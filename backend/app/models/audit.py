from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.models.base import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String, index=True) # e.g. 'Session', 'DeviceRequest'
    entity_id = Column(String, index=True)
    action = Column(String, index=True)      # e.g. 'CREATE', 'APPROVE'
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Admin/system that did it
    metadata_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
