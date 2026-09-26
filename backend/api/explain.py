"""
backend/api/explain.py
POST /api/explain/{repo_id}  — AI-powered explanation for a selected node's impact
"""
import logging
import os
import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.repository import Repository
from backend.graph.store import load_graph
from backend.graph.queries import NodeNotFoundError
from backend.analysis.impact_analyzer import analyze_impact
from backend.models.ai import AIContext, NodeSummaryContext
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


class ExplainDiffRequest(BaseModel):
    diff: str = Field(..., description="Unified git diff string to analyze and explain")
    change_description: str = Field("", max_length=500)


@router.post("/explain/diff/{repo_id}")
async def explain_diff_endpoint(
    repo_id: str,
    body: ExplainDiffRequest,
    db: Session = Depends(get_db),
):
    """
    Run deterministic blast radius analysis for a Git diff, then ask IBM watsonx.ai
    to explain the impact, highlight risk areas, and suggest a migration and test plan.
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

    sym_summary = f"{len(result.changed_symbols)} symbol{'s' if len(result.changed_symbols) != 1 else ''}"
    file_summary = f"{len(result.changed_files)} file{'s' if len(result.changed_files) != 1 else ''}"

    ctx = AIContext(
        selected_node_id=", ".join(s.node_id for s in result.changed_symbols[:5]) or "Modified Files",
        selected_node_label=f"Git Diff ({sym_summary} in {file_summary})",
        selected_node_type="git_diff",
        change_description=body.change_description or f"Git diff touching: {', '.join(result.changed_files[:3])}",
        direct_affected=result.direct_affected,
        transitive_affected=result.transitive_affected,
        related_tests=result.related_tests,
        risk_level=result.risk.level,
        risk_score=result.risk.score,
        max_depth=result.max_depth,
        contributing_factors=result.risk.contributing_factors,
    )

    ai = get_ai_service()
    explanation = await ai.explain_impact(ctx)

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
        "change_description":  body.change_description,
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


class ExplainNodeRequest(BaseModel):
    node_id: str = Field(..., min_length=1, max_length=500, description="Target node ID to summarize")


@router.post("/explain/node/{repo_id}")
async def explain_node_endpoint(
    repo_id: str,
    body: ExplainNodeRequest,
    db: Session = Depends(get_db),
):
    """
    Generate an AI-powered summary explaining what a function, class, or module
    node does in the codebase, grounded in AST source code, callers, callees,
    and git churn using IBM watsonx.ai.
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

    if body.node_id not in G:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{body.node_id}' not found in dependency graph",
        )

    node_data = G.nodes[body.node_id]
    label = node_data.get("label") or body.node_id.split(".")[-1]
    node_type = node_data.get("type", "unknown")
    file_path = node_data.get("file_path", "")
    line_number = int(node_data.get("line_number") or 1)
    end_line_number = int(node_data.get("end_line_number") or (line_number + 40))
    docstring = node_data.get("docstring") or ""
    git_churn = int(node_data.get("git_churn") or 0)
    module_name = node_data.get("module_name") or node_data.get("module") or ""
    if not module_name and file_path:
        module_name = os.path.splitext(os.path.basename(file_path))[0]

    callers = list(G.predecessors(body.node_id))
    callees = list(G.successors(body.node_id))

    source_code = ""
    if file_path:
        target_path = file_path
        if not os.path.isabs(target_path):
            target_path = os.path.join(repo.upload_path, target_path)
        if not os.path.exists(target_path):
            cand = os.path.join(repo.upload_path, os.path.basename(file_path))
            if os.path.exists(cand):
                target_path = cand

        if os.path.exists(target_path) and os.path.isfile(target_path):
            try:
                with open(target_path, "r", encoding="utf-8", errors="replace") as f:
                    full_content = f.read()

                # Try to extract the exact symbol via AST
                import ast
                try:
                    tree = ast.parse(full_content)
                    for n in ast.walk(tree):
                        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                            if getattr(n, "name", "") == label:
                                source_code = ast.unparse(n)
                                if not docstring:
                                    docstring = ast.get_docstring(n) or ""
                                break
                except Exception:
                    pass

                # Fallback to line slicing
                if not source_code:
                    lines = full_content.splitlines(keepends=True)
                    start_line = max(1, line_number)
                    raw_end = end_line_number if end_line_number > start_line else (start_line + 50)
                    end_line = min(raw_end, start_line + 99, len(lines))
                    source_code = "".join(lines[start_line - 1 : end_line])
            except Exception as e:
                logger.warning(f"Could not read source code for node {body.node_id}: {e}")

    ctx = NodeSummaryContext(
        node_id=body.node_id,
        label=label,
        node_type=node_type,
        file_path=file_path,
        line_number=line_number,
        module_name=module_name,
        source_code=source_code,
        docstring=docstring,
        callers=callers[:10],
        callees=callees[:10],
        git_churn=git_churn,
    )

    ai = get_ai_service()
    summary = await ai.summarize_node(ctx)

    return {
        "node_id": summary.node_id,
        "label": summary.label,
        "node_type": summary.node_type,
        "purpose": summary.purpose,
        "responsibilities": summary.responsibilities,
        "inputs_and_outputs": summary.inputs_and_outputs,
        "architectural_role": summary.architectural_role,
        "complexity_rating": summary.complexity_rating,
        "model_used": summary.model_used,
        "analysis_type": summary.analysis_type,
        "callers": callers[:10],
        "callees": callees[:10],
        "file_path": file_path,
        "line_number": line_number,
    }

