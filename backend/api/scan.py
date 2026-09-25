"""
backend/api/scan.py
GET  /api/structure/{repo_id}  — return file tree
GET  /api/repos                — list all repositories
DELETE /api/repos/{repo_id}    — delete a repository
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.repository import Repository
from backend.repository.manager import RepositoryManager

logger = logging.getLogger(__name__)
router = APIRouter()

_manager = RepositoryManager()


class StructureResponse(BaseModel):
    repo_id: str
    files: list[str]
    tree: dict


class RepoInfo(BaseModel):
    repo_id: str
    name: str
    status: str
    file_count: int
    created_at: str


@router.get("/structure/{repo_id}", response_model=StructureResponse)
def get_structure(repo_id: str, db: Session = Depends(get_db)):
    """Return the flat file list and nested tree for an uploaded repository."""
    repo = db.get(Repository, repo_id)
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    return StructureResponse(
        repo_id=repo_id,
        files=_manager.list_files(repo_id),
        tree=_manager.get_file_tree(repo_id),
    )


@router.get("/repos", response_model=list[RepoInfo])
def list_repos(db: Session = Depends(get_db)):
    """Return all stored repositories."""
    repos = db.query(Repository).order_by(Repository.created_at.desc()).all()
    return [
        RepoInfo(
            repo_id=r.id,
            name=r.name,
            status=r.status,
            file_count=r.file_count or 0,
            created_at=r.created_at.isoformat(),
        )
        for r in repos
    ]


@router.delete("/repos/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_repo(repo_id: str, db: Session = Depends(get_db)):
    """Delete a repository and all its files."""
    repo = db.get(Repository, repo_id)
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    _manager.cleanup(repo_id, db)
    logger.info(f"Repository deleted: repo_id={repo_id}")
