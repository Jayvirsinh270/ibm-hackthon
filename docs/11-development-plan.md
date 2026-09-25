# X-Ray — Development Plan

## Overview

Development follows an incremental, phase-by-phase approach. Each phase produces a working,
demonstrable result before the next phase begins. No phase skips the one before it.

Estimated complexity ratings:
- 🟢 **Low** — straightforward implementation, well-understood problem
- 🟡 **Medium** — requires design thought, some library learning, or non-trivial logic
- 🔴 **High** — complex logic, multiple moving parts, or significant risk

---

## Phase 0 — Documentation & Architecture ✅

**Goal:** Complete project documentation and architecture before any code is written.

| Task | Complexity | Status |
|---|---|---|
| Write all 13 documentation files | 🟡 Medium | ✅ Done |
| Define technology stack | 🟢 Low | ✅ Done |
| Design folder structure | 🟢 Low | ✅ Done |
| Design data models | 🟡 Medium | ✅ Done |
| Define AI abstraction layer | 🟡 Medium | ✅ Done |
| Define testing strategy | 🟢 Low | ✅ Done |

**Exit criteria:** All documentation complete. Architecture reviewed and approved.

---

## Phase 1 — Project Scaffolding

**Goal:** Create the project skeleton with all directories, configuration, and empty module stubs.

| Task | Complexity | Notes |
|---|---|---|
| Initialize Python backend (`main.py`, `config.py`) | 🟢 Low | FastAPI app with health check |
| Create all `backend/` module directories with `__init__.py` | 🟢 Low | |
| Set up `requirements.txt` with pinned dependencies | 🟢 Low | |
| Initialize React + TypeScript frontend with Vite | 🟢 Low | `npm create vite@latest` |
| Configure Tailwind CSS | 🟢 Low | |
| Install and configure Cytoscape.js | 🟢 Low | |
| Create frontend page stubs (`UploadPage`, `GraphPage`) | 🟢 Low | Empty components |
| Configure CORS between frontend and backend | 🟢 Low | |
| Write `.env.example` | 🟢 Low | |
| Verify frontend can call backend health check | 🟢 Low | End-to-end connectivity test |

**Exit criteria:** `uvicorn backend.main:app` starts without error. Frontend renders at `localhost:5173`. Frontend can call `GET /api/health` and receive a response.

**Estimated time:** 1-2 hours

---

## Phase 2 — Repository Manager

**Goal:** Users can upload a zip file and have it safely extracted and stored.

| Task | Complexity | Notes |
|---|---|---|
| Implement `RepositoryManager.upload()` | 🟡 Medium | Zip extraction with path traversal protection |
| Implement `RepositoryManager.list_files()` | 🟢 Low | Walk extracted directory, return .py paths |
| Implement `RepositoryManager.cleanup()` | 🟢 Low | Delete repo directory |
| Create SQLite database with `Repository` model | 🟡 Medium | SQLAlchemy setup |
| Implement `POST /api/upload` endpoint | 🟢 Low | |
| Implement `GET /api/structure/{repo_id}` endpoint | 🟢 Low | Return file tree as JSON |
| Implement `DELETE /api/repos/{repo_id}` endpoint | 🟢 Low | |
| Build `UploadZone` and `FileTree` frontend components | 🟡 Medium | File upload UI |
| Write unit tests for RepositoryManager | 🟡 Medium | Zip bomb + path traversal tests |

**Exit criteria:** User can upload a zip file through the UI, see the extracted file tree displayed, and delete the repository.

**Estimated time:** 2-3 hours

---

## Phase 3 — Python AST Parser

**Goal:** Parse Python files and extract structured information.

| Task | Complexity | Notes |
|---|---|---|
| Implement `SourceVisitor` AST node visitor | 🟡 Medium | Walk AST for classes, functions, imports, calls |
| Implement `parse_file()` function | 🟢 Low | Wrap ast.parse with error handling |
| Implement module name derivation from file path | 🟢 Low | |
| Implement test file detection | 🟢 Low | Filename pattern matching |
| Write unit tests for parser (all test cases from testing strategy) | 🟡 Medium | |

**Exit criteria:** All unit tests in `test_parser.py` pass. Parser correctly extracts classes, functions, imports, and calls from sample Python files without crashing on syntax errors.

**Estimated time:** 3-4 hours

---

## Phase 4 — Dependency Analyzer & Graph Builder

**Goal:** Convert parsed files into a navigable dependency graph.

