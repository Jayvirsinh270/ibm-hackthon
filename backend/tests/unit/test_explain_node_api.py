"""
backend/tests/unit/test_explain_node_api.py
Unit tests for AI-powered Node Purpose Summarizer API (IBM watsonx / AST fallback).
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
def client_and_node_repo():
    client = TestClient(app)

    temp_dir = tempfile.TemporaryDirectory()
    repo_path = temp_dir.name

    test_file = os.path.join(repo_path, "auth_service.py")
    with open(test_file, "w", encoding="utf-8") as f:
        f.write(
            "def authenticate_user(username: str, token: str) -> bool:\n"
            "    \"\"\"Authenticate user against credentials store.\"\"\"\n"
            "    if not username or not token:\n"
            "        return False\n"
            "    return True\n"
        )

    # Build and save a graph
    G = nx.DiGraph()
    G.add_node(
        "auth_service.authenticate_user",
        label="authenticate_user",
        type="function",
        file_path="auth_service.py",
        module_name="auth_service",
        line_number=1,
        end_line_number=5,
        docstring="Authenticate user against credentials store.",
        git_churn=4,
    )
    G.add_node(
        "api.login",
        label="login",
        type="function",
        file_path="api.py",
        module_name="api",
        line_number=1,
        end_line_number=5,
        git_churn=1,
    )
    # caller -> callee: api.login calls auth_service.authenticate_user
    G.add_edge("api.login", "auth_service.authenticate_user", type="calls")
    save_graph(G, repo_path)

    # Seed repository in database
    db = SessionLocal()
    repo = Repository(
        name="test-explain-repo",
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


def test_explain_node_success(client_and_node_repo):
    client, repo_id, _ = client_and_node_repo
    resp = client.post(
        f"/api/explain/node/{repo_id}",
        json={"node_id": "auth_service.authenticate_user"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["node_id"] == "auth_service.authenticate_user"
    assert data["label"] == "authenticate_user"
    assert data["node_type"] == "function"
    assert len(data["purpose"]) > 0
    assert isinstance(data["responsibilities"], list)
    assert len(data["responsibilities"]) >= 1
    assert len(data["inputs_and_outputs"]) > 0
    assert len(data["architectural_role"]) > 0
    assert data["complexity_rating"] in ["LOW", "MEDIUM", "HIGH"]
    assert "api.login" in data["callers"]
    assert data["file_path"] == "auth_service.py"
    assert data["line_number"] == 1


def test_explain_node_unknown_node_404(client_and_node_repo):
    client, repo_id, _ = client_and_node_repo
    resp = client.post(
        f"/api/explain/node/{repo_id}",
        json={"node_id": "nonexistent.function"},
    )
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_explain_node_unknown_repo_404(client_and_node_repo):
    client, _, _ = client_and_node_repo
    resp = client.post(
        "/api/explain/node/00000000-0000-0000-0000-000000000000",
        json={"node_id": "auth_service.authenticate_user"},
    )
    assert resp.status_code == 404
    assert "repository not found" in resp.json()["detail"].lower()


def test_explain_node_empty_node_id_validation_error(client_and_node_repo):
    client, repo_id, _ = client_and_node_repo
    resp = client.post(
        f"/api/explain/node/{repo_id}",
        json={"node_id": ""},
    )
    assert resp.status_code == 422
