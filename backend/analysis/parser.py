"""
backend/analysis/parser.py
Python AST parser — walks source files and extracts structural information.

Extracts: imports, classes (with bases + methods), functions (with calls),
          module name, test file detection.

Errors in a single file are caught and logged — the pipeline never aborts.
"""
import ast
import logging
import os
import re

from backend.models.parsed_file import (
    ClassInfo,
    FunctionInfo,
    ImportInfo,
    ParsedFile,
)

logger = logging.getLogger(__name__)

# Test file detection pattern
_TEST_PATTERN = re.compile(r"(^test_|_test\.py$)", re.IGNORECASE)


# ── AST visitor ──────────────────────────────────────────────────────────

class SourceVisitor(ast.NodeVisitor):
    """
    Single-pass AST visitor that extracts:
    - Top-level and nested imports
    - Class definitions with base class names and method lists
    - Function/async-function definitions with their call targets
    """

    def __init__(self):
        self.imports: list[ImportInfo] = []
        self.classes: list[ClassInfo] = []
        self.functions: list[FunctionInfo] = []
        self._current_class: str | None = None

    # ── Imports ───────────────────────────────────────────────────────────

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.imports.append(
                ImportInfo(module=alias.name, names=[], is_relative=False)
            )
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        module = node.module or ""
        is_relative = (node.level or 0) > 0
        if is_relative and not module:
            module = "."
        names = [alias.name for alias in node.names if alias.name != "*"]
        self.imports.append(ImportInfo(module=module, names=names, is_relative=is_relative))
        self.generic_visit(node)

    # ── Classes ───────────────────────────────────────────────────────────

    def visit_ClassDef(self, node: ast.ClassDef):
        bases: list[str] = []
        for base in node.bases:
            bases.append(_name_of(base))

        # Collect method names from the class body
        methods: list[str] = []
        for item in node.body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                methods.append(item.name)

        self.classes.append(
            ClassInfo(
                name=node.name,
                line_number=node.lineno,
                bases=bases,
                methods=methods,
                end_line_number=getattr(node, "end_lineno", node.lineno),
            )
        )

        # Visit methods inside the class with class context set
        prev = self._current_class
        self._current_class = node.name
        self.generic_visit(node)
        self._current_class = prev

    # ── Functions ─────────────────────────────────────────────────────────

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._visit_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self._visit_function(node)

    def _visit_function(self, node):
        calls = _extract_calls(node)
        self.functions.append(
            FunctionInfo(
                name=node.name,
                line_number=node.lineno,
                calls=calls,
                is_method=self._current_class is not None,
                end_line_number=getattr(node, "end_lineno", node.lineno),
            )
        )
        self.generic_visit(node)

    # ── Calls ─────────────────────────────────────────────────────────────

    def visit_Call(self, node: ast.Call):
        # Top-level calls outside any function — ignore for now
        self.generic_visit(node)


# ── Helpers ───────────────────────────────────────────────────────────────

def _name_of(node: ast.expr) -> str:
    """Return a string representation of a name/attribute node."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return f"{_name_of(node.value)}.{node.attr}"
    return "<unknown>"


def _extract_calls(func_node) -> list[str]:
    """Walk a function body and collect all Call target names."""
    calls: list[str] = []
    for child in ast.walk(func_node):
        if isinstance(child, ast.Call):
            name = _name_of(child.func)
            if name and name != "<unknown>":
                calls.append(name)
    return list(dict.fromkeys(calls))  # deduplicate while preserving order


def _module_name_from_path(file_path: str, repo_root: str) -> str:
    """
    Derive a dotted module name from an absolute file path and the repo root.

    Example:
      file_path = /tmp/xray/{id}/src/auth/login.py
      repo_root = /tmp/xray/{id}/src
      → "auth.login"
    """
    rel = os.path.relpath(file_path, repo_root)
    # Remove .py extension and normalise separators
    rel = rel.replace(os.sep, "/")
    if rel.endswith(".py"):
        rel = rel[:-3]
    if rel.endswith("/__init__"):
        rel = rel[: -len("/__init__")]
    return rel.replace("/", ".")


# ── Public API ────────────────────────────────────────────────────────────

def parse_file(file_path: str, repo_root: str) -> ParsedFile:
    """
    Parse a single Python source file.

    Returns a ParsedFile. If parsing fails, returns a ParsedFile with
    parse_error set and all lists empty — never raises.
    """
    module_name = _module_name_from_path(file_path, repo_root)
    filename = os.path.basename(file_path)
    is_test = bool(_TEST_PATTERN.search(filename))

    try:
        with open(file_path, encoding="utf-8", errors="replace") as f:
            source = f.read()

        tree = ast.parse(source, filename=file_path)
        visitor = SourceVisitor()
        visitor.visit(tree)

        return ParsedFile(
            path=file_path,
            module_name=module_name,
            classes=visitor.classes,
            functions=visitor.functions,
            imports=visitor.imports,
            is_test=is_test,
        )

    except SyntaxError as exc:
        logger.warning(f"Syntax error in {file_path}: {exc}")
        return ParsedFile(
            path=file_path,
            module_name=module_name,
            is_test=is_test,
            parse_error=f"SyntaxError: {exc}",
        )
    except Exception as exc:
        logger.warning(f"Failed to parse {file_path}: {type(exc).__name__}: {exc}")
        return ParsedFile(
            path=file_path,
            module_name=module_name,
            is_test=is_test,
            parse_error=f"{type(exc).__name__}: {exc}",
        )


def parse_all_files(file_paths: list[str], repo_root: str) -> list[ParsedFile]:
    """
    Parse every file in file_paths. Errors are caught per-file.
    Returns a list of ParsedFile (including ones with parse_error set).
    """
    results: list[ParsedFile] = []
    for path in file_paths:
        pf = parse_file(path, repo_root)
        results.append(pf)
    logger.info(
        f"Parsed {len(results)} files — "
        f"{sum(1 for p in results if p.parse_error)} with errors"
    )
    return results
