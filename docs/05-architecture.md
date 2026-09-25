# X-Ray — System Architecture

## Architecture Philosophy

X-Ray is built on three principles:

1. **Separation of concerns** — each layer has one job
2. **Fail-local** — a failure in one module does not cascade to others
3. **AI is additive** — the system must function without AI; AI enhances but does not replace

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         BROWSER                             │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  File Upload │  │ Graph Viewer │  │  Impact Panel    │   │
│  │  (React)     │  │ (Cytoscape)  │  │  (React)         │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
│         └────────────────┴───────────────────┘              │
│                          │                                  │
│                    React + TypeScript                        │
│                    Vite Build Tool                           │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / REST
┌──────────────────────────┴──────────────────────────────────┐
│                      BACKEND API                            │
│                     FastAPI (Python)                        │
│                                                             │
│  ┌──────────┐ ┌─────────────┐ ┌──────────┐ ┌───────────┐  │
│  │ /upload  │ │ /scan       │ │ /graph   │ │ /analyze  │  │
│  │ /status  │ │ /structure  │ │ /nodes   │ │ /explain  │  │
│  └──────────┘ └─────────────┘ └──────────┘ └───────────┘  │
│                          │                                  │
│                   API Layer (routers)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                    SERVICE LAYER                             │
│                                                             │
│  ┌────────────────────┐   ┌─────────────────────────────┐  │
│  │  Repository Manager │   │       Analysis Engine       │  │
│  │                    │   │                             │  │
│  │  - Upload handling │   │  ┌──────────────────────┐  │  │
│  │  - File extraction │   │  │  Python AST Parser   │  │  │
│  │  - Path management │   │  ├──────────────────────┤  │  │
│  │  - Cleanup         │   │  │  Dependency Analyzer │  │  │
│  └────────────────────┘   │  ├──────────────────────┤  │  │
│                           │  │  Git Analyzer        │  │  │
│  ┌────────────────────┐   │  ├──────────────────────┤  │  │
│  │   Graph Engine     │   │  │  Impact Analyzer     │  │  │
│  │                    │   │  └──────────────────────┘  │  │
│  │  - NetworkX graph  │   └─────────────────────────────┘  │
│  │  - Graph queries   │                                     │
│  │  - JSON export     │   ┌─────────────────────────────┐  │
│  │  - Persistence     │   │       AI Service Layer      │  │
│  └────────────────────┘   │                             │  │
│                           │  ┌──────────────────────┐  │  │
│  ┌────────────────────┐   │  │  AIService Interface  │  │  │
│  │   Risk Scorer      │   │  ├──────────────────────┤  │  │
│  │                    │   │  │  WatsonxAIAdapter    │  │  │
│  │  - Impact breadth  │   │  ├──────────────────────┤  │  │
│  │  - Depth scoring   │   │  │  MockAIAdapter       │  │  │
│  │  - Test coverage   │   │  └──────────────────────┘  │  │
│  │  - Risk level      │   └──────────────┬──────────────┘  │
│  └────────────────────┘                  │                  │
└─────────────────────────────────────────┬───────────────────┘
                                          │
                    ┌─────────────────────┴──────────────────┐
                    │            IBM watsonx.ai               │
                    │  (granite-13b-chat or similar model)    │
                    └────────────────────────────────────────┘
