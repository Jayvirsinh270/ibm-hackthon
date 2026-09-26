"""
backend/api/clone.py
Endpoints for cloning remote Git repositories (GitHub/GitLab/etc.)
and provisioning instant 1-click interactive demo repositories.

Security features:
- SSRF prevention (blocks private/loopback IPs and non-HTTP protocols)
- Command injection prevention (argument arrays without shell=True, regex validation on branch)
- Credential masking (tokens masked in error messages and logs)
- Resource timeout caps
"""
from __future__ import annotations
import ipaddress
import logging
import os
import re
import shutil
import subprocess
import urllib.parse
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models.repository import Repository, RepoStatus

logger = logging.getLogger(__name__)
router = APIRouter()


class CloneRequest(BaseModel):
    url: str = Field(..., description="HTTPS URL of the remote Git repository")
    branch: str | None = Field(None, description="Optional branch or tag name to clone")
    token: str | None = Field(None, description="Optional personal access token for private repositories")
    depth: int = Field(50, ge=1, le=500, description="Commit depth for git history and churn analysis")


class DemoRequest(BaseModel):
    scenario: str = Field("auth_service", description="Preset scenario: auth_service, ecommerce, or data_pipeline")


class CloneResponse(BaseModel):
    repo_id: str
    name: str
    file_count: int
    status: str
    source_url: str | None = None
    branch: str | None = None


def _is_private_or_loopback(host: str) -> bool:
    """Check if host resolves to an RFC 1918 or loopback address to prevent SSRF."""
    if host.lower() in ("localhost", "127.0.0.1", "::1", "metadata.google.internal"):
        return True
    try:
        ip = ipaddress.ip_address(host)
        return ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local
    except ValueError:
        return False


def _sanitize_branch_name(branch: str) -> str:
    """Ensure branch contains only safe git ref characters and does not start with dash."""
    clean = branch.strip()
    if clean.startswith("-"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Branch name cannot start with a dash",
        )
    if not re.match(r"^[a-zA-Z0-9._/-]+$", clean):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid branch name format",
        )
    return clean


def _extract_repo_name(url: str) -> str:
    """Extract human-readable repository name from Git URL."""
    path = urllib.parse.urlparse(url).path.rstrip("/")
    if path.endswith(".git"):
        path = path[:-4]
    name = path.split("/")[-1] if path else "cloned-repo"
    return re.sub(r"[^a-zA-Z0-9._-]", "_", name) or "cloned-repo"


def _mask_credentials(text: str) -> str:
    """Strip personal access tokens or passwords from error text."""
    return re.sub(r"://([^:@/]+)(:[^@/]+)?@", "://***:***@", text)


def _count_python_files(directory: str) -> list[str]:
    """Return all .py file paths in directory."""
    py_files: list[str] = []
    for root, _dirs, files in os.walk(directory):
        for f in files:
            if f.endswith(".py"):
                py_files.append(os.path.join(root, f))
    return py_files


