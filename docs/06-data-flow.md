# X-Ray — Data Flow

## Overview

This document describes how data flows through X-Ray from repository upload through to the
AI-generated impact explanation displayed in the browser.

There are two primary flows:

1. **Analysis Flow** — scanning a repository and building the graph
2. **Impact Query Flow** — selecting a node and retrieving impact + AI explanation

---

## Flow 1: Repository Analysis

```
USER ACTION: Upload zip file
       │
       ▼
┌──────────────────────────────────────────────┐
│  POST /api/upload                            │
│  FastAPI Upload Router                       │
│                                              │
│  1. Generate repo_id (UUID)                  │
│  2. Save zip to /tmp/xray/{repo_id}/raw.zip  │
│  3. Return { repo_id }                       │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  POST /api/scan/{repo_id}                    │
│  FastAPI Scan Router                         │
│                                              │
│  Triggers async analysis pipeline            │
│  Returns { status: "scanning" }              │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  Repository Manager                          │
│  backend/repository/manager.py               │
│                                              │
│  1. Extract zip to /tmp/xray/{repo_id}/src/  │
│  2. Walk directory tree                      │
│  3. Filter: collect .py files                │
│  4. Return: file_paths[]                     │
└──────────────────────┬───────────────────────┘
                       │  file_paths[]
                       ▼
┌──────────────────────────────────────────────┐
│  Python AST Parser                           │
│  backend/analysis/parser.py                  │
│                                              │
│  For each .py file:                          │
│  1. Read source text                         │
│  2. ast.parse(source)                        │
│  3. Walk AST → extract:                      │
│     - Module name                            │
│     - ClassDef nodes → class names           │
│     - FunctionDef nodes → function names     │
│     - Import/ImportFrom → import list        │
│     - Call nodes → call references           │
│  4. Produce ParsedFile object                │
│  5. On parse error: log + skip file          │
│  Returns: ParsedFile[]                       │
└──────────────────────┬───────────────────────┘
                       │  ParsedFile[]
                       ▼
┌──────────────────────────────────────────────┐
│  Dependency Analyzer                         │
│  backend/analysis/dependency_analyzer.py     │
│                                              │
│  1. Build module → file path map             │
│  2. For each import: resolve to file path    │
│  3. Generate import edges: A → B             │
│  4. Generate call edges: fn_a → fn_b         │
│  5. Generate inheritance edges: Child → Base │
│  6. Identify test files (test_*.py)          │
│  7. Link test functions to tested modules    │
│  Returns: DependencyGraph data               │
└──────────────────────┬───────────────────────┘
                       │
          ┌────────────┴────────────┐
          │  (parallel, optional)   │
          ▼                        ▼
┌─────────────────────┐  ┌─────────────────────────┐
│  Git Analyzer        │  │  Dependency Analyzer    │
│  (if .git exists)   │  │  output already done ↑  │
│                     │  └─────────────────────────┘
│  1. Open repo with  │
│     GitPython       │
│  2. Extract commit  │
│     history per file│
│  3. Compute churn   │
│     (change freq)   │
│  4. Find co-change  │
│     file pairs      │
│  Returns: GitData   │
└─────────┬───────────┘
          │
          ▼
┌──────────────────────────────────────────────┐
│  Graph Builder                               │
│  backend/graph/builder.py                    │
│                                              │
│  Inputs: ParsedFile[], DependencyEdges,      │
│          GitData (optional)                  │
│                                              │
│  1. Create NetworkX DiGraph                  │
│  2. Add file nodes                           │
│  3. Add class nodes (child of file)          │
│  4. Add function nodes (child of class/file) │
│  5. Add import edges                         │
│  6. Add call edges                           │
│  7. Add inheritance edges                    │
│  8. Add test-coverage edges                  │
│  9. Annotate nodes with git churn data       │
│  10. Serialize to JSON                       │
│  11. Persist via store.py                    │
│  Returns: graph_id                           │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  Graph Store                                 │
│  backend/graph/store.py                      │
│                                              │
│  Saves:                                      │
│    /tmp/xray/{repo_id}/graph.json            │
│    SQLite: repository record updated         │
│    status: "ready"                           │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
        BROWSER polls GET /api/status/{repo_id}
        Receives { status: "ready" }
        Navigates to graph view
```

---

## Flow 2: Impact Analysis Query