```

---

## Component Descriptions

### Frontend (React + TypeScript + Vite)

| Component | Responsibility |
|---|---|
| `App` | Root component, routing |
| `UploadPage` | Repository upload/selection UI |
| `GraphPage` | Main graph visualization page |
| `GraphViewer` | Cytoscape.js graph component |
| `NodePanel` | Selected node details sidebar |
| `ImpactPanel` | Impact analysis results display |
| `AIPanel` | AI explanation display |
| `RiskBadge` | Visual risk level indicator |
| `FileTree` | Directory structure display |

**Key libraries:**
- `cytoscape` — graph visualization
- `cytoscape-cola` — graph layout algorithm
- `react-query` — server state management
- `axios` — HTTP client
- `tailwindcss` — styling

---

### Backend API (FastAPI)

**Routers:**

| Router | Endpoints | Responsibility |
|---|---|---|
| `upload` | `POST /api/upload` | Receive and extract repository zip |
| `scan` | `POST /api/scan/{repo_id}` | Trigger full analysis pipeline |
| `structure` | `GET /api/structure/{repo_id}` | Return file tree |
| `graph` | `GET /api/graph/{repo_id}` | Return full graph as JSON |
| `impact` | `POST /api/impact/{repo_id}` | Run impact analysis for a node |
| `explain` | `POST /api/explain/{repo_id}` | Request AI explanation |
| `status` | `GET /api/status/{repo_id}` | Return scan status |

---

### Repository Manager

**Module:** `backend/repository/manager.py`

Responsibilities:
- Accept uploaded zip files
- Extract to isolated temp directory (`/tmp/xray/{repo_id}/`)
- Validate and list extractable files
- Provide file paths to analysis engine
- Clean up on request or after TTL

---

### Analysis Engine

**Module:** `backend/analysis/`

Four sub-modules with clear boundaries:

| Sub-module | Input | Output |
|---|---|---|
| `parser.py` | File path list | List of `ParsedFile` objects |
| `dependency_analyzer.py` | List of `ParsedFile` | Dependency edges |
| `git_analyzer.py` | Repo path | Git change metadata |
| `impact_analyzer.py` | Graph + selected node | `ImpactResult` |

See [`08-analysis-engine.md`](./08-analysis-engine.md) for detailed design.

---

### Graph Engine

**Module:** `backend/graph/`

| File | Responsibility |
|---|---|
| `builder.py` | Build NetworkX graph from analysis results |
| `queries.py` | Graph traversal queries (BFS, reachability) |
| `serializer.py` | Convert graph to Cytoscape.js-compatible JSON |
| `store.py` | Persist and load graph from disk (JSON) |

---

### Risk Scorer

**Module:** `backend/analysis/risk_scorer.py`

Computes a deterministic risk score based on:

- **Impact breadth**: number of directly affected components
- **Transitive depth**: how far the impact reaches
- **Test coverage**: ratio of affected components with test coverage
- **Git churn**: how frequently the affected files have changed

Output: `RiskLevel` enum (`HIGH`, `MEDIUM`, `LOW`) + numeric score

---

### AI Service Layer

**Module:** `backend/ai/`

See [`07-ai-architecture.md`](./07-ai-architecture.md) for full design.

| File | Responsibility |
|---|---|
| `interface.py` | `AIService` abstract base class |
| `watsonx_adapter.py` | IBM watsonx.ai implementation |
| `mock_adapter.py` | Mock implementation for testing |
| `prompt_builder.py` | Construct structured prompts from analysis data |
| `response_parser.py` | Parse and validate AI responses |

---

### Data Models

**Module:** `backend/models/`

| Model | Description |
|---|---|
| `Repository` | Uploaded repo metadata (id, path, status, created_at) |
| `ParsedFile` | Single parsed source file (path, language, classes, functions, imports) |
| `GraphNode` | A node in the dependency graph |
| `GraphEdge` | A directed edge between two nodes |
| `ImpactResult` | Result of impact analysis for a selected node |
| `AIExplanation` | AI-generated analysis result |
| `RiskAssessment` | Risk level + contributing factors |

All models use **Pydantic v2** for validation and serialization.

---

## Technology Stack Summary

| Layer | Technology | Version | Reason |
|---|---|---|---|
| Backend language | Python | 3.11+ | Best analysis ecosystem |
| Web framework | FastAPI | 0.110+ | Async, typed, auto-docs |
| Data validation | Pydantic | v2 | Type-safe models |
| Graph library | NetworkX | 3.x | Standard Python graph library |
| Git integration | GitPython | 3.x | Mature Python git bindings |
| AI SDK | ibm-watsonx-ai | latest | Official IBM SDK |
| Frontend language | TypeScript | 5.x | Type safety |
| Frontend framework | React | 18.x | Component ecosystem |
| Build tool | Vite | 5.x | Fast, modern |
| Graph visualization | Cytoscape.js | 3.x | Purpose-built for networks |
| Styling | Tailwind CSS | 3.x | Rapid UI development |
| HTTP client | Axios | 1.x | Promise-based HTTP |
| Testing (backend) | pytest | 8.x | Standard Python test runner |
| Testing (frontend) | Vitest | 1.x | Vite-native test runner |
| Storage | SQLite + SQLAlchemy | — | Zero-setup, file-based |

---

## Folder Structure

```
xray/
├── backend/
│   ├── main.py                    # FastAPI application entry point
│   ├── config.py                  # Centralized configuration
│   ├── api/
│   │   ├── __init__.py
│   │   ├── upload.py              # Upload router
│   │   ├── scan.py                # Scan router
│   │   ├── graph.py               # Graph router
│   │   ├── impact.py              # Impact analysis router
│   │   └── explain.py             # AI explanation router
│   ├── models/
│   │   ├── __init__.py
│   │   ├── repository.py          # Repository model
│   │   ├── parsed_file.py         # ParsedFile model
│   │   ├── graph.py               # GraphNode, GraphEdge models
│   │   ├── impact.py              # ImpactResult model
│   │   └── ai.py                  # AIExplanation model
│   ├── repository/
│   │   ├── __init__.py
│   │   └── manager.py             # Repository upload/extract/cleanup
│   ├── analysis/
│   │   ├── __init__.py
│   │   ├── parser.py              # Python AST parser
│   │   ├── dependency_analyzer.py # Import/call graph extraction
│   │   ├── git_analyzer.py        # Git history analysis
│   │   ├── impact_analyzer.py     # Impact traversal engine
│   │   └── risk_scorer.py         # Risk level computation
│   ├── graph/
│   │   ├── __init__.py
│   │   ├── builder.py             # Build NetworkX graph
│   │   ├── queries.py             # Graph traversal queries
│   │   ├── serializer.py          # Graph → Cytoscape JSON
│   │   └── store.py               # Graph persistence
│   ├── ai/
│   │   ├── __init__.py
│   │   ├── interface.py           # AIService abstract base class
│   │   ├── watsonx_adapter.py     # IBM watsonx.ai adapter
│   │   ├── mock_adapter.py        # Mock adapter for testing
│   │   ├── prompt_builder.py      # Prompt construction
│   │   └── response_parser.py     # AI response parsing
│   └── tests/
│       ├── unit/
│       │   ├── test_parser.py
│       │   ├── test_dependency_analyzer.py
│       │   ├── test_impact_analyzer.py
│       │   ├── test_risk_scorer.py
│       │   └── test_graph_queries.py
│       ├── integration/
│       │   ├── test_scan_pipeline.py
│       │   └── test_ai_service.py
│       └── fixtures/
│           └── sample_repo/       # Sample Python project for tests
│
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/
│   │   │   └── client.ts          # Axios API client + typed endpoints
│   │   ├── components/
│   │   │   ├── GraphViewer.tsx    # Cytoscape.js wrapper
│   │   │   ├── NodePanel.tsx      # Selected node details
│   │   │   ├── ImpactPanel.tsx    # Impact results
│   │   │   ├── AIPanel.tsx        # AI explanation display
│   │   │   ├── RiskBadge.tsx      # Risk level badge
│   │   │   ├── FileTree.tsx       # Directory tree
│   │   │   └── UploadZone.tsx     # File upload component
│   │   ├── pages/
│   │   │   ├── UploadPage.tsx
│   │   │   └── GraphPage.tsx
│   │   ├── hooks/
│   │   │   ├── useGraph.ts
│   │   │   └── useImpact.ts
│   │   └── types/
│   │       └── index.ts           # Shared TypeScript types
│   └── tests/
│       └── components/
│
├── docs/                          # All documentation (this directory)
├── sample_repo/                   # Demo Python project for hackathon
├── .env.example                   # Environment variable template
├── .env                           # Local secrets (gitignored)
├── .gitignore
├── requirements.txt               # Backend Python dependencies
├── package.json                   # Frontend dependencies
└── README.md
```

---

## Architectural Decisions

### ADR-01: Python for backend
**Decision:** Python 3.11+
**Reason:** The `ast` module provides a built-in, zero-dependency Python parser. NetworkX is the
standard graph library. GitPython is mature. The ibm-watsonx-ai SDK is Python-first. No other
language combines all these requirements as cleanly.

### ADR-02: FastAPI over Flask/Django
**Decision:** FastAPI
**Reason:** Async support for non-blocking AI calls, automatic OpenAPI documentation, Pydantic
integration for request/response validation. Flask is synchronous; Django is too heavy for this scope.

### ADR-03: React + TypeScript over plain HTML
**Decision:** React 18 + TypeScript
**Reason:** The UI has several interconnected stateful components (graph selection, impact panel,
AI panel). React's component model handles this well. TypeScript ensures the API contract between
frontend and backend is maintained.

### ADR-04: Cytoscape.js over D3.js
**Decision:** Cytoscape.js
**Reason:** Cytoscape is purpose-built for network graphs with built-in layout algorithms, selection,
and interaction. D3 requires significantly more custom code for equivalent functionality.

### ADR-05: SQLite for storage
**Decision:** SQLite via SQLAlchemy
**Reason:** Zero infrastructure setup. All data (repository metadata, scan status, cached graphs)
fits comfortably in a local file-based database for MVP purposes.

### ADR-06: AI abstraction layer
**Decision:** `AIService` interface with pluggable adapters
**Reason:** Isolates all AI API calls behind a single interface. Enables mock testing without
real API calls. Makes it trivial to swap providers or add fallback behavior.

### ADR-07: NetworkX as graph representation
**Decision:** NetworkX directed graph (`DiGraph`)
**Reason:** Provides BFS, DFS, shortest path, reachability, and centrality algorithms out of the
box. JSON serialization support. Well-documented. Widely used in Python ecosystem.
