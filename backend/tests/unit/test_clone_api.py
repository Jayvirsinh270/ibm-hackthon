"""
backend/tests/unit/test_clone_api.py
Unit tests for Git clone and Demo provisioning endpoints.
"""
import os
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app
from backend.models.repository import Repository


@pytest.fixture
def test_client(tmp_path):
    db_file = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_file}")
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_clone_rejects_non_http_scheme(test_client):
    res = test_client.post("/api/clone", json={"url": "file:///etc/passwd"})
    assert res.status_code == 422
    assert "HTTP and HTTPS" in res.json()["detail"]


def test_clone_rejects_loopback_and_private_host(test_client):
    for bad_url in [
        "http://localhost/repo.git",
        "https://127.0.0.1/repo.git",
        "http://10.0.0.1/internal.git",
        "http://192.168.1.1/secret.git",
    ]:
        res = test_client.post("/api/clone", json={"url": bad_url})
        assert res.status_code == 403
        assert "Access to private or local loopback" in res.json()["detail"]


def test_clone_rejects_malicious_branch_flag(test_client):
    res = test_client.post(
        "/api/clone",
        json={"url": "https://github.com/example/repo", "branch": "--upload-pack=calc.exe"},
    )
    assert res.status_code == 422
    assert "Branch name cannot start with a dash" in res.json()["detail"]


def test_clone_rejects_invalid_branch_characters(test_client):
    res = test_client.post(
        "/api/clone",
        json={"url": "https://github.com/example/repo", "branch": "main; rm -rf /"},
    )
    assert res.status_code == 422
    assert "Invalid branch name format" in res.json()["detail"]


def test_provision_demo_repository(test_client, tmp_path):
    with patch("backend.api.clone.settings.UPLOAD_DIR", str(tmp_path)):
        res = test_client.post("/api/demo", json={"scenario": "auth_service"})
        assert res.status_code == 201
        data = res.json()
        assert data["name"] == "demo-auth-service"
        assert data["status"] == "ready"
        assert data["file_count"] >= 5
        assert "repo_id" in data

        # Check repository exists on disk
        repo_dir = tmp_path / data["repo_id"] / "src"
        assert (repo_dir / "auth" / "service.py").exists()
        assert (repo_dir / "api" / "routes.py").exists()
        assert (repo_dir / "tests" / "test_auth.py").exists()
        assert (repo_dir / ".git").is_dir()


def test_clone_mocked_success(test_client, tmp_path):
    repo_id_created = []

    def mock_run(cmd, **kwargs):
        # cmd: ['git', 'clone', '--depth', '50', '--', url, target_dir]
        target_dir = cmd[-1]
        os.makedirs(target_dir, exist_ok=True)
        # Create dummy python file
        with open(os.path.join(target_dir, "app.py"), "w") as f:
            f.write("def main(): pass\n")
        return MagicMock(returncode=0, stdout="", stderr="")

    with patch("backend.api.clone.settings.UPLOAD_DIR", str(tmp_path)), \
         patch("backend.api.clone.subprocess.run", side_effect=mock_run):

        res = test_client.post(
            "/api/clone",
            json={"url": "https://github.com/pallets/flask.git", "branch": "main"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["name"] == "flask"
        assert data["file_count"] == 1
        assert data["status"] == "ready"
