"""
backend/api/source.py
API endpoints for viewing in-repository source code and file diffs.

Provides safe in-browser code viewing with line targeting and syntax info.
Strict path traversal protection ensures access stays within the repository root.
"""
from __future__ import annotations
import logging
import os
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.repository import Repository
from backend.analysis.diff_parser import parse_unified_diff

logger = logging.getLogger(__name__)
router = APIRouter()


class SourceCodeResponse(BaseModel):
    repo_id: str
    file_path: str
    relative_path: str
    total_lines: int
    content: str
    target_line: int | None = None
    start_line: int | None = None
    end_line: int | None = None
    language: str = "python"


class DiffFileResponse(BaseModel):
    file_path: str
    change_type: str
    changed_lines: list[int]
    raw_hunks: list[str]


class DiffInspectRequest(BaseModel):
    diff: str


class DiffInspectResponse(BaseModel):
    repo_id: str
    files: list[DiffFileResponse]


def _detect_language(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    mapping = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".json": "json",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".md": "markdown",
        ".html": "html",
        ".css": "css",
        ".sql": "sql",
        ".sh": "bash",
    }
    return mapping.get(ext, "plaintext")


@router.get("/source/{repo_id}", response_model=SourceCodeResponse)
def get_source_code(
    repo_id: str,
    file_path: str = Query(..., description="Relative or absolute path of the file to inspect"),
    target_line: int | None = Query(None, description="Optional 1-based target line to highlight"),
    start_line: int | None = Query(None, description="Optional start line for symbol boundary"),
    end_line: int | None = Query(None, description="Optional end line for symbol boundary"),
    db: Session = Depends(get_db),
):
    """Retrieve file content from repository safely with path traversal protection."""
    repo = db.get(Repository, repo_id)
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Repository {repo_id} not found")

    repo_root = os.path.abspath(repo.upload_path)
    if not os.path.isdir(repo_root):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository root directory missing on disk: {repo_root}",
        )

    # Normalize and resolve path
    norm_path = file_path.strip().replace("/", os.sep).replace("\\", os.sep)
    if os.path.isabs(norm_path):
        resolved_path = os.path.abspath(norm_path)
    else:
        resolved_path = os.path.abspath(os.path.join(repo_root, norm_path))

    # Path Traversal Check: resolved path MUST be inside repo_root
    try:
        common = os.path.commonpath([repo_root, resolved_path])
        if common != repo_root:
            logger.warning(f"Forbidden path traversal attempt: {file_path} in {repo_root}")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Path outside repository boundary")
    except ValueError:
        # On Windows, paths on different drives raise ValueError in commonpath
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Invalid path")

    if not os.path.isfile(resolved_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File not found: {file_path}")

    try:
        with open(resolved_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except Exception as exc:
        logger.error(f"Error reading {resolved_path}: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to read file: {exc}")

    lines = content.splitlines()
    total_lines = len(lines)
    rel_path = os.path.relpath(resolved_path, repo_root).replace("\\", "/")

    return SourceCodeResponse(
        repo_id=repo_id,
        file_path=resolved_path,
        relative_path=rel_path,
        total_lines=total_lines,
        content=content,
        target_line=target_line,
        start_line=start_line,
        end_line=end_line,
        language=_detect_language(resolved_path),
    )


@router.post("/source/diff/{repo_id}", response_model=DiffInspectResponse)
def inspect_diff_content(
    repo_id: str,
    payload: DiffInspectRequest,
    db: Session = Depends(get_db),
):
    """Parse and return structured diff files and hunks for in-app diff inspection."""
    repo = db.get(Repository, repo_id)
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Repository {repo_id} not found")

    file_diffs = parse_unified_diff(payload.diff)
    return DiffInspectResponse(
        repo_id=repo_id,
        files=[
            DiffFileResponse(
                file_path=fd.file_path,
                change_type=fd.change_type,
                changed_lines=sorted(fd.changed_lines),
                raw_hunks=fd.raw_hunks,
            )
            for fd in file_diffs
        ],
    )
