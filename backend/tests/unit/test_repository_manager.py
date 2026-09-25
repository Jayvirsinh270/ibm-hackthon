"""
backend/tests/unit/test_repository_manager.py
Unit tests for RepositoryManager — upload, safe extraction, cleanup.
"""
import io
import os
import zipfile
from unittest.mock import MagicMock

import pytest

from backend.repository.manager import RepositoryManager, SecurityError


# ── Helpers ───────────────────────────────────────────────────────────────

def make_zip(files: dict[str, str]) -> bytes:
    """Create an in-memory zip with the given {filename: content} mapping."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buf.getvalue()


def _mock_db():
    db = MagicMock()
    db.get.return_value = None
    return db


# ── upload() ─────────────────────────────────────────────────────────────

class TestUpload:
    def test_upload_valid_zip(self, tmp_path):
        mgr = RepositoryManager(upload_dir=str(tmp_path))
        db = _mock_db()

        zip_bytes = make_zip({
            "main.py": "print('hello')",
            "utils/helper.py": "def foo(): pass",
        })

        repo = mgr.upload(zip_bytes, "myproject.zip", db)

        assert repo.id is not None
        assert repo.name == "myproject"
        assert repo.file_count == 2
        assert repo.status == "ready"
        db.add.assert_called_once()
        db.commit.assert_called()

    def test_upload_non_zip_rejected(self, tmp_path):
        mgr = RepositoryManager(upload_dir=str(tmp_path))
        db = _mock_db()

        with pytest.raises(ValueError, match="not a valid zip"):
            mgr.upload(b"not a zip file at all", "project.zip", db)

    def test_upload_exceeds_size_limit(self, tmp_path):
        mgr = RepositoryManager(upload_dir=str(tmp_path))
        db = _mock_db()
        # 1-byte limit forces rejection of any non-empty upload
        import backend.config as cfg
        original = cfg.settings.MAX_UPLOAD_SIZE_MB
        cfg.settings.MAX_UPLOAD_SIZE_MB = 0  # effectively 0 MB

        zip_bytes = make_zip({"a.py": "x = 1"})
        with pytest.raises(ValueError, match="exceeds"):
            mgr.upload(zip_bytes, "big.zip", db)

        cfg.settings.MAX_UPLOAD_SIZE_MB = original

    def test_uploaded_zip_deleted_after_extraction(self, tmp_path):
        mgr = RepositoryManager(upload_dir=str(tmp_path))
        db = _mock_db()

        zip_bytes = make_zip({"main.py": "pass"})
        repo = mgr.upload(zip_bytes, "repo.zip", db)

        # raw.zip must be deleted
        zip_path = os.path.join(str(tmp_path), repo.id, "raw.zip")
        assert not os.path.exists(zip_path)

    def test_src_dir_created(self, tmp_path):
        mgr = RepositoryManager(upload_dir=str(tmp_path))
        db = _mock_db()

        zip_bytes = make_zip({"app.py": "pass"})
        repo = mgr.upload(zip_bytes, "repo.zip", db)

        src_dir = os.path.join(str(tmp_path), repo.id, "src")
        assert os.path.isdir(src_dir)


# ── Path traversal ────────────────────────────────────────────────────────

class TestPathTraversal:
    def test_path_traversal_rejected(self, tmp_path):
        mgr = RepositoryManager(upload_dir=str(tmp_path))
        db = _mock_db()

        # Build a zip with a path traversal attempt
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("../../evil.py", "malicious code")
        zip_bytes = buf.getvalue()

        with pytest.raises(SecurityError, match="Path traversal"):
            mgr.upload(zip_bytes, "evil.zip", db)

    def test_normal_nested_path_allowed(self, tmp_path):
        mgr = RepositoryManager(upload_dir=str(tmp_path))
        db = _mock_db()

        zip_bytes = make_zip({
            "src/auth/login.py": "def login(): pass",
            "src/api/routes.py": "pass",
        })
        repo = mgr.upload(zip_bytes, "repo.zip", db)
        assert repo.file_count == 2


# ── Zip bomb ──────────────────────────────────────────────────────────────

class TestZipBomb:
    def test_zip_bomb_rejected(self, tmp_path):
        mgr = RepositoryManager(upload_dir=str(tmp_path))
        db = _mock_db()

        # Create a zip whose uncompressed size exceeds the limit
        # MAX_UPLOAD_SIZE_MB * 10 * 1024 * 1024 is the threshold
        # Use 1 MB upload limit so threshold is 10 MB
        import backend.config as cfg
        original = cfg.settings.MAX_UPLOAD_SIZE_MB
        cfg.settings.MAX_UPLOAD_SIZE_MB = 1  # 1 MB → threshold = 10 MB

        # ~11 MB of zeros, highly compressible
        large_content = "0" * (11 * 1024 * 1024)
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("bomb.py", large_content)
        zip_bytes = buf.getvalue()

        with pytest.raises(SecurityError, match="zip bomb|too large"):
            mgr.upload(zip_bytes, "bomb.zip", db)

        cfg.settings.MAX_UPLOAD_SIZE_MB = original


# ── list_files() ──────────────────────────────────────────────────────────

class TestListFiles:
    def test_list_py_files(self, tmp_path):
        mgr = RepositoryManager(upload_dir=str(tmp_path))
        db = _mock_db()

        zip_bytes = make_zip({
            "main.py": "pass",
            "utils/helper.py": "pass",
            "README.md": "# readme",          # should be excluded
            "data/sample.txt": "hello",        # should be excluded
        })
        repo = mgr.upload(zip_bytes, "repo.zip", db)
        files = mgr.list_files(repo.id)

        assert "main.py" in files
        assert "utils/helper.py" in files
        assert not any(f.endswith(".md") for f in files)
        assert not any(f.endswith(".txt") for f in files)

    def test_missing_repo_returns_empty(self, tmp_path):
        mgr = RepositoryManager(upload_dir=str(tmp_path))
        assert mgr.list_files("nonexistent-id") == []


# ── cleanup() ─────────────────────────────────────────────────────────────

class TestCleanup:
    def test_cleanup_removes_directory(self, tmp_path):
        mgr = RepositoryManager(upload_dir=str(tmp_path))
        db = _mock_db()

        zip_bytes = make_zip({"a.py": "pass"})
        repo = mgr.upload(zip_bytes, "repo.zip", db)
        repo_dir = os.path.join(str(tmp_path), repo.id)
        assert os.path.isdir(repo_dir)

        # Now mock the DB lookup for cleanup
        db.get.return_value = repo
        mgr.cleanup(repo.id, db)

        assert not os.path.exists(repo_dir)
        db.delete.assert_called_once_with(repo)

    def test_cleanup_nonexistent_repo_is_safe(self, tmp_path):
        mgr = RepositoryManager(upload_dir=str(tmp_path))
        db = _mock_db()
        # Should not raise
        result = mgr.cleanup("does-not-exist", db)
        assert result is False
