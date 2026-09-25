"""
backend/graph/serializer.py
Convert a NetworkX DiGraph into Cytoscape.js-compatible JSON.

Cytoscape format:
{
  "nodes": [{"data": {"id": "...", "label": "...", "type": "...", ...}}],
  "edges": [{"data": {"id": "...", "source": "...", "target": "...", "type": "..."}}]
}
"""
from __future__ import annotations
import networkx as nx


def to_cytoscape(G: nx.DiGraph) -> dict:
    """Return Cytoscape.js elements dict from a NetworkX DiGraph."""
    nodes = []
    for node_id, attrs in G.nodes(data=True):
        nodes.append({
            "data": {
                "id": node_id,
                "label": attrs.get("label", node_id.split(".")[-1]),
                "type": attrs.get("type", "file"),
                "file_path": attrs.get("file_path", ""),
                "module_name": attrs.get("module_name", ""),
                "line_number": attrs.get("line_number", 0),
                "git_churn": attrs.get("git_churn", 0),
            }
        })

    edges = []
    for src, dst, attrs in G.edges(data=True):
        edge_id = f"{src}->{dst}"
        edges.append({
            "data": {
                "id": edge_id,
                "source": src,
                "target": dst,
                "type": attrs.get("type", "import"),
            }
        })

    return {"nodes": nodes, "edges": edges}
