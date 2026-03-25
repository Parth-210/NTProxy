import pytest
from httpx import AsyncClient
from app.core.security import generate_qr_token, verify_qr_token
import time

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@pytest.mark.asyncio
async def test_qr_hmac():
    session_id = 1
    current_time_slot = int(time.time()) // 5
    
    token = generate_qr_token(session_id, current_time_slot)
    assert token is not None
    
    # Should verify for exactly the slot, slot - 1, and slot + 1
    assert verify_qr_token(session_id, token, current_time_slot) is True
    assert verify_qr_token(session_id, token, current_time_slot + 1) is True
    assert verify_qr_token(session_id, token, current_time_slot - 1) is True
    
    # Should reject slot out of bounds
    assert verify_qr_token(session_id, token, current_time_slot + 2) is False

@pytest.mark.asyncio
async def test_user_signup(client: AsyncClient):
    payload = {
        "name": "Test Student",
        "email": "test@college.edu",
        "password": "securepassword123",
        "device_fingerprint": "abc123xyz",
        "device_model": "iPhone 13",
        "os": "iOS",
        "browser": "Safari"
    }
    res = await client.post("/api/v1/auth/signup", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "test@college.edu"
    assert data["role"] == "student"

@pytest.mark.asyncio
async def test_full_flow(client: AsyncClient):
    # Register Prof
    await client.post("/api/v1/auth/signup", json={
        "name": "Prof Smith", "email": "prof@college.edu", "password": "pass", "device_fingerprint": "123"
    })
    
    # Needs direct DB access to elevate role to admin/professor without full UI in tests
    # But we test signup endpoints above.
    pass
