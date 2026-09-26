"""
backend/tests/unit/test_diff_analyzer.py
Unit tests for unified diff parsing and diff impact analysis.
"""
import pytest
import networkx as nx

from backend.analysis.diff_parser import parse_unified_diff, FileDiff
from backend.analysis.diff_analyzer import analyze_diff_impact, _find_symbols_for_file_diff
from backend.models.impact import RiskLevel


# ── Fixtures ─────────────────────────────────────────────────────────────

SAMPLE_UNIFIED_DIFF = """diff --git a/auth/service.py b/auth/service.py
index abc1234..def5678 100644
--- a/auth/service.py
+++ b/auth/service.py
@@ -10,6 +10,8 @@ class AuthService:
     def login(self, username, password):
+        print("audit log")
+        verify_token()
         return token
"""

MULTI_FILE_DIFF = """diff --git a/auth/service.py b/auth/service.py
--- a/auth/service.py
+++ b/auth/service.py
@@ -12,3 +12,4 @@ def login(self):
+    check_rate_limit()
diff --git a/models/user.py b/models/user.py
--- a/models/user.py
+++ b/models/user.py
@@ -5,2 +5,3 @@ class User:
+    is_admin: bool = False
"""


def make_test_graph() -> nx.DiGraph:
    """
    Constructs:
      auth.service.AuthService (class lines 5-25)
        auth.service.AuthService.login (function lines 10-18) -> calls api.users.verify
      api.users.verify (function lines 20-30)
      tests.test_auth (test lines 1-10) -> tests auth.service.AuthService
    """
    G = nx.DiGraph()

    # auth.service file
    G.add_node(
        "auth.service",
        label="service",
        type="file",
        file_path="D:/hackthon/sample_repo/auth/service.py",
        module_name="auth.service",
        line_number=0,
        end_line_number=0,
        git_churn=5,
    )

    # AuthService class
    G.add_node(
        "auth.service.AuthService",
        label="AuthService",
        type="class",
        file_path="D:/hackthon/sample_repo/auth/service.py",
        module_name="auth.service",
        line_number=5,
        end_line_number=25,
        git_churn=5,
    )

    # login function
    G.add_node(
        "auth.service.AuthService.login",
        label="login",
        type="function",
        file_path="D:/hackthon/sample_repo/auth/service.py",
        module_name="auth.service",
        line_number=10,
        end_line_number=18,
        git_churn=5,
    )

    # downstream dependent function
    G.add_node(
        "api.users.handle_login",
        label="handle_login",
        type="function",
        file_path="D:/hackthon/sample_repo/api/users.py",
        module_name="api.users",
        line_number=20,
        end_line_number=30,
        git_churn=2,
    )

    # test function
    G.add_node(
        "tests.test_auth.test_login",
        label="test_login",
        type="test",
        file_path="D:/hackthon/sample_repo/tests/test_auth.py",
        module_name="tests.test_auth",
        line_number=5,
        end_line_number=15,
        git_churn=1,
    )

    # Edges
    # handle_login calls login
    G.add_edge("api.users.handle_login", "auth.service.AuthService.login", type="call")
    # test covers login
    G.add_edge("tests.test_auth.test_login", "auth.service.AuthService.login", type="tests")

    return G


# ── Tests for Diff Parser ────────────────────────────────────────────────

class TestDiffParser:
    def test_parse_empty_diff(self):
        assert parse_unified_diff("") == []
        assert parse_unified_diff("   \n\t") == []

    def test_parse_single_file_diff(self):
        diffs = parse_unified_diff(SAMPLE_UNIFIED_DIFF)
        assert len(diffs) == 1
        fd = diffs[0]
        assert fd.file_path == "auth/service.py"
        assert fd.change_type == "modified"
        # lines 11 and 12 added
        assert 11 in fd.changed_lines
        assert 12 in fd.changed_lines

    def test_parse_multi_file_diff(self):
        diffs = parse_unified_diff(MULTI_FILE_DIFF)
        assert len(diffs) == 2
        paths = [d.file_path for d in diffs]
        assert "auth/service.py" in paths
        assert "models/user.py" in paths


# ── Tests for Diff Analyzer ──────────────────────────────────────────────

class TestDiffAnalyzer:
    def test_empty_diff_returns_low_risk(self):
        G = make_test_graph()
        res = analyze_diff_impact(G, "")
        assert res.risk.level == RiskLevel.LOW
        assert res.changed_symbols == []
        assert res.direct_affected == []

    def test_maps_line_to_function_symbol(self):
        G = make_test_graph()
        res = analyze_diff_impact(G, SAMPLE_UNIFIED_DIFF)

        symbol_ids = [s.node_id for s in res.changed_symbols]
        assert "auth.service.AuthService.login" in symbol_ids

    def test_computes_direct_and_transitive_impact(self):
        G = make_test_graph()
        res = analyze_diff_impact(G, SAMPLE_UNIFIED_DIFF)

        direct_ids = [n["id"] for n in res.direct_affected]
        assert "api.users.handle_login" in direct_ids

        test_ids = [n["id"] for n in res.related_tests]
        assert "tests.test_auth.test_login" in test_ids

    def test_untested_components_detection(self):
        G = make_test_graph()
        # Add an untested downstream component
        G.add_node(
            "services.untested_service.process",
            label="process",
            type="function",
            file_path="services/untested.py",
            module_name="services.untested_service",
            line_number=1,
            end_line_number=10,
            git_churn=0,
        )
        G.add_edge("services.untested_service.process", "auth.service.AuthService.login", type="call")

        res = analyze_diff_impact(G, SAMPLE_UNIFIED_DIFF)
        untested_ids = [n["id"] for n in res.untested_affected]
        assert "services.untested_service.process" in untested_ids
