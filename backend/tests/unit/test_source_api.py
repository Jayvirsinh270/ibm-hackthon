"""
backend/tests/unit/test_source_api.py
Unit tests for in-app source code viewer API and security traversal checks.
"""
import os
import tempfile
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_db, Base, SessionLocal
from backend.models.repository import Repository, RepoStatus


@pytest.fixture(scope="module")
def client_and_repo():
    client = TestClient(app)

    # Create temporary repo directory with sample Python files
    temp_dir = tempfile.TemporaryDirectory()
    repo_path = temp_dir.name

    test_file = os.path.join(repo_path, "service.py")
    with open(test_file, "w", encoding="utf-8") as f:
        f.write(
            "class AuthService:\n"
            "    def login(self, username, password):\n"
            "        if not username:\n"
            "            raise ValueError('Username required')\n"
            "        return True\n"
        )

    # Seed repository in database
    db = SessionLocal()
    repo = Repository(
        name="test-source-repo",
        status=RepoStatus.READY,
        upload_path=repo_path,
        file_count=1,
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)
    repo_id = repo.id
    db.close()

    yield client, repo_id, repo_path

    temp_dir.cleanup()


def test_get_source_code_success(client_and_repo):
    client, repo_id, _ = client_and_repo
    resp = client.get(f"/api/source/{repo_id}?file_path=service.py&target_line=2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["relative_path"] == "service.py"
    assert data["total_lines"] == 5
    assert data["target_line"] == 2
    assert "class AuthService:" in data["content"]
    assert data["language"] == "python"


def test_get_source_code_path_traversal_blocked(client_and_repo):
    client, repo_id, _ = client_and_repo
    # Attempt to traverse outside the repository directory
    resp = client.get(f"/api/source/{repo_id}?file_path=../../etc/passwd")
    assert resp.status_code == 403
    assert "Access denied" in resp.json()["detail"]


def test_get_source_code_file_not_found(client_and_repo):
    client, repo_id, _ = client_and_repo
    resp = client.get(f"/api/source/{repo_id}?file_path=nonexistent.py")
    assert resp.status_code == 404


def test_get_source_code_repo_not_found(client_and_repo):
    client, _, _ = client_and_repo
    resp = client.get("/api/source/nonexistent-id?file_path=service.py")
    assert resp.status_code == 404


def test_inspect_diff_endpoint(client_and_repo):
    client, repo_id, _ = client_and_repo
    sample_diff = (
        "diff --git a/service.py b/service.py\n"
        "--- a/service.py\n"
        "+++ b/service.py\n"
        "@@ -2,2 +2,3 @@\n"
        "     def login(self, username, password):\n"
        "+        verify_token(username)\n"
        "         return True\n"
    )
    resp = client.post(f"/api/source/diff/{repo_id}", json={"diff": sample_diff})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["files"]) == 1
    assert data["files"][0]["file_path"] == "service.py"
    assert 3 in data["files"][0]["changed_lines"]