| Task | Complexity | Notes |
|---|---|---|
| Implement module → file path resolution | 🟡 Medium | Handle relative imports |
| Implement import edge generation | 🟡 Medium | |
| Implement call edge generation | 🔴 High | Resolving call targets is heuristic |
| Implement inheritance edge generation | 🟡 Medium | |
| Implement test coverage edge generation | 🟡 Medium | By name convention + import analysis |
| Implement `GraphBuilder` with NetworkX | 🟡 Medium | Add nodes and edges correctly |
| Implement `GraphStore` (JSON persistence) | 🟢 Low | NetworkX node-link JSON |
| Implement `GraphSerializer` (→ Cytoscape JSON) | 🟡 Medium | Match Cytoscape data format |
| Implement `GET /api/graph/{repo_id}` endpoint | 🟢 Low | |
| Write unit tests for dependency analyzer | 🟡 Medium | |
| Write unit tests for graph queries | 🟢 Low | |
| Write integration test: pipeline → graph | 🟡 Medium | |

**Risk:** Call target resolution is inherently heuristic. A call like `manager.authenticate()` can
only be resolved if we can statically determine the type of `manager`. For MVP, use best-effort
name matching and document the limitation clearly.

**Exit criteria:** Running the pipeline on the sample repo produces a persisted graph with correct import and test edges. `GET /api/graph/{repo_id}` returns Cytoscape-compatible JSON.

**Estimated time:** 4-6 hours

---

## Phase 5 — Git Analyzer

**Goal:** Enrich the graph with Git change metadata.

| Task | Complexity | Notes |
|---|---|---|
| Implement `GitAnalyzer.analyze()` using GitPython | 🟡 Medium | Iterate commits, count file changes |
| Implement co-change detection | 🟡 Medium | Files in same commit are co-changed |
| Integrate GitData into graph node annotations | 🟢 Low | Add `git_churn` to node metadata |
| Handle missing `.git` directory gracefully | 🟢 Low | |
| Write unit tests for git analyzer | 🟡 Medium | Use a small fixture git repo |

**Exit criteria:** Graph nodes are annotated with `git_churn` when a `.git` directory is present. Pipeline completes without errors when `.git` is absent.

**Estimated time:** 2-3 hours

---

## Phase 6 — Impact Analyzer & Risk Scorer

**Goal:** Given a selected node, compute the full impact set and a risk score.

| Task | Complexity | Notes |
|---|---|---|
| Implement `ImpactAnalyzer.analyze()` with BFS traversal | 🟡 Medium | nx.descendants + reversed graph |
| Implement `max_depth` calculation | 🟢 Low | Shortest path from selected node |
| Implement test node separation | 🟢 Low | Filter by node type |
| Implement `RiskScorer.score()` | 🟡 Medium | Weighted formula from architecture doc |
| Implement `POST /api/impact/{repo_id}` endpoint | 🟢 Low | |
| Write unit tests for impact analyzer | 🟡 Medium | |
| Write unit tests for risk scorer | 🟢 Low | |
| Write integration test: pipeline → impact | 🟡 Medium | |

**Exit criteria:** Selecting `auth.login` in the sample repo returns a non-empty impact set including `api.users`, related tests, and a risk level badge.

**Estimated time:** 3-4 hours

---

## Phase 7 — Interactive Graph Visualization

**Goal:** Display the dependency graph in the browser with click-to-select interaction.

| Task | Complexity | Notes |
|---|---|---|
| Implement `GraphViewer` component with Cytoscape.js | 🔴 High | Layout, styles, event handling |
| Implement node color coding by type | 🟢 Low | |
| Implement edge style by relationship type | 🟢 Low | |
| Implement node selection → trigger impact query | 🟡 Medium | React state + API call |
| Implement zoom, pan, fit-to-screen controls | 🟢 Low | Cytoscape built-in |
| Implement `NodePanel` sidebar | 🟡 Medium | Show node details on selection |
| Implement impact highlighting (color affected nodes) | 🟡 Medium | Update Cytoscape node classes |
| Implement `ImpactPanel` | 🟡 Medium | List of affected components |
| Implement `RiskBadge` component | 🟢 Low | |
| Write frontend component tests | 🟢 Low | |

**Risk:** Graph layout can be slow or visually cluttered for large repositories. Use `cola` layout
algorithm which handles dense graphs better than random layout. Limit initial view to top-level
file nodes with drill-down on click.

**Exit criteria:** User can see the graph, click a node, see highlighted impact, and a sidebar with affected component details and risk badge.

**Estimated time:** 5-8 hours

---

## Phase 8 — watsonx.ai Integration

**Goal:** Connect the AI service layer to IBM watsonx.ai and display AI explanations.

