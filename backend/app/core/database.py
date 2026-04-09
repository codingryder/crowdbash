from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

# Convert postgres:// to postgresql+asyncpg://
# Also replace sslmode with ssl (asyncpg uses ssl, not sslmode)
db_url = settings.DATABASE_URL.replace(
    "postgresql://", "postgresql+asyncpg://"
).replace(
    "postgres://", "postgresql+asyncpg://"
).replace(
    "sslmode=require", "ssl=require"
).replace(
    "channel_binding=require&", ""
).replace(
    "&channel_binding=require", ""
).replace(
    "channel_binding=require", ""
)

engine = create_async_engine(db_url, echo=False, pool_size=5, max_overflow=10)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
