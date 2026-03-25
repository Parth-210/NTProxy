from fastapi import APIRouter, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
import time

from app.api.deps import DbSession, CurrentUser
from app.models.session import Session
from app.models.attendance import AttendanceRecord
from app.models.device import Device
from app.schemas.api import AttendanceMarkRequest, AttendanceResponse
from app.core.security import verify_qr_token

router = APIRouter()

@router.post("/mark", response_model=AttendanceResponse)
async def mark_attendance(req: AttendanceMarkRequest, user: CurrentUser, request: Request, db: DbSession):
    # 1. Fetch Session
    stmt = select(Session).where(Session.id == req.session_id)
    result = await db.execute(stmt)
    sess = result.scalar_one_or_none()
    
    if not sess or not sess.is_active:
        raise HTTPException(status_code=400, detail="Session not active or invalid")

    # 2. Token Verify
    current_unix_time = int(time.time())
    current_slot = current_unix_time // sess.qr_refresh_seconds
    
    if not verify_qr_token(req.session_id, req.token, current_slot):
        raise HTTPException(status_code=400, detail="Invalid or expired QR token")

    # 3. Device Check & Suspicion Scoring
    stmt_dev = select(Device).where(Device.user_id == user.id, Device.is_active == True)
    result_dev = await db.execute(stmt_dev)
    active_device = result_dev.scalar_one_or_none()

    suspicion_score = 0.0
    
    if not active_device or active_device.fingerprint_hash != req.device_fingerprint:
        # High suspicion, device mismatch
        suspicion_score += 50.0

    client_ip = request.client.host if request.client else None
    
    # Example logic for IP checking (mocked configuration)
    # if require_wifi and client_ip not in allowed_ranges: suspicion += 30.0
    
    # 4. Save Record
    record = AttendanceRecord(
        session_id=req.session_id,
        user_id=user.id,
        device_id=active_device.id if active_device else None,
        ip=client_ip,
        geo_lat=req.geo_lat,
        geo_lng=req.geo_lng,
        selfie_path=None, # Implement saving logic if selfie provided
        token_slot=current_slot,
        suspicion_score=suspicion_score
    )
    
    db.add(record)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Attendance already marked for this session")

    await db.refresh(record)
    return record