```
USER ACTION: Click node in graph
      │
      ▼
┌──────────────────────────────────────────────┐
│  POST /api/impact/{repo_id}                  │
│  Body: { node_id: "auth.login.authenticate" }│
│  FastAPI Impact Router                       │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  Graph Store (load)                          │
│  backend/graph/store.py                      │
│                                              │
│  Load graph.json for repo_id                 │
│  Reconstruct NetworkX DiGraph                │
└──────────────────────┬───────────────────────┘
                       │  DiGraph
                       ▼
┌──────────────────────────────────────────────┐
│  Impact Analyzer                             │
│  backend/analysis/impact_analyzer.py         │
│                                              │
│  Given: selected node_id                     │
│                                              │
│  1. Forward reachability:                    │
│     BFS from node → all nodes this           │
│     node depends on                          │
│                                              │
│  2. Reverse reachability:                    │
│     BFS from node (reversed graph) →         │
│     all nodes that depend on this node       │
│                                              │
│  3. Combine: "impact set"                    │
│                                              │
│  4. Filter impact set for test nodes         │
│     → "related tests"                        │
│                                              │
│  5. Return structured ImpactResult           │
└──────────────────────┬───────────────────────┘
                       │  ImpactResult
                       ▼
┌──────────────────────────────────────────────┐
│  Risk Scorer                                 │
│  backend/analysis/risk_scorer.py             │
│                                              │
│  Input: ImpactResult + graph metadata        │
│                                              │
│  Score factors:                              │
│  - direct_count: # of direct neighbors       │
│  - transitive_count: full impact set size    │
│  - max_depth: deepest dependency chain       │
│  - test_coverage_ratio: tests/affected       │
│  - git_churn: avg change freq of affected    │
│                                              │
│  Output: RiskAssessment { level, score,      │
│          contributing_factors }              │
└──────────────────────┬───────────────────────┘
                       │  ImpactResult + RiskAssessment
                       ▼
        API response returned to browser
        Deterministic results displayed immediately
        (no AI required for this step)
```

---

## Flow 3: AI Explanation Request

```
USER ACTION: Click "Explain with AI" button
      │
      ▼
┌──────────────────────────────────────────────┐
│  POST /api/explain/{repo_id}                 │
│  Body: { node_id, impact_result,             │
│          change_description (optional) }     │
│  FastAPI Explain Router                      │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  Prompt Builder                              │
│  backend/ai/prompt_builder.py                │
│                                              │
│  Constructs structured prompt from:          │
│  - Selected component name + type            │
│  - Direct dependencies (names only)          │
│  - Transitive impact (names only)            │
│  - Related tests                             │
│  - Risk score + factors                      │
│  - User's change description (if provided)   │
│  - Git churn context (if available)          │
│                                              │
│  NOTE: Source code is NOT sent to AI.        │
│  Only structural metadata is included.       │
│                                              │
│  Output: formatted prompt string             │
└──────────────────────┬───────────────────────┘
                       │  prompt
                       ▼
┌──────────────────────────────────────────────┐
│  AI Service Layer                            │
│  backend/ai/interface.py                     │
│  backend/ai/watsonx_adapter.py               │
│                                              │
│  1. Call watsonx.ai API with prompt          │
│  2. Receive raw response text                │
│  3. Pass to response_parser.py               │
│                                              │
│  On failure:                                 │
│  - Log error                                 │
│  - Return AIExplanation with                 │
│    { available: false, fallback_message }    │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  Response Parser                             │
│  backend/ai/response_parser.py               │
│                                              │
│  Parse AI response text into structured:     │
│  - explanation: str                          │
│  - risk_areas: list[str]                     │
│  - migration_plan: list[str] (ordered steps) │
│  - recommended_tests: list[str]              │
│  - confidence_note: str                      │
│                                              │
│  On parse failure: return raw text with      │
│  safe defaults for missing fields            │
└──────────────────────┬───────────────────────┘
                       │  AIExplanation
                       ▼
        API response returned to browser
        AI Panel displays results
        Clearly labelled: "AI-generated suggestions"
```

---

## Data Model Summary

```
Repository
  └── id: UUID
  └── path: str
  └── status: "uploading" | "scanning" | "ready" | "error"
  └── created_at: datetime
  └── language: str

ParsedFile
  └── path: str
  └── module_name: str
  └── classes: list[ClassInfo]
  └── functions: list[FunctionInfo]
  └── imports: list[ImportInfo]
  └── is_test: bool

GraphNode
  └── id: str           # e.g. "auth.login.authenticate"
  └── type: "file" | "class" | "function" | "test"
  └── label: str
  └── file_path: str
  └── line_number: int
  └── git_churn: float  # optional

GraphEdge
  └── source: str
  └── target: str
  └── type: "import" | "call" | "inheritance" | "test_covers"

ImpactResult
  └── selected_node: GraphNode
  └── direct_affected: list[GraphNode]
  └── transitive_affected: list[GraphNode]
  └── related_tests: list[GraphNode]
  └── risk: RiskAssessment
  └── analysis_type: "deterministic"

AIExplanation
  └── available: bool
  └── explanation: str
  └── risk_areas: list[str]
  └── migration_plan: list[str]
  └── recommended_tests: list[str]
  └── model_used: str
  └── analysis_type: "ai_assisted"
```

---

## Key Data Flow Rules

1. **Source code never leaves the backend** — only structural metadata (names, types, relationships) is sent to the AI.
2. **Deterministic results are always computed first** — the AI explanation is a separate, optional request.
3. **The graph is computed once and cached** — subsequent impact queries reuse the stored graph without re-scanning.
4. **Each flow is independently failable** — a failure in Git analysis does not block graph building; a failure in AI does not block impact analysis.
5. **All API responses are typed** — Pydantic models enforce the contract between backend and frontend.
