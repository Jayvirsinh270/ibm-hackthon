"""
backend/tests/unit/test_parser.py
Unit tests for the Python AST parser.
Covers: imports, classes, functions, calls, test detection, error handling.
"""
import os
import textwrap

import pytest

from backend.analysis.parser import (
    parse_file,
    parse_all_files,
    _module_name_from_path,
)
from backend.models.parsed_file import ParsedFile


# ── Helpers ───────────────────────────────────────────────────────────────

def write_py(tmp_path, rel_path: str, source: str) -> str:
    """Write source to a .py file under tmp_path and return the absolute path."""
    full = tmp_path / rel_path
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(textwrap.dedent(source), encoding="utf-8")
    return str(full)


# ── Module name derivation ────────────────────────────────────────────────

class TestModuleName:
    def test_simple(self, tmp_path):
        p = str(tmp_path / "auth" / "login.py")
        assert _module_name_from_path(p, str(tmp_path)) == "auth.login"

    def test_root_file(self, tmp_path):
        p = str(tmp_path / "main.py")
        assert _module_name_from_path(p, str(tmp_path)) == "main"

    def test_init_stripped(self, tmp_path):
        p = str(tmp_path / "auth" / "__init__.py")
        assert _module_name_from_path(p, str(tmp_path)) == "auth"

    def test_deep_nested(self, tmp_path):
        p = str(tmp_path / "a" / "b" / "c.py")
        assert _module_name_from_path(p, str(tmp_path)) == "a.b.c"


# ── Import extraction ─────────────────────────────────────────────────────

class TestImports:
    def test_plain_import(self, tmp_path):
        f = write_py(tmp_path, "mod.py", "import os\nimport sys\n")
        pf = parse_file(f, str(tmp_path))
        modules = [i.module for i in pf.imports]
        assert "os" in modules
        assert "sys" in modules

    def test_from_import(self, tmp_path):
        f = write_py(tmp_path, "mod.py", "from os.path import join, exists\n")
        pf = parse_file(f, str(tmp_path))
        assert len(pf.imports) == 1
        imp = pf.imports[0]
        assert imp.module == "os.path"
        assert "join" in imp.names
        assert "exists" in imp.names
        assert not imp.is_relative

    def test_relative_import(self, tmp_path):
        f = write_py(tmp_path, "auth/utils.py", "from . import helpers\n")
        pf = parse_file(f, str(tmp_path))
        assert any(i.is_relative for i in pf.imports)

    def test_relative_from_import(self, tmp_path):
        f = write_py(tmp_path, "auth/utils.py", "from .models import User\n")
        pf = parse_file(f, str(tmp_path))
        imp = pf.imports[0]
        assert imp.is_relative
        assert imp.module == "models"
        assert "User" in imp.names

    def test_no_imports(self, tmp_path):
        f = write_py(tmp_path, "empty.py", "x = 1\n")
        pf = parse_file(f, str(tmp_path))
        assert pf.imports == []


# ── Class extraction ──────────────────────────────────────────────────────

class TestClasses:
    def test_simple_class(self, tmp_path):
        src = """\
            class Foo:
                def bar(self): pass
                def baz(self): pass
        """
        f = write_py(tmp_path, "mod.py", src)
        pf = parse_file(f, str(tmp_path))
        assert len(pf.classes) == 1
        cls = pf.classes[0]
        assert cls.name == "Foo"
        assert "bar" in cls.methods
        assert "baz" in cls.methods

    def test_class_with_bases(self, tmp_path):
        src = """\
            class Child(Base, Mixin):
                pass
        """
        f = write_py(tmp_path, "mod.py", src)
        pf = parse_file(f, str(tmp_path))
        cls = pf.classes[0]
        assert "Base" in cls.bases
        assert "Mixin" in cls.bases

    def test_multiple_classes(self, tmp_path):
        src = """\
            class A: pass
            class B: pass
            class C: pass
        """
        f = write_py(tmp_path, "mod.py", src)
        pf = parse_file(f, str(tmp_path))
        names = [c.name for c in pf.classes]
        assert names == ["A", "B", "C"]

    def test_no_classes(self, tmp_path):
        f = write_py(tmp_path, "mod.py", "def foo(): pass\n")
        pf = parse_file(f, str(tmp_path))
        assert pf.classes == []


# ── Function extraction ───────────────────────────────────────────────────

class TestFunctions:
    def test_top_level_function(self, tmp_path):
        src = """\
            def greet(name):
                return f"hello {name}"
        """
        f = write_py(tmp_path, "mod.py", src)
        pf = parse_file(f, str(tmp_path))
        names = [fn.name for fn in pf.functions]
        assert "greet" in names

    def test_method_flagged(self, tmp_path):
        src = """\
            class Foo:
                def bar(self): pass
        """
        f = write_py(tmp_path, "mod.py", src)
        pf = parse_file(f, str(tmp_path))
        methods = [fn for fn in pf.functions if fn.is_method]
        assert any(m.name == "bar" for m in methods)

    def test_async_function(self, tmp_path):
        src = """\
            async def fetch(url):
                pass
        """
        f = write_py(tmp_path, "mod.py", src)
        pf = parse_file(f, str(tmp_path))
        names = [fn.name for fn in pf.functions]
        assert "fetch" in names

    def test_function_line_number(self, tmp_path):
        src = "x = 1\n\ndef foo():\n    pass\n"
        f = write_py(tmp_path, "mod.py", src)
        pf = parse_file(f, str(tmp_path))
        foo = next(fn for fn in pf.functions if fn.name == "foo")
        assert foo.line_number == 3


