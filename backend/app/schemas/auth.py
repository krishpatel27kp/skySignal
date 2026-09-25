"""
Pydantic v2 schemas for authentication and session identity.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    """Admin login payload."""

    email: str = Field(..., description="IMD analyst or admin email address")
    password: str = Field(..., min_length=1, description="Account password")


class AdminUserOut(BaseModel):
    """Admin user identity representation."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: Literal["analyst", "senior_admin"]


class LoginResponse(BaseModel):
    """Successful admin authentication response."""

    token: str = Field(..., description="JWT Bearer token for API access")
    expires_at: datetime = Field(..., description="ISO 8601 UTC token expiration timestamp")
    user: AdminUserOut = Field(..., description="Authenticated admin profile")


class CitizenSessionOut(BaseModel):
    """
    Anonymous citizen session representation.

    Device IDs are anonymous client tokens used solely to group user
    submissions and maintain offline sync state without tracking PII.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_id: str
    preferred_language: str
    first_seen_at: datetime
