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
    """
    Create all tables and apply any missing columns (safe migration).
    Called at application startup.
    SQLAlchemy's create_all() only creates tables that don't exist —
    it never alters existing ones. We handle new columns manually here
    so that adding a column to a model never causes a 500 on next deploy.
    """
    # Import models so Base knows about them
    from backend.models import repository  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _migrate_columns()


def _migrate_columns():
    """
    For every mapped table, add any columns that exist in the ORM model
    but are missing from the live SQLite schema.
    Uses ALTER TABLE … ADD COLUMN — safe, idempotent, data-preserving.
    """
    with engine.connect() as conn:
        for table in Base.metadata.sorted_tables:
            result = conn.execute(
                __import__("sqlalchemy").text(f"PRAGMA table_info({table.name})")
            )
            existing = {row[1] for row in result}
            for col in table.columns:
                if col.name not in existing:
                    # Build a minimal column definition for SQLite
                    col_type = col.type.compile(dialect=engine.dialect)
                    nullable   = "" if col.nullable else " NOT NULL"
                    default    = ""
                    if col.default is not None and hasattr(col.default, "arg"):
                        arg = col.default.arg
                        if isinstance(arg, str):
                            default = f" DEFAULT '{arg}'"
                        elif isinstance(arg, (int, float)):
                            default = f" DEFAULT {arg}"
                    ddl = f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type}{nullable}{default}"
                    conn.execute(__import__("sqlalchemy").text(ddl))
                    conn.commit()
                    import logging
                    logging.getLogger(__name__).info(
                        f"Migration: added column '{col.name}' to table '{table.name}'"
                    )
