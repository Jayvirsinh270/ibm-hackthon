"""
backend/tests/unit/test_dependency_analyzer.py
Unit tests for the dependency analyzer.
"""
import textwrap
import pytest

from backend.analysis.parser import parse_file
from backend.analysis.dependency_analyzer import (
    extract_dependencies,
    _resolve_module,
    _guess_tested_module,
)
from backend.models.graph import EdgeType
from backend.models.parsed_file import ParsedFile


def write_py(tmp_path, rel_path: str, source: str) -> str:
    full = tmp_path / rel_path
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(textwrap.dedent(source), encoding="utf-8")
    return str(full)


class TestResolveModule:
    def test_absolute(self):
        assert _resolve_module("auth.login", "api.routes", False) == "auth.login"

    def test_relative_with_module(self):
        result = _resolve_module("models", "auth.service", True)
        assert result == "auth.models"

    def test_bare_relative(self):
        result = _resolve_module(".", "auth.service", True)
        assert result == "auth"

    def test_empty_module(self):
        result = _resolve_module("", "auth.service", True)
        assert result == "auth"


class TestGuessTested:
    def make_module_map(self, names):
        return {n: None for n in names}  # type: ignore

    def test_test_prefix(self):
        mm = self.make_module_map(["auth"])
        assert _guess_tested_module("test_auth", mm) == "auth"

    def test_test_suffix(self):
        mm = self.make_module_map(["auth"])
        assert _guess_tested_module("auth_test", mm) == "auth"

    def test_nested_test(self):
        mm = self.make_module_map(["auth"])
        assert _guess_tested_module("tests.test_auth", mm) == "auth"

    def test_no_match(self):
        mm = self.make_module_map(["other"])
        assert _guess_tested_module("test_auth", mm) == None


class TestImportEdges:
    def test_import_edge_created(self, tmp_path):
        write_py(tmp_path, "api/routes.py", "from auth import login\n")
        write_py(tmp_path, "auth/__init__.py", "def login(): pass\n")

        files = [
            parse_file(str(tmp_path / "api" / "routes.py"), str(tmp_path)),
            parse_file(str(tmp_path / "auth" / "__init__.py"), str(tmp_path)),
        ]
        edges = extract_dependencies(files, str(tmp_path))
        import_edges = [e for e in edges if e.edge_type == EdgeType.IMPORT]
        assert len(import_edges) >= 1
        assert any(e.source_id == "api.routes" for e in import_edges)

    def test_external_import_ignored(self, tmp_path):
        write_py(tmp_path, "mod.py", "import os\nimport requests\n")
        files = [parse_file(str(tmp_path / "mod.py"), str(tmp_path))]
        edges = extract_dependencies(files, str(tmp_path))
        # os and requests are external — no edges expected
        assert edges == []

    def test_self_import_not_created(self, tmp_path):
        write_py(tmp_path, "auth.py", "from auth import something\n")
        files = [parse_file(str(tmp_path / "auth.py"), str(tmp_path))]
        edges = extract_dependencies(files, str(tmp_path))
        # No self-loops
        assert not any(e.source_id == e.target_id for e in edges)


class TestInheritanceEdges:
    def test_inherits_edge(self, tmp_path):
        write_py(tmp_path, "base.py", "class Base:\n    pass\n")
        write_py(tmp_path, "child.py", "from base import Base\nclass Child(Base):\n    pass\n")

        files = [
            parse_file(str(tmp_path / "base.py"), str(tmp_path)),
            parse_file(str(tmp_path / "child.py"), str(tmp_path)),
        ]
        edges = extract_dependencies(files, str(tmp_path))
        inherit_edges = [e for e in edges if e.edge_type == EdgeType.INHERITS]
        assert any("Child" in e.source_id and "Base" in e.target_id for e in inherit_edges)


class TestTestCoverEdges:
    def test_test_covers_edge(self, tmp_path):
        write_py(tmp_path, "auth.py", "def login(): pass\n")
        write_py(tmp_path, "test_auth.py", "from auth import login\ndef test_login(): login()\n")

        files = [
            parse_file(str(tmp_path / "auth.py"), str(tmp_path)),
            parse_file(str(tmp_path / "test_auth.py"), str(tmp_path)),
        ]
        edges = extract_dependencies(files, str(tmp_path))
        test_edges = [e for e in edges if e.edge_type == EdgeType.TEST_COVERS]
        assert any(e.source_id == "test_auth" and e.target_id == "auth" for e in test_edges)


class TestDeduplication:
    def test_no_duplicate_edges(self, tmp_path):
        write_py(tmp_path, "a.py", "from b import foo\nfrom b import bar\n")
        write_py(tmp_path, "b.py", "def foo(): pass\ndef bar(): pass\n")
        files = [
            parse_file(str(tmp_path / "a.py"), str(tmp_path)),
            parse_file(str(tmp_path / "b.py"), str(tmp_path)),
        ]
        edges = extract_dependencies(files, str(tmp_path))
        seen = set()
        for e in edges:
            key = (e.source_id, e.target_id, e.edge_type)
            assert key not in seen, f"Duplicate edge: {key}"
            seen.add(key)
