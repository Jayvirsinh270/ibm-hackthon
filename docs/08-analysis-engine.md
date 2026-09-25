# X-Ray — Analysis Engine

## Purpose of This Document

This document describes the design of X-Ray's analysis engine — the core subsystem responsible
for extracting structural information from source code and building the dependency graph.

---

## Overview

The analysis engine is a pipeline of four independent modules:

```
file_paths[]
     │
     ▼
┌────────────────────┐
│    parser.py       │  Parse source files → structural objects
└────────┬───────────┘
         │  ParsedFile[]
         ▼
┌────────────────────┐
│ dependency_        │  Resolve imports → edges
│ analyzer.py        │
└────────┬───────────┘
         │  edges[]
         │
┌────────────────────┐
│  git_analyzer.py   │  (optional) Git metadata
└────────┬───────────┘
         │  GitData
         ▼
┌────────────────────┐
│  graph/builder.py  │  Assemble NetworkX graph
└────────┬───────────┘
         │  DiGraph
         ▼
┌────────────────────┐
│ impact_analyzer.py │  Traverse graph for a selected node
└────────┬───────────┘
         │  ImpactResult
         ▼
┌────────────────────┐
│  risk_scorer.py    │  Compute risk level
└────────────────────┘
```

Each module has:
- A **single clear responsibility**
- **No knowledge** of the modules downstream of it
- **Structured input and output** using Pydantic models
- **Independent error handling** — failures are caught and logged, not propagated

---

## Module 1: Python AST Parser

**File:** `backend/analysis/parser.py`

### Responsibility

Read Python source files and extract structured information using the built-in `ast` module.

### Input

```python
file_path: str  # absolute path to a .py file
```

### Output

```python
@dataclass
class ClassInfo:
    name: str
    line_number: int
    bases: list[str]          # parent class names
    methods: list[str]        # method names

@dataclass
class FunctionInfo:
    name: str
    line_number: int
    calls: list[str]          # names of functions called inside this function
    is_method: bool

@dataclass
class ImportInfo:
    module: str               # e.g. "auth.login"
    names: list[str]          # e.g. ["authenticate", "logout"]
    is_relative: bool

@dataclass
class ParsedFile:
    path: str
    module_name: str          # derived from file path
    classes: list[ClassInfo]
    functions: list[FunctionInfo]
    imports: list[ImportInfo]
    is_test: bool             # True if filename matches test_*.py or *_test.py
    parse_error: str | None   # None if successful
```

### Strategy

Use Python's `ast.parse()` to build the AST, then walk it with `ast.NodeVisitor`:

```python
class SourceVisitor(ast.NodeVisitor):
    def visit_ClassDef(self, node): ...
    def visit_FunctionDef(self, node): ...
    def visit_AsyncFunctionDef(self, node): ...
    def visit_Import(self, node): ...
    def visit_ImportFrom(self, node): ...
    def visit_Call(self, node): ...
```

### Error Handling

If `ast.parse()` raises `SyntaxError` or any other exception:
- Log the error with file path and exception message
- Return a `ParsedFile` with `parse_error` set and empty lists for all other fields
- **Do not raise** — the pipeline continues with the remaining files

---

## Module 2: Dependency Analyzer

**File:** `backend/analysis/dependency_analyzer.py`

### Responsibility

Take the list of `ParsedFile` objects and resolve imports to produce typed edges between nodes.

### Input

```python
parsed_files: list[ParsedFile]
repo_root: str  # needed for resolving relative imports
```

### Output

```python
@dataclass
class DependencyEdge:
    source_id: str    # node ID of the importing/calling entity
    target_id: str    # node ID of the imported/called entity
    edge_type: EdgeType  # IMPORT | CALL | INHERITS | TEST_COVERS

edges: list[DependencyEdge]
```

### Resolution Strategy

1. **Build module map**: `{ module_name: file_path }` for all parsed files
2. **For each import** in each file:
   - Attempt to resolve the module name to a file path using the module map
   - If resolved: create an `IMPORT` edge from the file to the target file
   - If unresolved (external library): skip (external deps are not in scope for MVP)
3. **For each function call** in each function:
   - Attempt to match the called name to a known function in the same or imported modules
   - If matched: create a `CALL` edge
   - If unmatched: skip (may be a built-in or external call)
4. **For each class** with base classes:
   - Attempt to resolve base class names to known class nodes
   - If resolved: create an `INHERITS` edge
5. **For each test file**:
   - Use naming conventions to link `test_foo.py` → `foo.py`
   - Use import analysis to link test imports to tested modules
   - Create `TEST_COVERS` edges

### Node ID Convention

Node IDs follow a dotted-path convention:

| Type | Format | Example |
|---|---|---|
| File | `path.relative.to.repo` | `auth.login` |
| Class | `file_id.ClassName` | `auth.login.AuthManager` |
| Function | `file_id.function_name` | `auth.login.authenticate` |
| Method | `file_id.ClassName.method_name` | `auth.login.AuthManager.verify` |

---

## Module 3: Git Analyzer

**File:** `backend/analysis/git_analyzer.py`

### Responsibility

Extract change history metadata from the repository's Git log, if a `.git` directory exists.

