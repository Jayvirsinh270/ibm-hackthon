"""
backend/analysis/diff_analyzer.py
Computes aggregated blast radius and risk assessment for a Git diff.
Maps line-level changes to AST symbols (functions, classes, files) in the dependency graph.
"""
from __future__ import annotations
import logging
import os
import networkx as nx

from backend.analysis.diff_parser import parse_unified_diff, FileDiff
from backend.graph.queries import (
    get_impact_set,
    get_direct_neighbors,
    get_max_depth,
    node_attrs,
)
from backend.analysis.risk_scorer import score_risk
from backend.models.impact import (
    ChangedSymbol,
    DiffImpactResult,
    RiskAssessment,
    RiskLevel,
)

logger = logging.getLogger(__name__)


def analyze_diff_impact(
    G: nx.DiGraph,
    diff_text: str,
    change_description: str = "",
) -> DiffImpactResult:
    """
    Analyze the impact of a unified diff against the loaded dependency graph G.
    Returns a unified DiffImpactResult containing changed symbols, direct/transitive
    impacts, related tests, untested components, and composite risk assessment.
    """
    file_diffs = parse_unified_diff(diff_text)
    if not file_diffs:
        return DiffImpactResult(
            changed_files=[],
            changed_symbols=[],
            direct_affected=[],
            transitive_affected=[],
            related_tests=[],
            untested_affected=[],
            risk=RiskAssessment(
                level=RiskLevel.LOW,
                score=0.0,
                contributing_factors=["Empty diff — no changes detected"],
            ),
            max_depth=0,
            change_description=change_description,
        )

    changed_files: list[str] = [fd.file_path for fd in file_diffs]
    changed_symbols: list[ChangedSymbol] = []

    # ── 1. Map changed lines to AST nodes in G ────────────────────────────
    for fd in file_diffs:
        matched_symbols = _find_symbols_for_file_diff(G, fd)
        changed_symbols.extend(matched_symbols)

    # Deduplicate changed symbols by node_id
    unique_symbols_map: dict[str, ChangedSymbol] = {s.node_id: s for s in changed_symbols}
    changed_symbols = list(unique_symbols_map.values())
    changed_ids = set(unique_symbols_map.keys())

    if not changed_symbols:
        # None of the modified files/lines correspond to nodes in G (e.g. non-Python or comments)
        return DiffImpactResult(
            changed_files=changed_files,
            changed_symbols=[],
            direct_affected=[],
            transitive_affected=[],
            related_tests=[],
            untested_affected=[],
            risk=RiskAssessment(
                level=RiskLevel.LOW,
                score=0.05,
                contributing_factors=["Changed files do not affect indexed Python code components"],
            ),
            max_depth=0,
            change_description=change_description,
        )

    # ── 2. Multi-source impact graph traversal ───────────────────────────
    all_impact_ids: set[str] = set()
    all_direct_ids: set[str] = set()

    for sym_id in changed_ids:
        if sym_id in G:
            all_impact_ids.update(get_impact_set(G, sym_id))
            all_direct_ids.update(get_direct_neighbors(G, sym_id))

    # Remove the changed entities themselves from impact sets
    all_impact_ids -= changed_ids
    all_direct_ids -= changed_ids

    # ── 3. Categorize impacted nodes ─────────────────────────────────────
    direct_affected: list[dict] = []
    transitive_affected: list[dict] = []
    related_tests: list[dict] = []

    for nid in all_impact_ids:
        attrs = node_attrs(G, nid)
        node_dict = {"id": nid, **attrs}

        if _is_test_node(attrs):
            related_tests.append(node_dict)
        elif nid in all_direct_ids:
            direct_affected.append(node_dict)
        else:
            transitive_affected.append(node_dict)

    direct_affected = sorted(direct_affected, key=lambda n: (n.get("type", ""), n["id"]))
    transitive_affected = sorted(transitive_affected, key=lambda n: n["id"])
    related_tests = sorted(related_tests, key=lambda n: n["id"])

    # ── 4. Identify untested affected components ─────────────────────────
    # A component is tested if there is an edge or path connecting to any test node in G
    test_node_ids = {n["id"] for n in related_tests}
    untested_affected: list[dict] = []

    for comp in direct_affected + transitive_affected:
        cid = comp["id"]
        # Check if directly or transitively linked to any related test
        is_tested = False
        for tid in test_node_ids:
            if G.has_edge(tid, cid) or G.has_edge(cid, tid) or nx.has_path(G, tid, cid) or nx.has_path(G, cid, tid):
                is_tested = True
                break
        if not is_tested:
            untested_affected.append(comp)

    # ── 5. Compute max depth across all changed symbols ──────────────────
    max_depth = 0
    for sym_id in changed_ids:
        if sym_id in G:
            d = get_max_depth(G, sym_id, all_impact_ids)
            if d > max_depth:
                max_depth = d

    # ── 6. Risk Scoring ──────────────────────────────────────────────────
    impact_total = len(all_impact_ids)
    avg_churn = _avg_churn_multi(G, changed_ids | all_impact_ids)

    risk = score_risk(
        direct_count=len(direct_affected),
        transitive_count=len(transitive_affected),
        max_depth=max_depth,
        test_count=len(related_tests),
        impact_total=impact_total,
        avg_churn=avg_churn,
    )

    # Customize / enrich contributing factors for diff context
    custom_factors: list[str] = []
    if len(changed_files) > 1:
        custom_factors.append(f"Diff spans {len(changed_files)} files")
    custom_factors.append(
        f"Diff modifies {len(changed_symbols)} symbol{'s' if len(changed_symbols) != 1 else ''}"
    )

    if direct_affected:
        custom_factors.append(f"Directly affects {len(direct_affected)} downstream/upstream components")
    if transitive_affected:
        custom_factors.append(f"Transitive blast radius reaches {len(transitive_affected)} components")
    if max_depth > 3:
        custom_factors.append(f"Dependency propagation depth is {max_depth} hops")
    if untested_affected and (direct_affected or transitive_affected):
        custom_factors.append(
            f"⚠️ {len(untested_affected)} of {len(direct_affected) + len(transitive_affected)} affected components have no test coverage"
        )
    elif related_tests:
        custom_factors.append(f"Covered by {len(related_tests)} existing test suite(s)")

    if custom_factors:
        risk.contributing_factors = custom_factors

    logger.info(
        f"Diff impact analysis: {len(changed_symbols)} symbols, "
        f"direct={len(direct_affected)}, transitive={len(transitive_affected)}, "
        f"tests={len(related_tests)}, untested={len(untested_affected)}, risk={risk.level}"
    )

    return DiffImpactResult(
        changed_files=changed_files,
        changed_symbols=changed_symbols,
        direct_affected=direct_affected,
        transitive_affected=transitive_affected,
        related_tests=related_tests,
        untested_affected=untested_affected,
        risk=risk,
        max_depth=max_depth,
        change_description=change_description,
        analysis_type="deterministic_diff",
    )


