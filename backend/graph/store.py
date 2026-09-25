"""
backend/graph/store.py
Persist and load a NetworkX graph as JSON (node-link format).
Graph is stored at: {upload_dir}/{repo_id}/graph.json
"""
from __future__ import annotations
import json
import logging
import os

import networkx as nx
from networkx.readwrite import json_graph

logger = logging.getLogger(__name__)


def graph_path(repo_dir: str) -> str:
    return os.path.join(repo_dir, "graph.json")


def save_graph(G: nx.DiGraph, repo_dir: str) -> str:
    """
    Serialise the graph to node-link JSON and write it to disk.
    Returns the file path.
    """
    path = graph_path(repo_dir)
    data = json_graph.node_link_data(G, edges="edges")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    logger.info(f"Graph saved: {path} ({G.number_of_nodes()} nodes, {G.number_of_edges()} edges)")
    return path


def load_graph(repo_dir: str) -> nx.DiGraph | None:
    """
    Load a graph from disk.  Returns None if the file does not exist.
    """
    path = graph_path(repo_dir)
    if not os.path.exists(path):
        logger.warning(f"Graph file not found: {path}")
        return None
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    G = json_graph.node_link_graph(data, directed=True, edges="edges")
    logger.info(f"Graph loaded: {path}")
    return G
