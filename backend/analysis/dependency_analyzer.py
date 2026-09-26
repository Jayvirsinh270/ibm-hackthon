"""
backend/analysis/dependency_analyzer.py
Resolves imports, calls, and inheritance between ParsedFile objects
and produces typed DependencyEdge lists.

Resolution is best-effort:
- Imports resolved via module name → file mapping
- Calls resolved by name matching across known functions/methods
- Inheritance resolved by class name matching
- Test → module links by naming convention + import analysis
"""
from __future__ import annotations
import logging
from collections import defaultdict

from backend.models.parsed_file import ParsedFile
from backend.models.graph import DependencyEdge, EdgeType

logger = logging.getLogger(__name__)


def extract_dependencies(
    parsed_files: list[ParsedFile],
    repo_root: str,       # kept for future relative-import resolution
) -> list[DependencyEdge]:
    """
    Build a flat list of DependencyEdge from all parsed files.
    Unknown / external references are silently skipped.
    """
    edges: list[DependencyEdge] = []

    # ── Index structures ─────────────────────────────────────────────────
    # module_name → ParsedFile
    module_map: dict[str, ParsedFile] = {pf.module_name: pf for pf in parsed_files}

    # module_name → set of short function names defined in that module
    module_funcs: dict[str, dict[str, str]] = {}  # module → {short_name: node_id}
    for pf in parsed_files:
        if pf.parse_error:
            continue
        module_funcs[pf.module_name] = {
            fn.name: _func_node_id(pf.module_name, fn.name)
            for fn in pf.functions
        }

    # class short-name → node_id
    class_name_map: dict[str, str] = {}
    for pf in parsed_files:
        if pf.parse_error:
            continue
        for cls in pf.classes:
            class_name_map[cls.name] = _class_node_id(pf.module_name, cls.name)

    # ── Generate edges ────────────────────────────────────────────────────
    for pf in parsed_files:
        if pf.parse_error:
            continue

        src_file_id = pf.module_name

        # Build the set of modules this file actually imports (resolved)
        imported_modules: list[str] = []
        for imp in pf.imports:
            resolved = _resolve_module(imp.module, pf.module_name, imp.is_relative)
            if resolved and resolved in module_map:
                imported_modules.append(resolved)

        # 1. IMPORT edges  file → imported file
        for target_module in imported_modules:
            if src_file_id != target_module:
                edges.append(DependencyEdge(
                    source_id=src_file_id,
                    target_id=target_module,
                    edge_type=EdgeType.IMPORT,
                ))

        # 2. INHERITS edges  class → base class
        for cls in pf.classes:
            src_cls_id = _class_node_id(pf.module_name, cls.name)
            for base in cls.bases:
                if base in class_name_map and class_name_map[base] != src_cls_id:
                    edges.append(DependencyEdge(
                        source_id=src_cls_id,
                        target_id=class_name_map[base],
                        edge_type=EdgeType.INHERITS,
                    ))

        # 3. CALL edges  function → called function
        #    SCOPED: only match targets in modules this file actually imports.
        #    This prevents generic names like "save" / "get" from creating
        #    thousands of spurious cross-module edges.
        scoped_func_map: dict[str, list[str]] = defaultdict(list)
        for mod in imported_modules:
            for short_name, node_id in module_funcs.get(mod, {}).items():
                scoped_func_map[short_name].append(node_id)
        # Also include functions within the same module (intra-file calls)
        for short_name, node_id in module_funcs.get(pf.module_name, {}).items():
            scoped_func_map[short_name].append(node_id)

        for fn in pf.functions:
            src_fn_id = _func_node_id(pf.module_name, fn.name)
            for called_name in fn.calls:
                # strip attribute prefix: "self.db.save" → "save"
                short = called_name.split(".")[-1]
                for target_fn_id in scoped_func_map.get(short, []):
                    if target_fn_id != src_fn_id:
                        edges.append(DependencyEdge(
                            source_id=src_fn_id,
                            target_id=target_fn_id,
                            edge_type=EdgeType.CALL,
                        ))

        # 4. TEST_COVERS edges  test file → module it tests
        if pf.is_test:
            # convention: test_foo.py → foo.py / tests/test_foo.py → foo.py
            tested = _guess_tested_module(pf.module_name, module_map)
            if tested:
                edges.append(DependencyEdge(
                    source_id=src_file_id,
                    target_id=tested,
                    edge_type=EdgeType.TEST_COVERS,
                ))
            # also follow import edges from test files
            for target_module in imported_modules:
                edges.append(DependencyEdge(
                    source_id=src_file_id,
                    target_id=target_module,
                    edge_type=EdgeType.TEST_COVERS,
                ))

    # Deduplicate
    seen: set[tuple] = set()
    unique: list[DependencyEdge] = []
    for e in edges:
        key = (e.source_id, e.target_id, e.edge_type)
        if key not in seen:
            seen.add(key)
            unique.append(e)

    logger.info(f"Extracted {len(unique)} dependency edges from {len(parsed_files)} files")
    return unique


# ── Node ID helpers ───────────────────────────────────────────────────────

def file_node_id(module_name: str) -> str:
    return module_name


def _class_node_id(module_name: str, class_name: str) -> str:
    return f"{module_name}.{class_name}"


def _func_node_id(module_name: str, func_name: str) -> str:
    return f"{module_name}.{func_name}"


# ── Module resolution ─────────────────────────────────────────────────────

def _resolve_module(
    imported_module: str,
    current_module: str,
    is_relative: bool,
) -> str | None:
    """
    Resolve an imported module name to a dotted module path.
    Returns None for external (stdlib / third-party) imports.
    """
    if not imported_module or imported_module == ".":
        # bare relative import — resolve to parent package
        parts = current_module.split(".")
        return ".".join(parts[:-1]) if len(parts) > 1 else None

    if is_relative:
        parts = current_module.split(".")
        parent = ".".join(parts[:-1]) if len(parts) > 1 else ""
        return f"{parent}.{imported_module}".lstrip(".")

    return imported_module


def _guess_tested_module(test_module: str, module_map: dict[str, ParsedFile]) -> str | None:
    """
    Heuristically find the module a test file is testing.
    test_auth → auth
    tests.test_auth → auth
    auth.test_service → auth.service
    """
    parts = test_module.split(".")
    candidates: list[str] = []
    for i, part in enumerate(parts):
        clean = part
        if clean.startswith("test_"):
            clean = clean[5:]
        elif clean.endswith("_test"):
            clean = clean[:-5]
        elif clean == "test" or clean == "tests":
            continue
        candidates.append(clean)

    # try combinations
    for length in range(len(candidates), 0, -1):
        guess = ".".join(candidates[:length])
        if guess in module_map:
            return guess
    return None
