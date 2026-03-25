from fastapi import APIRouter, HTTPException, status, Response, Request
from sqlalchemy import select
import json

from app.schemas.auth import UserCreate, UserRead, LoginRequest, Token, DeviceChangeRequestCreate
from app.models.user import User
from app.models.device import Device
from app.models.device_change import DeviceChangeRequest
from app.api.deps import DbSession, CurrentUser
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, decode_token

router = APIRouter()

@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def signup(user_in: UserCreate, session: DbSession):
    # Check if user exists
    stmt = select(User).where(User.email == user_in.email)
    result = await session.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="The user with this email already exists in the system.")
    
    user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role="student"
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # Register Device
    device = Device(
        user_id=user.id,
        fingerprint_hash=user_in.device_fingerprint,
        device_model=user_in.device_model,
        os=user_in.os,
        browser=user_in.browser
    )
    session.add(device)
    await session.commit()

    return user

@router.post("/login", response_model=Token)
async def login(login_req: LoginRequest, session: DbSession, response: Response, request: Request):
    stmt = select(User).where(User.email == login_req.email)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(login_req.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token = create_access_token(subject=user.id, role=user.role)
    refresh_token = create_refresh_token(subject=user.id)

    # Set refresh token in httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True, # In prod ensure HTTPS
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
    )

    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh_token", response_model=Token)
async def refresh_token(request: Request, session: DbSession):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    user_id = int(payload.get("sub"))
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid user")

    access_token = create_access_token(subject=user.id, role=user.role)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/request_device_change", status_code=status.HTTP_201_CREATED)
async def request_device_change(req: DeviceChangeRequestCreate, current_user: CurrentUser, session: DbSession):
    # Find active device
    stmt = select(Device).where(Device.user_id == current_user.id, Device.is_active == True)
    result = await session.execute(stmt)
    active_device = result.scalar_one_or_none()
    
    if not active_device:
        raise HTTPException(status_code=404, detail="No active device found")

    device_req = DeviceChangeRequest(
        user_id=current_user.id,
        old_device_id=active_device.id,
        new_fingerprint_hash=req.new_fingerprint,
        new_device_info=req.new_device_info,
        reason=req.reason
    )
    session.add(device_req)
    await session.commit()
    return {"msg": "Device change request submitted successfully"}
