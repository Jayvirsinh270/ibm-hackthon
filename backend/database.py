"""
backend/database.py
SQLAlchemy engine + session factory.
All models are imported here so that Base.metadata.create_all() can find them.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from backend.config import settings

# Put the SQLite file next to the upload directory
_db_dir = os.path.dirname(settings.UPLOAD_DIR) if settings.UPLOAD_DIR != "/tmp/xray" else "/tmp"
os.makedirs(_db_dir, exist_ok=True)
DATABASE_URL = f"sqlite:///{_db_dir}/xray.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # required for SQLite + FastAPI
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Called at application startup."""
    # Import models so Base knows about them
    from backend.models import repository  # noqa: F401
    Base.metadata.create_all(bind=engine)
