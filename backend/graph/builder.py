"""
backend/graph/builder.py
Build a NetworkX DiGraph from parsed files + dependency edges.
Each file, class, and function becomes a node; edges are typed relationships.
"""
from __future__ import annotations
import logging

import networkx as nx

from backend.models.parsed_file import ParsedFile
from backend.models.graph import DependencyEdge, EdgeType, NodeType

logger = logging.getLogger(__name__)


def build_graph(
    parsed_files: list[ParsedFile],
    edges: list[DependencyEdge],
    git_data=None,          # GitData | None — added in Phase 5
) -> nx.DiGraph:
    """
    Build and return a NetworkX directed graph.

    Node attributes (stored in graph.nodes[id]):
        label, type, file_path, module_name, line_number, git_churn

    Edge attributes (stored in graph.edges[src, dst]):
        type (EdgeType string)
    """
    G = nx.DiGraph()

    # ── Add nodes ─────────────────────────────────────────────────────────
    for pf in parsed_files:
        if pf.parse_error:
            continue

        node_type = NodeType.TEST if pf.is_test else NodeType.FILE
        churn = _get_churn(pf.path, git_data)

        # File node
        G.add_node(
            pf.module_name,
            label=pf.module_name.split(".")[-1],
            type=node_type.value,
            file_path=pf.path,
            module_name=pf.module_name,
            line_number=0,
            git_churn=churn,
        )

        # Class nodes
        for cls in pf.classes:
            node_id = f"{pf.module_name}.{cls.name}"
            G.add_node(
                node_id,
                label=cls.name,
                type=NodeType.CLASS.value,
                file_path=pf.path,
                module_name=pf.module_name,
                line_number=cls.line_number,
                git_churn=churn,
            )

        # Function / method nodes
        for fn in pf.functions:
            node_id = f"{pf.module_name}.{fn.name}"
            G.add_node(
                node_id,
                label=fn.name,
                type=NodeType.FUNCTION.value,
                file_path=pf.path,
                module_name=pf.module_name,
                line_number=fn.line_number,
                git_churn=churn,
            )

    # ── Add edges ─────────────────────────────────────────────────────────
    added = 0
    for edge in edges:
        if edge.source_id in G and edge.target_id in G:
            G.add_edge(
                edge.source_id,
                edge.target_id,
                type=edge.edge_type.value,
            )
            added += 1

    logger.info(
        f"Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges "
        f"({len(edges) - added} edges skipped — unknown nodes)"
    )
    return G


def _get_churn(file_path: str, git_data) -> int:
    """Extract git churn for a file path if GitData is available."""
    if git_data is None or not git_data.available:
        return 0
    # file_path is absolute; git_data keys are relative paths
    import os
    for rel_path, fgd in git_data.files.items():
        if file_path.endswith(rel_path.replace("/", os.sep)):
            return fgd.commit_count
    return 0
