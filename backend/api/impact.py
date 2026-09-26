"""
backend/api/impact.py
POST /api/impact/{repo_id}  — run impact analysis for a selected node
"""
import logging
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.repository import Repository
from backend.graph.store import load_graph
from backend.graph.queries import NodeNotFoundError
from backend.analysis.impact_analyzer import analyze_impact

logger = logging.getLogger(__name__)
router = APIRouter()


class ImpactRequest(BaseModel):
    node_id: str = Field(..., min_length=1, max_length=500)
    change_description: str = Field("", max_length=500)


class DiffImpactRequest(BaseModel):
    diff: str = Field(..., description="Unified git diff string to analyze")
    change_description: str = Field("", max_length=500)


@router.post("/impact/{repo_id}")
def run_impact(
    repo_id: str,
    body: ImpactRequest,
    db: Session = Depends(get_db),
):
    """
    Run deterministic impact analysis for a selected node in a scanned repository.
    Returns affected components, related tests, risk level, and risk score.
    """
    repo = db.get(Repository, repo_id)
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    G = load_graph(repo.upload_path)
    if G is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Graph not found — run POST /api/scan/{repo_id} first",
        )

    try:
        result = analyze_impact(G, body.node_id)
    except NodeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{body.node_id}' not found in the dependency graph",
        )
    except Exception as exc:
        logger.error(f"Impact analysis failed: repo_id={repo_id}, node={body.node_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Impact analysis failed",
        )

    return {
        "selected_node_id":    result.selected_node_id,
        "selected_node_label": result.selected_node_label,
        "selected_node_type":  result.selected_node_type,
        "direct_affected":     result.direct_affected,
        "transitive_affected": result.transitive_affected,
        "related_tests":       result.related_tests,
        "risk_level":          result.risk.level,
        "risk_score":          result.risk.score,
        "contributing_factors": result.risk.contributing_factors,
        "max_depth":           result.max_depth,
        "analysis_type":       result.analysis_type,
        "change_description":  body.change_description,
    }


@router.post("/impact/diff/{repo_id}")
def run_diff_impact(
    repo_id: str,
    body: DiffImpactRequest,
    db: Session = Depends(get_db),
):
    """
    Run deterministic blast radius analysis for a Git diff against a repository.
    Maps changed line ranges to AST symbols, then computes aggregated downstream/upstream
    impact, related tests, untested components, and composite risk assessment.
    """
    from backend.analysis.diff_analyzer import analyze_diff_impact

    repo = db.get(Repository, repo_id)
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    G = load_graph(repo.upload_path)
    if G is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Graph not found — run POST /api/scan/{repo_id} first",
        )

    try:
        result = analyze_diff_impact(G, body.diff, change_description=body.change_description)
    except Exception as exc:
        logger.error(f"Diff impact analysis failed: repo_id={repo_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Diff impact analysis failed: {exc}",
        )

    return {
        "changed_files":       result.changed_files,
        "changed_symbols":     [
            {
                "node_id": s.node_id,
                "label": s.label,
                "type": s.type,
                "file_path": s.file_path,
                "line_number": s.line_number,
                "change_type": s.change_type,
            }
            for s in result.changed_symbols
        ],
        "direct_affected":     result.direct_affected,
        "transitive_affected": result.transitive_affected,
        "related_tests":       result.related_tests,
        "untested_affected":   result.untested_affected,
        "risk_level":          result.risk.level,
        "risk_score":          result.risk.score,
        "contributing_factors": result.risk.contributing_factors,
        "max_depth":           result.max_depth,
        "analysis_type":       result.analysis_type,
        "change_description":  result.change_description,
    }
