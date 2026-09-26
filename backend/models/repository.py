"""
backend/models/repository.py
SQLAlchemy ORM model + Pydantic response schemas for repositories.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped
import enum

from backend.database import Base


class RepoStatus(str, enum.Enum):
    PENDING = "pending"
    SCANNING = "scanning"
    READY = "ready"
    ERROR = "error"


class Repository(Base):
    """SQLAlchemy ORM model — one row per uploaded repository."""
    __tablename__ = "repositories"

    id: Mapped[str] = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = Column(String, nullable=False)
    status: Mapped[str] = Column(SAEnum(RepoStatus), default=RepoStatus.PENDING, nullable=False)
    upload_path: Mapped[str] = Column(String, nullable=False)   # absolute path to repo dir
    file_count: Mapped[int] = Column(Integer, default=0)
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    error_message: Mapped[str | None] = Column(String, nullable=True)
    scan_stage: Mapped[str | None] = Column(String, nullable=True)  # human-readable pipeline stage
