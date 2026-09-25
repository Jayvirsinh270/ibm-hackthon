"""
backend/graph/queries.py
Graph traversal helpers — BFS reachability, impact sets, path lengths.
"""
from __future__ import annotations
import logging

import networkx as nx

logger = logging.getLogger(__name__)


class NodeNotFoundError(Exception):
    pass


def get_descendants(G: nx.DiGraph, node_id: str) -> set[str]:
    """All nodes reachable FROM node_id following directed edges."""
    if node_id not in G:
        raise NodeNotFoundError(f"Node not found: {node_id!r}")
    return nx.descendants(G, node_id)


def get_ancestors(G: nx.DiGraph, node_id: str) -> set[str]:
    """All nodes that can REACH node_id (reverse traversal)."""
    if node_id not in G:
        raise NodeNotFoundError(f"Node not found: {node_id!r}")
    return nx.ancestors(G, node_id)


def get_direct_neighbors(G: nx.DiGraph, node_id: str) -> set[str]:
    """Immediate successors and predecessors of node_id (1-hop)."""
    if node_id not in G:
        raise NodeNotFoundError(f"Node not found: {node_id!r}")
    return set(G.successors(node_id)) | set(G.predecessors(node_id))


def get_impact_set(G: nx.DiGraph, node_id: str) -> set[str]:
    """
    Full impact set: all nodes that are either:
    - downstream of node_id (what it affects)
    - upstream of node_id  (what depends on it)
    minus the node itself.
    """
    if node_id not in G:
        raise NodeNotFoundError(f"Node not found: {node_id!r}")
    downstream = nx.descendants(G, node_id)
    upstream   = nx.ancestors(G, node_id)
    return (downstream | upstream) - {node_id}


def get_max_depth(G: nx.DiGraph, node_id: str, impact_set: set[str]) -> int:
    """
    Maximum shortest-path length from node_id to any node in impact_set.
    Uses an undirected view so depth works both ways.
    """
    if not impact_set:
        return 0
    U = G.to_undirected()
    max_d = 0
    for target in impact_set:
        try:
            d = nx.shortest_path_length(U, node_id, target)
            if d > max_d:
                max_d = d
        except nx.NetworkXNoPath:
            pass
    return max_d


def get_nodes_by_type(G: nx.DiGraph, node_type: str) -> list[str]:
    """Return all node IDs whose 'type' attribute matches node_type."""
    return [n for n, data in G.nodes(data=True) if data.get("type") == node_type]


def node_attrs(G: nx.DiGraph, node_id: str) -> dict:
    """Return the attribute dict for a node, or {} if not found."""
    return dict(G.nodes.get(node_id, {}))
