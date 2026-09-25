"""
backend/api/graph.py
GET  /api/graph/{repo_id}   — return full graph as Cytoscape JSON
POST /api/scan/{repo_id}    — trigger analysis pipeline
GET  /api/status/{repo_id}  — return scan status
"""
import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.repository import Repository
from backend.graph.store import load_graph
from backend.graph.serializer import to_cytoscape
from backend.analysis.pipeline import run_pipeline

logger = logging.getLogger(__name__)
router = APIRouter()


class ScanResponse(BaseModel):
    repo_id: str
    status: str
    message: str


class StatusResponse(BaseModel):
    repo_id: str
    status: str
    error_message: str | None = None


@router.post("/scan/{repo_id}", response_model=ScanResponse)
def trigger_scan(
    repo_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Trigger the full analysis pipeline for a repository (runs in background)."""
    repo = db.get(Repository, repo_id)
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    background_tasks.add_task(run_pipeline, repo, db)
    return ScanResponse(
        repo_id=repo_id,
        status="scanning",
        message="Analysis pipeline started",
    )


@router.get("/graph/{repo_id}")
def get_graph(repo_id: str, db: Session = Depends(get_db)):
    """Return the full dependency graph as Cytoscape.js-compatible JSON."""
    repo = db.get(Repository, repo_id)
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    G = load_graph(repo.upload_path)
    if G is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Graph not found — run POST /api/scan/{repo_id} first",
        )

    return to_cytoscape(G)


@router.get("/status/{repo_id}", response_model=StatusResponse)
def get_status(repo_id: str, db: Session = Depends(get_db)):
    """Return the current scan status of a repository."""
    repo = db.get(Repository, repo_id)
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    return StatusResponse(
        repo_id=repo_id,
        status=repo.status,
        error_message=repo.error_message,
    )
