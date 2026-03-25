import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.models.user import User
from app.core.security import get_password_hash

# You might need to adjust this DB URL if running from outside the container
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://admin:admin123@localhost:5432/attendance_db")

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def seed():
    async with AsyncSessionLocal() as session:
        # Check if professor exists
        stmt = select(User).where(User.email == "professor@example.com")
        result = await session.execute(stmt)
        if not result.scalar_one_or_none():
            prof = User(
                name="Dr. Smith",
                email="professor@example.com",
                password_hash=get_password_hash("prof123"),
                role="professor",
                is_active=True
            )
            session.add(prof)

        # Check if student exists
        stmt = select(User).where(User.email == "student@example.com")
        result = await session.execute(stmt)
        if not result.scalar_one_or_none():
            student = User(
                name="John Doe",
                email="student@example.com",
                password_hash=get_password_hash("student123"),
                role="student",
                is_active=True
            )
            session.add(student)

        await session.commit()
        print("Database seeded with test users!")

if __name__ == "__main__":
    asyncio.run(seed())