| Task | Complexity | Notes |
|---|---|---|
| Configure `WatsonxAdapter` with environment variables | 🟢 Low | |
| Implement `PromptBuilder.build_impact_prompt()` | 🟡 Medium | Structured prompt from impact data |
| Implement `ResponseParser.parse_impact_explanation()` | 🟡 Medium | Extract sections from response text |
| Implement `POST /api/explain/{repo_id}` endpoint | 🟢 Low | |
| Implement `AIPanel` frontend component | 🟡 Medium | Show explanation, risk areas, plan, tests |
| Implement "Explain with AI" button in UI | 🟢 Low | |
| Implement AI unavailable fallback display | 🟢 Low | |
| Integration test with mock adapter | 🟢 Low | |
| Test with real watsonx.ai credentials | 🟡 Medium | Requires API key |

**Risk:** watsonx.ai model availability and response quality are external dependencies. The system
must work gracefully without a valid API key (using mock adapter).

**Exit criteria:** Clicking "Explain with AI" sends a structured prompt and displays a formatted explanation, migration plan, risk areas, and test recommendations. If AI is unavailable, a friendly message is shown and deterministic results remain visible.

**Estimated time:** 3-5 hours

---

## Phase 9 — Testing

**Goal:** Write and verify all tests defined in the testing strategy.

| Task | Complexity | Notes |
|---|---|---|
| Complete all unit tests (target: 80% coverage) | 🟡 Medium | |
| Complete integration tests | 🟡 Medium | |
| Run end-to-end test on demo scenario | 🟡 Medium | |
| Fix any failures discovered during testing | Variable | |
| Review error handling in all modules | 🟢 Low | |

**Estimated time:** 3-4 hours

---

## Phase 10 — Sample Repository & Demo Polish

**Goal:** Create a compelling demo repository and polish the UI for presentation.

| Task | Complexity | Notes |
|---|---|---|
| Build `sample_repo/` — a realistic Python project | 🟡 Medium | Auth, API, services, tests structure |
| Verify demo scenario works end-to-end | 🟢 Low | |
| UI polish: consistent spacing, loading states, transitions | 🟡 Medium | |
| Add loading indicators during scan and AI request | 🟢 Low | |
| Add clear "Deterministic" vs "AI-generated" labels throughout | 🟢 Low | |
| Write demo walkthrough script | 🟢 Low | See demo-scenario.md |
| Rehearse demo | 🟢 Low | |

**Estimated time:** 3-4 hours

---

## Phase 11 — Demo Preparation

**Goal:** Ensure a flawless demonstration under presentation conditions.

| Task | Complexity | Notes |
|---|---|---|
| Verify application starts cleanly on demo machine | 🟢 Low | |
| Pre-load sample repository to avoid slow upload during demo | 🟢 Low | |
| Prepare fallback: screenshots in case of technical issues | 🟢 Low | |
| Prepare talking points for each demo step | 🟢 Low | |
| Test AI responses on actual watsonx.ai credentials | 🟡 Medium | |

**Estimated time:** 1-2 hours

---

## Complexity & Risk Summary by Phase

| Phase | Name | Complexity | Key Risk |
|---|---|---|---|
| 0 | Documentation | 🟡 Medium | Scope creep in planning |
| 1 | Scaffolding | 🟢 Low | None significant |
| 2 | Repository Manager | 🟡 Medium | Zip security edge cases |
| 3 | Python Parser | 🟡 Medium | Edge cases in AST visitor |
| 4 | Dependency Analyzer | 🔴 High | Call resolution is heuristic |
| 5 | Git Analyzer | 🟡 Medium | Performance on large repos |
| 6 | Impact Analyzer | 🟡 Medium | Correctness of traversal |
| 7 | Graph Visualization | 🔴 High | Cytoscape.js layout + UX |
| 8 | watsonx.ai Integration | 🟡 Medium | External dependency; API availability |
| 9 | Testing | 🟡 Medium | Coverage gaps |
| 10 | Demo Polish | 🟡 Medium | Sample repo quality |
| 11 | Demo Prep | 🟢 Low | Technical issues at demo time |

---

## Questions Requiring Human Decisions

Before implementation begins, the following need to be confirmed:

| # | Question | Why It Matters |
|---|---|---|
| 1 | Which watsonx.ai model should be used? | Affects prompt design and response quality |
| 2 | Should the demo use a pre-analyzed repo (fast) or live analysis (impressive)? | Trade-off between demo speed and impact |
| 3 | Should the call edge analysis be best-effort or explicitly marked "limited"? | User expectation management |
| 4 | Is there a requirement for the frontend to work offline (no watsonx.ai)? | Determines how important the mock adapter path is |
| 5 | Maximum repository size for demo purposes? | Affects demo repo design |
