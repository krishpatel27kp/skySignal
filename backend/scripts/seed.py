import sys, os
from pathlib import Path
from dotenv import load_dotenv

# Ensure backend directory is in python path
backend_dir = Path(__file__).resolve().parents[1]
load_dotenv(backend_dir / '.env')
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Automatically detect if PostgreSQL is mapped to port 5433 (via docker-compose)
import socket
def _is_port_listening(port: int) -> bool:
    try:
        with socket.create_connection(('127.0.0.1', port), timeout=0.5):
            return True
    except Exception:
        return False

current_db_url = os.environ.get("DATABASE_URL", "")
if _is_port_listening(5433) and ("localhost:5432" in current_db_url or "127.0.0.1:5432" in current_db_url):
    try:
        import asyncpg, asyncio
        async def _probe():
            conn = await asyncpg.connect("postgresql://skygrid:skygrid_secret@127.0.0.1:5432/skygrid", timeout=1.0)
            await conn.close()
        asyncio.run(_probe())
    except Exception:
        new_url = current_db_url.replace("localhost:5432", "localhost:5433").replace("127.0.0.1:5432", "127.0.0.1:5433")
        os.environ["DATABASE_URL"] = new_url
        os.environ["POSTGRES_PORT"] = "5433"

import asyncio
import uuid
import logging
from sqlalchemy import select
from app.db.session import async_session
from app.models.admin import AdminUser
from app.core.security import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_db() -> None:
    logger.info("Initializing database session...")
    async with async_session() as session:
        # Check if the demo analyst exists
        demo_email = "analyst@imd.gov.in"
        stmt = select(AdminUser).where(AdminUser.email == demo_email)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            logger.info(f"Demo analyst '{demo_email}' not found. Creating...")
            demo_user = AdminUser(
                id=uuid.uuid4(),
                email=demo_email,
                role="senior_admin",
                password_hash=hash_password("Analyst@123")
            )
            session.add(demo_user)
            await session.commit()
            logger.info("✅ SUCCESS: Demo analyst credentials created (analyst@imd.gov.in / Analyst@123)")
        else:
            logger.info(f"✅ SUCCESS: Demo analyst '{demo_email}' already exists.")

if __name__ == "__main__":
    asyncio.run(seed_db())
