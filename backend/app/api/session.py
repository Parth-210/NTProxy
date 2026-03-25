from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
import time

from app.api.deps import DbSession, CurrentAdmin
from app.models.session import Session
from app.core.security import generate_qr_token
from app.core.config import settings

router = APIRouter()

@router.get("/{session_id}/qr_token")
async def get_qr_token(session_id: int, admin: CurrentAdmin, db: DbSession):
    stmt = select(Session).where(Session.id == session_id, Session.instructor_id == admin.id)
    result = await db.execute(stmt)
    sess = result.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not sess.is_active:
        raise HTTPException(status_code=400, detail="Session is not active")

    current_unix_time = int(time.time())
    time_slot = current_unix_time // sess.qr_refresh_seconds
    
    token = generate_qr_token(session_id, time_slot)
    
    return {
        "session_id": session_id,
        "token": token,
        "time_slot": time_slot,
        "expires_in": sess.qr_refresh_seconds - (current_unix_time % sess.qr_refresh_seconds)
    }
