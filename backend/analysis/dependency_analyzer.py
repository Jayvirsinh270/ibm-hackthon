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

    # function/method short-name → list of node_ids that provide it
    func_name_map: dict[str, list[str]] = defaultdict(list)
    for pf in parsed_files:
        if pf.parse_error:
            continue
        for fn in pf.functions:
            node_id = _func_node_id(pf.module_name, fn.name)
            func_name_map[fn.name].append(node_id)

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

        # 1. IMPORT edges  file → imported file
        for imp in pf.imports:
            target_module = _resolve_module(imp.module, pf.module_name, imp.is_relative)
            if target_module and target_module in module_map:
                target_file_id = target_module
                if src_file_id != target_file_id:
                    edges.append(DependencyEdge(
                        source_id=src_file_id,
                        target_id=target_file_id,
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

        # 3. CALL edges  function → called function (best-effort name match)
        for fn in pf.functions:
            src_fn_id = _func_node_id(pf.module_name, fn.name)
            for called_name in fn.calls:
                # strip attribute prefix e.g. "self.db.save" → "save"
                short = called_name.split(".")[-1]
                candidates = func_name_map.get(short, [])
                for target_fn_id in candidates:
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
            for imp in pf.imports:
                target_module = _resolve_module(imp.module, pf.module_name, imp.is_relative)
                if target_module and target_module in module_map:
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
