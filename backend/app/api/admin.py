from fastapi import APIRouter, HTTPException, status, Response, Request
from sqlalchemy import select, update
from typing import List
from datetime import timedelta

from app.api.deps import DbSession, CurrentAdmin
from app.models.session import Session
from app.models.attendance import AttendanceRecord
from app.models.device_change import DeviceChangeRequest
from app.schemas.api import SessionCreate, SessionResponse
from app.models.audit import AuditLog

router = APIRouter()

@router.post("/session/create", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(req: SessionCreate, admin: CurrentAdmin, db: DbSession):
    end_time = req.start_time + timedelta(minutes=req.duration_minutes)
    
    new_session = Session(
        course_id=req.course_id,
        instructor_id=admin.id,
        start_time=req.start_time,
        end_time=end_time,
        qr_refresh_seconds=req.qr_refresh_seconds,
        is_active=False
    )
    db.add(new_session)
    await db.flush() # get id

    audit = AuditLog(entity_type="Session", entity_id=str(new_session.id), action="CREATE", actor_id=admin.id)
    db.add(audit)
    await db.commit()
    await db.refresh(new_session)
    return new_session

@router.post("/session/{session_id}/start")
async def start_session(session_id: int, admin: CurrentAdmin, db: DbSession):
    stmt = select(Session).where(Session.id == session_id, Session.instructor_id == admin.id)
    result = await db.execute(stmt)
    sess = result.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
        
    sess.is_active = True
    audit = AuditLog(entity_type="Session", entity_id=str(sess.id), action="START", actor_id=admin.id)
    db.add(audit)
    await db.commit()
    return {"msg": "Session started"}

@router.post("/session/{session_id}/end")
async def end_session(session_id: int, admin: CurrentAdmin, db: DbSession):
    stmt = select(Session).where(Session.id == session_id, Session.instructor_id == admin.id)
    result = await db.execute(stmt)
    sess = result.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
        
    sess.is_active = False
    audit = AuditLog(entity_type="Session", entity_id=str(sess.id), action="END", actor_id=admin.id)
    db.add(audit)
    await db.commit()
    return {"msg": "Session ended"}

@router.get("/session/{session_id}/attendance")
async def get_attendance(session_id: int, admin: CurrentAdmin, db: DbSession):
    from app.models.user import User
    stmt = select(AttendanceRecord, User).join(User, AttendanceRecord.user_id == User.id).where(AttendanceRecord.session_id == session_id)
    result = await db.execute(stmt)
    records = result.all()
    
    response = []
    for att, user in records:
        response.append({
            "id": att.id,
            "user_id": att.user_id,
            "marked_at": att.marked_at,
            "suspicion_score": att.suspicion_score,
            "user_name": user.name,
            "roll_number": user.roll_number
        })
    return response

@router.get("/device_change_requests")
async def get_device_change_requests(admin: CurrentAdmin, db: DbSession):
    stmt = select(DeviceChangeRequest).where(DeviceChangeRequest.status == "pending")
    result = await db.execute(stmt)
    return result.scalars().all()
