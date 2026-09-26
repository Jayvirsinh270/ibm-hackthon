"""
backend/tests/unit/test_impact_analyzer.py
Unit tests for the impact analyzer.
"""
import pytest
import networkx as nx

from backend.analysis.impact_analyzer import analyze_impact
from backend.graph.queries import NodeNotFoundError


def make_graph() -> nx.DiGraph:
    """
    Graph:
      api.routes  →  auth.service  →  auth.models
                  →  test_auth           (test node)
      db.models   →  auth.models
    """
    G = nx.DiGraph()

    def add(nid, ntype):
        G.add_node(nid, label=nid.split(".")[-1], type=ntype,
                   file_path="", module_name=nid, line_number=0, git_churn=0)

    add("api.routes",    "file")
    add("auth.service",  "file")
    add("auth.models",   "file")
    add("db.models",     "file")
    add("test_auth",     "test")

    G.add_edge("api.routes",   "auth.service", type="import")
    G.add_edge("auth.service", "auth.models",  type="import")
    G.add_edge("auth.service", "test_auth",    type="import")
    G.add_edge("db.models",    "auth.models",  type="import")

    return G


class TestAnalyzeImpact:
    def test_missing_node_raises(self):
        G = make_graph()
        with pytest.raises(NodeNotFoundError):
            analyze_impact(G, "not.here")

    def test_result_has_selected_node(self):
        G = make_graph()
        result = analyze_impact(G, "auth.service")
        assert result.selected_node_id == "auth.service"
        assert result.selected_node_label == "service"

    def test_direct_affected(self):
        G = make_graph()
        result = analyze_impact(G, "auth.service")
        direct_ids = [n["id"] for n in result.direct_affected]
        assert "api.routes" in direct_ids   # upstream
        assert "auth.models" in direct_ids  # downstream

    def test_test_nodes_in_related_tests(self):
        G = make_graph()
        result = analyze_impact(G, "auth.service")
        test_ids = [n["id"] for n in result.related_tests]
        assert "test_auth" in test_ids

    def test_test_nodes_not_in_direct(self):
        G = make_graph()
        result = analyze_impact(G, "auth.service")
        direct_ids = [n["id"] for n in result.direct_affected]
        assert "test_auth" not in direct_ids

    def test_selected_not_in_impact(self):
        G = make_graph()
        result = analyze_impact(G, "auth.service")
        all_ids = (
            [n["id"] for n in result.direct_affected] +
            [n["id"] for n in result.transitive_affected] +
            [n["id"] for n in result.related_tests]
        )
        assert "auth.service" not in all_ids

    def test_max_depth_positive(self):
        G = make_graph()
        result = analyze_impact(G, "api.routes")
        assert result.max_depth >= 1

    def test_isolated_node_empty_impact(self):
        G = make_graph()
        G.add_node("isolated", label="isolated", type="file",
                   file_path="", module_name="isolated", line_number=0, git_churn=0)
        result = analyze_impact(G, "isolated")
        assert result.direct_affected == []
        assert result.transitive_affected == []
        assert result.related_tests == []
        assert result.max_depth == 0

    def test_risk_present(self):
        G = make_graph()
        result = analyze_impact(G, "auth.service")
        assert result.risk.level in ("HIGH", "MEDIUM", "LOW")
        assert 0.0 <= result.risk.score <= 1.0

    def test_analysis_type_deterministic(self):
        G = make_graph()
        result = analyze_impact(G, "auth.service")
        assert result.analysis_type == "deterministic"