### Input

```python
repo_path: str  # path to repo root
```

### Output

```python
@dataclass
class FileGitData:
    file_path: str
    commit_count: int          # total number of commits touching this file
    last_changed: datetime
    co_changed_with: list[str] # files frequently changed in the same commits

@dataclass
class GitData:
    available: bool            # False if no .git directory
    files: dict[str, FileGitData]  # keyed by relative file path
```

### Strategy

Use GitPython:
```python
import git

repo = git.Repo(repo_path)
for commit in repo.iter_commits():
    for file_path in commit.stats.files:
        # accumulate commit counts per file
        # track co-changes: for each commit, files changed together
```

### Error Handling

- If `git.InvalidGitRepositoryError` → return `GitData(available=False)`
- If any other exception → log warning, return `GitData(available=False)`
- Git analysis is always optional; its absence must not affect other modules

---

## Module 4: Impact Analyzer

**File:** `backend/analysis/impact_analyzer.py`

### Responsibility

Given a loaded dependency graph and a selected node ID, compute the full impact set.

### Input

```python
graph: nx.DiGraph
node_id: str
```

### Output

```python
@dataclass
class ImpactResult:
    selected_node: GraphNode
    direct_affected: list[GraphNode]     # 1-hop neighbors (both directions)
    transitive_affected: list[GraphNode] # all reachable nodes
    related_tests: list[GraphNode]       # test nodes within transitive set
    max_depth: int                        # deepest chain length
    analysis_type: str = "deterministic"
```

### Algorithm

```
1. Validate node_id exists in graph
   → raise NodeNotFoundError if missing

2. Forward reachability (what this node depends on):
   nx.descendants(graph, node_id)

3. Reverse reachability (what depends on this node):
   nx.ancestors(graph.reverse(), node_id)
   
   (equivalent to: nx.descendants on the reversed graph)

4. Direct neighbors:
   set(graph.successors(node_id)) | set(graph.predecessors(node_id))

5. Full impact set = forward ∪ reverse ∪ direct (minus the selected node itself)

6. Max depth:
   For each node in impact set:
     Find shortest path length from selected node
   max_depth = maximum of these lengths

7. Filter for test nodes:
   related_tests = [n for n in impact_set if graph.nodes[n]["type"] == "test"]

8. Sort results:
   - direct_affected: by node type, then name
   - transitive_affected: by distance from selected node (closest first)
   - related_tests: by file path
```

### Complexity

For a graph with V nodes and E edges:
- `nx.descendants` is O(V + E) — acceptable for MVP scale (thousands of nodes)
- The full algorithm runs in O(V + E) time

---

## Module 5: Risk Scorer

**File:** `backend/analysis/risk_scorer.py`

### Responsibility

Compute a deterministic risk level from the impact analysis results.

### Input

```python
impact: ImpactResult
graph: nx.DiGraph
```

### Output

```python
class RiskLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

@dataclass
class RiskAssessment:
    level: RiskLevel
    score: float              # 0.0 to 1.0
    contributing_factors: list[str]  # human-readable explanations
```

### Scoring Formula

```
score = weighted_sum([
    direct_count_factor   * 0.30,
    transitive_factor     * 0.25,
    depth_factor          * 0.15,
    test_coverage_factor  * 0.20,  # inverted: low coverage = high risk
    git_churn_factor      * 0.10,  # if available
])

Where:
  direct_count_factor   = min(direct_count / 10, 1.0)
  transitive_factor     = min(transitive_count / 50, 1.0)
  depth_factor          = min(max_depth / 8, 1.0)
  test_coverage_factor  = 1.0 - (covered_ratio)  # low coverage = higher risk
  git_churn_factor      = min(avg_churn / 20, 1.0)

Risk level thresholds:
  score >= 0.65  → HIGH
  score >= 0.35  → MEDIUM
  score <  0.35  → LOW
```

### Contributing Factors (human-readable)

For each significant factor, a message is added to `contributing_factors`:
- `"Affects {n} components directly"` (if n > 5)
- `"Transitive impact reaches {n} components"` (if n > 20)
- `"Dependency chain depth is {d} hops"` (if d > 4)
- `"Only {pct}% of affected components have test coverage"` (if pct < 50)
- `"This area has high Git churn ({n} commits)"` (if churn > 10)

---

## Analysis Pipeline Orchestrator

**File:** `backend/analysis/pipeline.py`

A thin orchestrator that wires the modules together in the correct order.

```python
async def run_analysis(repo_id: str, file_paths: list[str], repo_path: str) -> str:
    """
    Run the full analysis pipeline for a repository.
    Returns the graph_id on success.
    """
    parsed_files = parse_all_files(file_paths)          # parser.py
    edges = extract_dependencies(parsed_files, repo_path) # dependency_analyzer.py
    git_data = analyze_git(repo_path)                    # git_analyzer.py
    graph = build_graph(parsed_files, edges, git_data)   # graph/builder.py
    graph_id = store_graph(repo_id, graph)               # graph/store.py
    return graph_id
```

The pipeline:
- Does **not** abort if a single file parse fails
- Does **not** abort if git analysis fails
- Logs all failures with structured context
- Updates repository status in the database throughout the process
