from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Attendance Tracking System"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://admin:admin123@localhost:5432/attendance_db"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # App Settings
    FRONTEND_URL: str = "http://localhost:3000"
    
    # Security
    SECRET_KEY: str = "supersecretkey_please_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # QR Settings
    QR_SECRET_KEY: str = "qr_super_secret_rotate_me"
    QR_REFRESH_SECONDS: int = 5
    QR_SLOT_TOLERANCE: int = 1  # Allow +/- 1 slot

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