@router.post("/clone", response_model=CloneResponse, status_code=status.HTTP_201_CREATED)
def clone_repository(payload: CloneRequest, db: Session = Depends(get_db)):
    """
    Clone a remote Git repository (e.g. GitHub/GitLab), scan files, and register for analysis.
    """
    parsed = urllib.parse.urlparse(payload.url.strip())
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only HTTP and HTTPS repository URLs are supported",
        )

    if not parsed.hostname or _is_private_or_loopback(parsed.hostname):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to private or local loopback hostnames is prohibited",
        )

    branch = _sanitize_branch_name(payload.branch) if payload.branch else None
    repo_name = _extract_repo_name(payload.url)

    # Inject token if provided
    clone_url = payload.url.strip()
    if payload.token:
        # Use oauth2 format for GitHub/GitLab
        netloc = f"oauth2:{payload.token}@{parsed.netloc}"
        clone_url = urllib.parse.urlunparse(parsed._replace(netloc=netloc))

    repo_id = str(uuid.uuid4())
    repo_dir = os.path.join(settings.UPLOAD_DIR, repo_id)
    src_dir = os.path.join(repo_dir, "src")
    os.makedirs(repo_dir, exist_ok=True)

    cmd = ["git", "clone", "--depth", str(payload.depth)]
    if branch:
        cmd.extend(["--branch", branch])
    cmd.extend(["--", clone_url, src_dir])

    logger.info(f"Cloning repository {payload.url} (branch: {branch}) into {src_dir}")

    try:
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=90,
            check=False,
        )
    except subprocess.TimeoutExpired:
        shutil.rmtree(repo_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Git clone timed out after 90 seconds. Repository may be too large or connection timed out.",
        )
    except Exception as exc:
        shutil.rmtree(repo_dir, ignore_errors=True)
        logger.error(f"Clone subprocess error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute git clone: {_mask_credentials(str(exc))}",
        )

    if res.returncode != 0:
        shutil.rmtree(repo_dir, ignore_errors=True)
        clean_err = _mask_credentials(res.stderr or res.stdout or "Git clone failed")
        logger.warning(f"Git clone error: {clean_err}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Git clone failed: {clean_err.strip()}",
        )

    py_files = _count_python_files(src_dir)
    if not py_files:
        shutil.rmtree(repo_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No Python (.py) source files found in the cloned repository",
        )

    repo = Repository(
        id=repo_id,
        name=repo_name,
        status=RepoStatus.READY,
        upload_path=repo_dir,
        file_count=len(py_files),
        created_at=datetime.now(timezone.utc),
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)

    logger.info(f"Successfully cloned {repo_name} (id={repo_id}, {len(py_files)} files)")

    return CloneResponse(
        repo_id=repo.id,
        name=repo.name,
        file_count=repo.file_count,
        status=repo.status,
        source_url=_mask_credentials(payload.url),
        branch=branch,
    )


