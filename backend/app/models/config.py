from sqlalchemy import Column, String, Boolean, Float, Integer
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import Base

class CourseConfig(Base):
    __tablename__ = "course_configs"
    
    course_id = Column(String, primary_key=True, index=True)
    require_geo = Column(Boolean, default=False)
    require_wifi = Column(Boolean, default=False)
    require_selfie = Column(Boolean, default=False)
    allowed_ip_ranges = Column(JSONB, nullable=True) # list of CIDRs
    geo_center_lat = Column(Float, nullable=True)
    geo_center_lng = Column(Float, nullable=True)
    geo_radius_meters = Column(Integer, default=50)
