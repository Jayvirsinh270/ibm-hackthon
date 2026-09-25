"""
backend/repository/manager.py
Handles zip upload, safe extraction, file listing, and cleanup.
Security controls: path traversal prevention, zip bomb protection, size limits.
"""
import logging
import os
import shutil
import uuid
import zipfile
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.config import settings
from backend.models.repository import Repository, RepoStatus

logger = logging.getLogger(__name__)


class SecurityError(Exception):
    """Raised when a security violation is detected in an uploaded archive."""


class RepositoryManager:
    """All file-system operations for a repository live here."""

    def __init__(self, upload_dir: str | None = None):
        self.upload_dir = upload_dir or settings.UPLOAD_DIR
        os.makedirs(self.upload_dir, exist_ok=True)

    # ── Upload & Extract ──────────────────────────────────────────────────

    def upload(
        self,
        file_data: bytes,
        filename: str,
        db: Session,
    ) -> Repository:
        """
        Save the zip bytes, extract safely, persist a Repository row, and return it.
        Raises SecurityError for path traversal / zip bomb.
        Raises ValueError for files that exceed the size limit or are not zips.
        """
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

        if len(file_data) > max_bytes:
            raise ValueError(
                f"Upload exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit "
                f"({len(file_data) // (1024*1024)} MB received)"
            )

        repo_id = str(uuid.uuid4())
        repo_dir = os.path.join(self.upload_dir, repo_id)
        src_dir = os.path.join(repo_dir, "src")
        zip_path = os.path.join(repo_dir, "raw.zip")

        os.makedirs(src_dir, exist_ok=True)

        try:
            # Write zip to disk
            with open(zip_path, "wb") as f:
                f.write(file_data)

            # Validate it is actually a zip
            if not zipfile.is_zipfile(zip_path):
                raise ValueError("Uploaded file is not a valid zip archive")

            # Safe extraction
            self._safe_extract(zip_path, src_dir, max_bytes * 10)

            # Delete the raw zip (no longer needed)
            os.remove(zip_path)

            # Count .py files
            py_files = self._list_python_files(src_dir)

            # Persist to DB
            repo = Repository(
                id=repo_id,
                name=os.path.splitext(filename)[0],
                status=RepoStatus.READY,
                upload_path=repo_dir,
                file_count=len(py_files),
                created_at=datetime.now(timezone.utc),
            )
            db.add(repo)
            db.commit()
            db.refresh(repo)

            logger.info(
                f"Repository uploaded: repo_id={repo_id}, "
                f"name={repo.name}, files={len(py_files)}"
            )
            return repo

        except Exception:
            # Clean up partial extraction on any failure
            shutil.rmtree(repo_dir, ignore_errors=True)
            raise

    def _safe_extract(self, zip_path: str, target_dir: str, max_uncompressed: int) -> None:
        """Extract zip to target_dir with path traversal and zip bomb checks."""
        real_target = os.path.realpath(target_dir)

        with zipfile.ZipFile(zip_path) as zf:
            # ── Zip bomb check ────────────────────────────────────────────
            total_size = sum(info.file_size for info in zf.infolist())
            if total_size > max_uncompressed:
                raise SecurityError(
                    f"Archive uncompressed size ({total_size} bytes) exceeds limit "
                    f"({max_uncompressed} bytes). Possible zip bomb."
                )

            # ── Path traversal check ──────────────────────────────────────
            for member in zf.namelist():
                member_path = os.path.realpath(os.path.join(real_target, member))
                if not member_path.startswith(real_target + os.sep) and member_path != real_target:
                    raise SecurityError(
                        f"Path traversal detected in archive member: {member!r}"
                    )

            zf.extractall(target_dir)

    # ── File Listing ──────────────────────────────────────────────────────

    def list_files(self, repo_id: str) -> list[str]:
        """Return all .py file paths (relative to src_dir) for a given repo."""
        src_dir = os.path.join(self.upload_dir, repo_id, "src")
        if not os.path.isdir(src_dir):
            return []
        return self._list_python_files(src_dir)

    def _list_python_files(self, src_dir: str) -> list[str]:
        """Walk src_dir and return relative paths of all .py files."""
        py_files: list[str] = []
        for root, _dirs, files in os.walk(src_dir):
            for fname in sorted(files):
                if fname.endswith(".py"):
                    abs_path = os.path.join(root, fname)
                    rel_path = os.path.relpath(abs_path, src_dir)
                    py_files.append(rel_path.replace(os.sep, "/"))
        return py_files

    def get_file_tree(self, repo_id: str) -> dict:
        """Return a nested dict representing the directory tree."""
        src_dir = os.path.join(self.upload_dir, repo_id, "src")
        if not os.path.isdir(src_dir):
            return {}
        return self._build_tree(src_dir, src_dir)

    def _build_tree(self, base_dir: str, current_dir: str) -> dict:
        tree: dict = {}
        try:
            entries = sorted(os.scandir(current_dir), key=lambda e: (not e.is_dir(), e.name))
        except PermissionError:
            return tree
        for entry in entries:
            if entry.is_dir():
                tree[entry.name] = self._build_tree(base_dir, entry.path)
            else:
                tree[entry.name] = None
        return tree

    # ── Cleanup ───────────────────────────────────────────────────────────

    def cleanup(self, repo_id: str, db: Session) -> bool:
        """Delete the repo directory and remove the DB row. Returns True if deleted."""
        repo_dir = os.path.join(self.upload_dir, repo_id)
        deleted = False

        if os.path.isdir(repo_dir):
            shutil.rmtree(repo_dir, ignore_errors=True)
            deleted = True
            logger.info(f"Cleaned up repo directory: repo_id={repo_id}")

        repo = db.get(Repository, repo_id)
        if repo:
            db.delete(repo)
            db.commit()

        return deleted
