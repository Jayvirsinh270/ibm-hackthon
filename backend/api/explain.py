"""
backend/api/explain.py
POST /api/explain/{repo_id}  — AI-powered explanation for a selected node's impact
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.repository import Repository
from backend.graph.store import load_graph
from backend.graph.queries import NodeNotFoundError
from backend.analysis.impact_analyzer import analyze_impact
from backend.models.ai import AIContext
from backend.ai.factory import get_ai_service

logger = logging.getLogger(__name__)
router = APIRouter()


class ExplainRequest(BaseModel):
    node_id: str = Field(..., min_length=1, max_length=500)
    change_description: str = Field("", max_length=500)


@router.post("/explain/{repo_id}")
async def explain_impact_endpoint(
    repo_id: str,
    body: ExplainRequest,
    db: Session = Depends(get_db),
):
    """
    Run deterministic impact analysis for a node, then ask IBM watsonx.ai to
    explain the results in plain English with a migration plan and test
    recommendations.  Falls back to mock if AI is unavailable.
    """
    # ── 1. Validate repo ──────────────────────────────────────────────────
    repo = db.get(Repository, repo_id)
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    # ── 2. Load graph ─────────────────────────────────────────────────────
    G = load_graph(repo.upload_path)
    if G is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Graph not found — run POST /api/scan/{repo_id} first",
        )

    # ── 3. Run impact analysis ────────────────────────────────────────────
    try:
        result = analyze_impact(G, body.node_id)
    except NodeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{body.node_id}' not found in the dependency graph",
        )
    except Exception as exc:
        logger.error(f"Impact analysis failed: repo_id={repo_id} node={body.node_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Impact analysis failed",
        )

    # ── 4. Build AI context (structural metadata only — no source code) ───
    ctx = AIContext(
        selected_node_id=result.selected_node_id,
        selected_node_label=result.selected_node_label,
        selected_node_type=result.selected_node_type,
        change_description=body.change_description,
        direct_affected=result.direct_affected,
        transitive_affected=result.transitive_affected,
        related_tests=result.related_tests,
        risk_level=result.risk.level,
        risk_score=result.risk.score,
        max_depth=result.max_depth,
        contributing_factors=result.risk.contributing_factors,
    )

    # ── 5. Ask AI ─────────────────────────────────────────────────────────
    ai = get_ai_service()
    explanation = await ai.explain_impact(ctx)

    # ── 6. Return combined response ───────────────────────────────────────
    return {
        # Impact data (same shape as /api/impact)
        "selected_node_id":     result.selected_node_id,
        "selected_node_label":  result.selected_node_label,
        "selected_node_type":   result.selected_node_type,
        "direct_affected":      result.direct_affected,
        "transitive_affected":  result.transitive_affected,
        "related_tests":        result.related_tests,
        "risk_level":           result.risk.level,
        "risk_score":           result.risk.score,
        "contributing_factors": result.risk.contributing_factors,
        "max_depth":            result.max_depth,
        "change_description":   body.change_description,
        # AI explanation
        "ai": {
            "available":          explanation.available,
            "explanation":        explanation.explanation,
            "risk_areas":         explanation.risk_areas,
            "migration_plan":     explanation.migration_plan,
            "recommended_tests":  explanation.recommended_tests,
            "model_used":         explanation.model_used,
            "analysis_type":      explanation.analysis_type,
        },
    }
