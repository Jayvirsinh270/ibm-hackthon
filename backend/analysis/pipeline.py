"""
backend/analysis/pipeline.py
Thin orchestrator that wires parser → dependency_analyzer → graph builder → store.
Called by the scan API endpoint.
"""
from __future__ import annotations
import logging
import os

from sqlalchemy.orm import Session

from backend.analysis.parser import parse_all_files
from backend.analysis.dependency_analyzer import extract_dependencies
from backend.analysis.git_analyzer import analyze_git
from backend.graph.builder import build_graph
from backend.graph.store import save_graph
from backend.models.repository import Repository, RepoStatus

logger = logging.getLogger(__name__)


def run_pipeline(repo: Repository, db: Session) -> bool:
    """
    Full analysis pipeline for one repository.
    Updates repo.status and repo.scan_stage throughout.
    Returns True on success, False on failure.
    """
    repo_dir = repo.upload_path
    src_dir  = os.path.join(repo_dir, "src")

    # Collect all .py absolute paths
    file_paths: list[str] = []
    for root, _dirs, files in os.walk(src_dir):
        for fname in sorted(files):
            if fname.endswith(".py"):
                file_paths.append(os.path.join(root, fname))

    if not file_paths:
        logger.warning(f"No Python files found for repo_id={repo.id}")
        _set_status(repo, RepoStatus.ERROR, "No Python files found", db)
        return False

    _set_status(repo, RepoStatus.SCANNING, None, db, stage="Parsing Python files…")

    try:
        # 1. Parse
        parsed = parse_all_files(file_paths, src_dir)

        # 2. Extract edges
        _set_stage(repo, "Extracting dependencies…", db)
        edges = extract_dependencies(parsed, src_dir)

        # 3. Git analysis (optional — returns GitData(available=False) if no .git)
        _set_stage(repo, "Reading Git history…", db)
        git_data = analyze_git(repo_dir)

        # 4. Build graph with git churn data
        _set_stage(repo, "Building dependency graph…", db)
        G = build_graph(parsed, edges, git_data=git_data)

        # 5. Persist
        _set_stage(repo, "Saving graph…", db)
        save_graph(G, repo_dir)

        _set_status(repo, RepoStatus.READY, None, db, stage="Ready")
        logger.info(
            f"Pipeline complete: repo_id={repo.id}, "
            f"nodes={G.number_of_nodes()}, edges={G.number_of_edges()}"
        )
        return True

    except Exception as exc:
        logger.error(f"Pipeline failed for repo_id={repo.id}: {exc}")
        _set_status(repo, RepoStatus.ERROR, str(exc), db)
        return False


def _set_stage(repo: Repository, stage: str, db: Session) -> None:
    """Write just the scan_stage without changing status."""
    repo.scan_stage = stage
    db.commit()


def _set_status(
    repo: Repository,
    status: RepoStatus,
    error: str | None,
    db: Session,
    stage: str | None = None,
) -> None:
    repo.status = status
    repo.error_message = error
    if stage is not None:
        repo.scan_stage = stage
    db.commit()
