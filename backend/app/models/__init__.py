# Expose models for Alembic
from app.models.base import Base
from app.models.user import User
from app.models.device import Device
from app.models.session import Session
from app.models.attendance import AttendanceRecord
from app.models.audit import AuditLog
from app.models.device_change import DeviceChangeRequest
from app.models.config import CourseConfig
