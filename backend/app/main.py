from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: connect to DB/Redis, etc.
    yield
    # Shutdown: cleanup

app = FastAPI(
    title="Attendance System API",
    description="API for tracking student attendance securely",
    version="1.0.0",
    lifespan=lifespan
)

from app.api import auth, admin, session, attendance

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(session.router, prefix="/api/v1/session", tags=["Session"])
app.include_router(attendance.router, prefix="/api/v1/attendance", tags=["Attendance"])
