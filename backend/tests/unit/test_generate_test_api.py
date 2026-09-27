"""
backend/tests/unit/test_generate_test_api.py
Unit tests for 1-Click AI Test Generator API (IBM Bob 2.0 / Watsonx Granite / AST synthesis).
"""
import os
import tempfile
import networkx as nx
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import SessionLocal
from backend.models.repository import Repository, RepoStatus
from backend.graph.store import save_graph


@pytest.fixture(scope="module")
def client_and_test_gen_repo():
    client = TestClient(app)

    temp_dir = tempfile.TemporaryDirectory()
    repo_path = temp_dir.name

    test_file = os.path.join(repo_path, "auth_service.py")
    with open(test_file, "w", encoding="utf-8") as f:
        f.write(
            "def verify_token(token: str, secret: str = 'default_secret') -> bool:\n"
            "    \"\"\"Verify JWT token integrity and expiration.\"\"\"\n"
            "    if not token:\n"
            "        raise ValueError('Token cannot be empty')\n"
            "    return True\n"
        )

    # Build and save a graph
    G = nx.DiGraph()
    G.add_node(
        "auth_service.verify_token",
        label="verify_token",
        type="function",
        file_path="auth_service.py",
        module_name="auth_service",
        line_number=1,
        end_line_number=5,
        docstring="Verify JWT token integrity and expiration.",
        git_churn=3,
    )
    G.add_node(
        "api.verify_route",
        label="verify_route",
        type="function",
        file_path="api.py",
        module_name="api",
        line_number=1,
        end_line_number=5,
        git_churn=1,
    )
    G.add_edge("api.verify_route", "auth_service.verify_token", type="calls")
    save_graph(G, repo_path)

    # Seed repository in database
    db = SessionLocal()
    repo = Repository(
        name="test-test-gen-repo",
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


def test_generate_test_success(client_and_test_gen_repo):
    client, repo_id, _ = client_and_test_gen_repo
    resp = client.post(
        f"/api/generate-test/{repo_id}",
        json={"node_id": "auth_service.verify_token", "framework": "pytest"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["node_id"] == "auth_service.verify_token"
    assert data["target_label"] == "verify_token"
    assert data["test_filename"] == "test_verify_token.py"
    assert "import pytest" in data["test_code"]
    assert "def test_verify_token" in data["test_code"]
    assert data["framework"] == "pytest"
    assert isinstance(data["scenarios_covered"], list)
    assert len(data["scenarios_covered"]) >= 2
    assert "model_used" in data


def test_generate_test_unknown_node(client_and_test_gen_repo):
    client, repo_id, _ = client_and_test_gen_repo
    resp = client.post(
        f"/api/generate-test/{repo_id}",
        json={"node_id": "nonexistent.function", "framework": "pytest"},
    )
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_generate_test_unknown_repo(client_and_test_gen_repo):
    client, _, _ = client_and_test_gen_repo
    resp = client.post(
        "/api/generate-test/nonexistent-repo-id",
        json={"node_id": "auth_service.verify_token"},
    )
    assert resp.status_code == 404
