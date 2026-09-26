"""
backend/analysis/impact_analyzer.py
Given a loaded graph and a selected node ID, computes the full impact set,
separates test nodes, calculates max depth, and returns an ImpactResult.
"""
from __future__ import annotations
import logging

import networkx as nx

from backend.graph.queries import (
    get_impact_set,
    get_direct_neighbors,
    get_max_depth,
    node_attrs,
    NodeNotFoundError,
)
from backend.models.impact import ImpactResult, RiskAssessment, RiskLevel
from backend.analysis.risk_scorer import score_risk

logger = logging.getLogger(__name__)


def analyze_impact(G: nx.DiGraph, node_id: str) -> ImpactResult:
    """
    Compute the full impact set for a selected node.

    Raises NodeNotFoundError if node_id does not exist in the graph.
    """
    if node_id not in G:
        raise NodeNotFoundError(f"Node not in graph: {node_id!r}")

    selected_attrs = node_attrs(G, node_id)

    # ── Impact sets ───────────────────────────────────────────────────────
    full_impact   = get_impact_set(G, node_id)          # upstream + downstream
    direct        = get_direct_neighbors(G, node_id)    # 1-hop only
    depth         = get_max_depth(G, node_id, full_impact)

    # Split into direct / transitive / tests
    direct_affected    : list[dict] = []
    transitive_affected: list[dict] = []
    related_tests      : list[dict] = []

    for nid in full_impact:
        attrs = node_attrs(G, nid)
        node_dict = {"id": nid, **attrs}

        if attrs.get("type") in ("test",):
            related_tests.append(node_dict)
        elif nid in direct:
            direct_affected.append(node_dict)
        else:
            transitive_affected.append(node_dict)

    # Sort for deterministic output
    direct_affected     = sorted(direct_affected,     key=lambda n: (n.get("type",""), n["id"]))
    transitive_affected = sorted(transitive_affected, key=lambda n: n["id"])
    related_tests       = sorted(related_tests,       key=lambda n: n["id"])

    # ── Risk scoring ──────────────────────────────────────────────────────
    risk = score_risk(
        direct_count     = len(direct_affected),
        transitive_count = len(transitive_affected),
        max_depth        = depth,
        test_count       = len(related_tests),
        impact_total     = len(full_impact),
        avg_churn        = _avg_churn(G, full_impact),
    )

    logger.info(
        f"Impact analysis: node={node_id}, "
        f"direct={len(direct_affected)}, transitive={len(transitive_affected)}, "
        f"tests={len(related_tests)}, risk={risk.level}, depth={depth}"
    )

    return ImpactResult(
        selected_node_id    = node_id,
        selected_node_label = selected_attrs.get("label", node_id.split(".")[-1]),
        selected_node_type  = selected_attrs.get("type", "file"),
        direct_affected     = direct_affected,
        transitive_affected = transitive_affected,
        related_tests       = related_tests,
        risk                = risk,
        max_depth           = depth,
    )


def _avg_churn(G: nx.DiGraph, node_ids: set[str]) -> float:
    """Average git_churn across a set of nodes."""
    if not node_ids:
        return 0.0
    total = sum(G.nodes[n].get("git_churn", 0) for n in node_ids if n in G)
    return total / len(node_ids)