# ── Call extraction ───────────────────────────────────────────────────────

class TestCalls:
    def test_simple_call(self, tmp_path):
        src = """\
            def process():
                validate()
                save()
        """
        f = write_py(tmp_path, "mod.py", src)
        pf = parse_file(f, str(tmp_path))
        fn = pf.functions[0]
        assert "validate" in fn.calls
        assert "save" in fn.calls

    def test_method_call(self, tmp_path):
        src = """\
            def run():
                self.db.connect()
        """
        f = write_py(tmp_path, "mod.py", src)
        pf = parse_file(f, str(tmp_path))
        fn = pf.functions[0]
        assert any("connect" in c for c in fn.calls)

    def test_calls_deduplicated(self, tmp_path):
        src = """\
            def run():
                validate()
                validate()
                validate()
        """
        f = write_py(tmp_path, "mod.py", src)
        pf = parse_file(f, str(tmp_path))
        fn = pf.functions[0]
        assert fn.calls.count("validate") == 1


# ── Test file detection ───────────────────────────────────────────────────

class TestTestDetection:
    def test_test_prefix_detected(self, tmp_path):
        f = write_py(tmp_path, "test_auth.py", "def test_login(): pass\n")
        pf = parse_file(f, str(tmp_path))
        assert pf.is_test is True

    def test_test_suffix_detected(self, tmp_path):
        f = write_py(tmp_path, "auth_test.py", "def test_login(): pass\n")
        pf = parse_file(f, str(tmp_path))
        assert pf.is_test is True

    def test_non_test_file(self, tmp_path):
        f = write_py(tmp_path, "auth.py", "def login(): pass\n")
        pf = parse_file(f, str(tmp_path))
        assert pf.is_test is False

    def test_nested_test_file(self, tmp_path):
        f = write_py(tmp_path, "tests/test_models.py", "pass\n")
        pf = parse_file(f, str(tmp_path))
        assert pf.is_test is True


# ── Error handling ────────────────────────────────────────────────────────

class TestErrorHandling:
    def test_syntax_error_returns_partial(self, tmp_path):
        f = write_py(tmp_path, "broken.py", "def foo(\n  # unclosed\n")
        pf = parse_file(f, str(tmp_path))
        assert pf.parse_error is not None
        assert "SyntaxError" in pf.parse_error
        assert pf.classes == []
        assert pf.functions == []

    def test_syntax_error_does_not_raise(self, tmp_path):
        f = write_py(tmp_path, "broken.py", "!!!invalid python!!!\n")
        pf = parse_file(f, str(tmp_path))
        assert isinstance(pf, ParsedFile)

    def test_missing_file_returns_error(self, tmp_path):
        missing = str(tmp_path / "does_not_exist.py")
        pf = parse_file(missing, str(tmp_path))
        assert pf.parse_error is not None

    def test_parse_all_continues_after_error(self, tmp_path):
        good = write_py(tmp_path, "good.py", "def foo(): pass\n")
        bad = write_py(tmp_path, "bad.py", "def foo(\n")
        results = parse_all_files([good, bad], str(tmp_path))
        assert len(results) == 2
        good_result = next(r for r in results if "good.py" in r.path)
        bad_result = next(r for r in results if "bad.py" in r.path)
        assert good_result.parse_error is None
        assert bad_result.parse_error is not None


# ── Integration-style: realistic file ────────────────────────────────────

class TestRealisticFile:
    def test_full_module(self, tmp_path):
        src = """\
            import os
            from typing import Optional
            from .models import User

            class AuthService:
                def __init__(self, db):
                    self.db = db

                def login(self, username: str, password: str) -> Optional[User]:
                    user = self.db.get_user(username)
                    if not user:
                        return None
                    return user

                def logout(self, user_id: str) -> bool:
                    return self.db.delete_session(user_id)

            def hash_password(password: str) -> str:
                return hashlib.sha256(password.encode()).hexdigest()
        """
        f = write_py(tmp_path, "auth/service.py", src)
        pf = parse_file(f, str(tmp_path))

        assert pf.module_name == "auth.service"
        assert pf.parse_error is None
        assert any(c.name == "AuthService" for c in pf.classes)
        auth = next(c for c in pf.classes if c.name == "AuthService")
        assert "login" in auth.methods
        assert "logout" in auth.methods
        assert any(i.module == "os" for i in pf.imports)
        assert any(i.module == "models" and i.is_relative for i in pf.imports)
        assert any(fn.name == "hash_password" for fn in pf.functions)