def _find_symbols_for_file_diff(G: nx.DiGraph, fd: FileDiff) -> list[ChangedSymbol]:
    """Find all graph nodes corresponding to changed lines in a FileDiff."""
    clean_diff_path = fd.file_path.replace("\\", "/").lstrip("/")

    # Find nodes belonging to this file
    matched_nodes = []
    for nid, data in G.nodes(data=True):
        node_file = data.get("file_path", "").replace("\\", "/").lstrip("/")
        if not node_file:
            continue
        # Check if path ends with diff path or vice versa
        if node_file.endswith(clean_diff_path) or clean_diff_path.endswith(node_file):
            matched_nodes.append((nid, data))

    if not matched_nodes:
        return []

    # Separate file node vs function/class nodes
    file_node = None
    sub_nodes = []  # (nid, data)
    for nid, data in matched_nodes:
        ntype = data.get("type")
        if ntype in ("file", "test"):
            file_node = (nid, data)
        elif ntype in ("function", "class"):
            sub_nodes.append((nid, data))

    # Match changed lines against functions and classes
    symbols: list[ChangedSymbol] = []
    matched_sub_node_ids = set()

    if fd.changed_lines:
        for nid, data in sub_nodes:
            start = data.get("line_number", 0)
            end = data.get("end_line_number", 0) or start
            # Check overlap between [start, end] and fd.changed_lines
            has_overlap = any(start <= line <= end for line in fd.changed_lines)
            if has_overlap:
                symbols.append(
                    ChangedSymbol(
                        node_id=nid,
                        label=data.get("label", nid.split(".")[-1]),
                        type=data.get("type", "symbol"),
                        file_path=data.get("file_path", fd.file_path),
                        line_number=start,
                        change_type=fd.change_type,
                    )
                )
                matched_sub_node_ids.add(nid)

    # If no functions/classes matched the lines, or whole file added/deleted, return file node
    if not symbols and file_node:
        nid, data = file_node
        symbols.append(
            ChangedSymbol(
                node_id=nid,
                label=data.get("label", nid),
                type=data.get("type", "file"),
                file_path=data.get("file_path", fd.file_path),
                line_number=1,
                change_type=fd.change_type,
            )
        )

    return symbols


def _avg_churn_multi(G: nx.DiGraph, node_ids: set[str]) -> float:
    """Average git_churn across a set of nodes."""
    if not node_ids:
        return 0.0
    total = sum(G.nodes[n].get("git_churn", 0) for n in node_ids if n in G)
    return total / len(node_ids)


def _is_test_node(attrs: dict) -> bool:
    """Return True if node represents a test file, test class, or test function."""
    if attrs.get("type") == "test":
        return True
    mod = attrs.get("module_name", "")
    if mod.startswith("test_") or ".test_" in mod or mod.startswith("tests.") or ".tests." in mod:
        return True
    fpath = attrs.get("file_path", "").replace("\\", "/")
    fname = os.path.basename(fpath)
    if fname.startswith("test_") or fname.endswith("_test.py") or "/tests/" in fpath:
        return True
    label = attrs.get("label", "")
    if label.startswith("test_"):
        return True
    return False