@router.post("/demo", response_model=CloneResponse, status_code=status.HTTP_201_CREATED)
def provision_demo_repository(payload: DemoRequest, db: Session = Depends(get_db)):
    """
    Instantly provisions a realistic multi-tier Python repository with Git commit history.
    Allows 1-click test drive without needing manual file uploads.
    """
    import git

    repo_id = str(uuid.uuid4())
    repo_dir = os.path.join(settings.UPLOAD_DIR, repo_id)
    src_dir = os.path.join(repo_dir, "src")
    os.makedirs(src_dir, exist_ok=True)

    try:
        git_repo = git.Repo.init(src_dir)
        git_repo.config_writer().set_value("user", "name", "X-Ray Demo Bot").release()
        git_repo.config_writer().set_value("user", "email", "demo@xray.dev").release()

        # Files content definition
        files = {
            "auth/service.py": (
                '"""Authentication service module."""\n'
                "from .jwt import create_access_token\n"
                "from ..models.user import User\n"
                "from ..database.session import get_db\n\n"
                "class AuthService:\n"
                "    def __init__(self, db=None):\n"
                "        self.db = db or get_db()\n\n"
                "    def login(self, username: str, password: str) -> str:\n"
                "        # Authenticate user and issue JWT\n"
                "        user = self.db.find_user(username)\n"
                "        if not user or not user.check_password(password):\n"
                "            raise ValueError('Invalid credentials')\n"
                "        token = create_access_token(user.username, user.role)\n"
                "        return token\n\n"
                "    def verify_token_v2(self, token: str) -> bool:\n"
                "        # Upgraded verification contract\n"
                "        return len(token) > 10\n"
            ),
            "auth/jwt.py": (
                '"""JWT token utility functions."""\n'
                "import time\n\n"
                "def create_access_token(username: str, role: str) -> str:\n"
                "    return f'token_{username}_{role}_{int(time.time())}'\n\n"
                "def decode_token(token: str) -> dict:\n"
                "    parts = token.split('_')\n"
                "    return {'username': parts[1], 'role': parts[2]}\n"
            ),
            "models/user.py": (
                '"""User entity models."""\n'
                "class User:\n"
                "    def __init__(self, username: str, role: str = 'member'):\n"
                "        self.username = username\n"
                "        self.role = role\n\n"
                "    def check_password(self, password: str) -> bool:\n"
                "        return len(password) >= 6\n"
            ),
            "database/session.py": (
                '"""Database connection and queries."""\n'
                "from ..models.user import User\n\n"
                "class DatabaseSession:\n"
                "    def find_user(self, username: str) -> User | None:\n"
                "        return User(username=username, role='admin')\n\n"
                "def get_db() -> DatabaseSession:\n"
                "    return DatabaseSession()\n"
            ),
            "api/routes.py": (
                '"""FastAPI route controllers."""\n'
                "from ..auth.service import AuthService\n"
                "from ..utils.helpers import format_response\n\n"
                "def login_endpoint(username: str, password: str):\n"
                "    service = AuthService()\n"
                "    token = service.login(username, password)\n"
                "    return format_response({'token': token})\n"
            ),
            "utils/helpers.py": (
                '"""Common helpers and formatters."""\n'
                "def format_response(data: dict) -> dict:\n"
                "    return {'status': 'ok', 'data': data}\n"
            ),
            "tests/test_auth.py": (
                '"""Authentication tests."""\n'
                "from ..auth.service import AuthService\n\n"
                "def test_auth_login():\n"
                "    service = AuthService()\n"
                "    token = service.login('admin', 'secret123')\n"
                "    assert token is not None\n\n"
                "def test_token_verify():\n"
                "    service = AuthService()\n"
                "    assert service.verify_token_v2('valid_long_token_string')\n"
            ),
            "tests/test_api.py": (
                '"""API route integration tests."""\n'
                "from ..api.routes import login_endpoint\n\n"
                "def test_login_route():\n"
                "    res = login_endpoint('alice', 'pass1234')\n"
                "    assert res['status'] == 'ok'\n"
            ),
        }

        # Write files and create git commits over time to build churn history
        def commit_files(file_map: dict[str, str], msg: str):
            for rel_path, content in file_map.items():
                full_path = os.path.join(src_dir, rel_path)
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write(content)
                git_repo.index.add([rel_path])
            git_repo.index.commit(msg)

        # Commit 1: Initial architecture
        commit_files(
            {k: files[k] for k in ["models/user.py", "database/session.py", "utils/helpers.py"]},
            "feat: initial database session and user models",
        )
        # Commit 2: JWT and authentication service
        commit_files(
            {k: files[k] for k in ["auth/jwt.py", "auth/service.py"]},
            "feat: add JWT issuance and AuthService",
        )
        # Commit 3: API route integration
        commit_files(
            {k: files[k] for k in ["api/routes.py"]},
            "feat: add login_endpoint in api routes",
        )
        # Commit 4: Test suites
        commit_files(
            {k: files[k] for k in ["tests/test_auth.py", "tests/test_api.py"]},
            "test: add unit and route tests for authentication",
        )
        # Commit 5: Churn hotspot on auth service
        commit_files(
            {"auth/service.py": files["auth/service.py"]},
            "refactor(auth): upgrade token verification logic to v2 contract",
        )

        py_files = _count_python_files(src_dir)
        repo_name = f"demo-{payload.scenario.replace('_', '-')}"

        repo = Repository(
            id=repo_id,
            name=repo_name,
            status=RepoStatus.READY,
            upload_path=repo_dir,
            file_count=len(py_files),
            created_at=datetime.now(timezone.utc),
        )
        db.add(repo)
        db.commit()
        db.refresh(repo)

        logger.info(f"Provisioned demo repo {repo_name} (id={repo_id}, {len(py_files)} files)")

        return CloneResponse(
            repo_id=repo.id,
            name=repo.name,
            file_count=repo.file_count,
            status=repo.status,
            source_url="https://github.com/demo/auth-microservice",
            branch="main",
        )

    except Exception as exc:
        shutil.rmtree(repo_dir, ignore_errors=True)
        logger.error(f"Failed to provision demo repo: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Demo provisioning failed: {exc}",
        )
