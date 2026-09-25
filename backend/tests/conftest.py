"""
Shared pytest fixtures for the SkyGrid test suite.

Provides an ``AsyncClient`` wired to the FastAPI app for integration
testing and an async SQLAlchemy session.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session
from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    """Yield an httpx AsyncClient bound to the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def db():
    """Yield an active async database session."""
    async with async_session() as session:
        yield session
