"""
backend/tests/unit/test_graph_queries.py
Unit tests for graph traversal queries.
"""
import pytest
import networkx as nx

from backend.graph.queries import (
    get_descendants,
    get_ancestors,
    get_direct_neighbors,
    get_impact_set,
    get_max_depth,
    get_nodes_by_type,
    NodeNotFoundError,
)


def make_graph() -> nx.DiGraph:
    """
    Simple graph:  A → B → C → D
                         ↘ E
    F is isolated (no edges)
    """
    G = nx.DiGraph()
    for n, t in [("A","file"),("B","file"),("C","class"),("D","function"),("E","test"),("F","file")]:
        G.add_node(n, type=t, label=n, file_path="", module_name=n, line_number=0, git_churn=0)
    G.add_edge("A", "B", type="import")
    G.add_edge("B", "C", type="import")
    G.add_edge("B", "E", type="import")
    G.add_edge("C", "D", type="call")
    return G


class TestDescendants:
    def test_from_root(self):
        G = make_graph()
        assert get_descendants(G, "A") == {"B", "C", "D", "E"}

    def test_from_leaf(self):
        G = make_graph()
        assert get_descendants(G, "D") == set()

    def test_missing_node(self):
        G = make_graph()
        with pytest.raises(NodeNotFoundError):
            get_descendants(G, "MISSING")


class TestAncestors:
    def test_ancestors_of_leaf(self):
        G = make_graph()
        assert get_ancestors(G, "D") == {"A", "B", "C"}

    def test_ancestors_of_root(self):
        G = make_graph()
        assert get_ancestors(G, "A") == set()


class TestDirectNeighbors:
    def test_middle_node(self):
        G = make_graph()
        neighbors = get_direct_neighbors(G, "B")
        assert "A" in neighbors   # predecessor
        assert "C" in neighbors   # successor
        assert "E" in neighbors   # successor

    def test_isolated_node(self):
        G = make_graph()
        assert get_direct_neighbors(G, "F") == set()


class TestImpactSet:
    def test_impact_of_middle_node(self):
        G = make_graph()
        impact = get_impact_set(G, "B")
        # upstream: A; downstream: C, D, E
        assert "A" in impact
        assert "C" in impact
        assert "D" in impact
        assert "E" in impact
        assert "B" not in impact

    def test_impact_excludes_self(self):
        G = make_graph()
        assert "A" not in get_impact_set(G, "A")

    def test_isolated_node_empty_impact(self):
        G = make_graph()
        assert get_impact_set(G, "F") == set()


class TestMaxDepth:
    def test_depth_from_root(self):
        G = make_graph()
        impact = get_impact_set(G, "A")
        depth = get_max_depth(G, "A", impact)
        assert depth == 3   # A→B→C→D

    def test_depth_empty_impact(self):
        G = make_graph()
        assert get_max_depth(G, "D", set()) == 0


class TestNodesByType:
    def test_filter_by_type(self):
        G = make_graph()
        tests = get_nodes_by_type(G, "test")
        assert tests == ["E"]

    def test_filter_files(self):
        G = make_graph()
        files = get_nodes_by_type(G, "file")
        assert set(files) == {"A", "B", "F"}
