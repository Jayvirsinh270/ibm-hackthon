# X-Ray — Testing Strategy

## Philosophy

Tests exist to give the team confidence that the system works correctly and that changes do not
introduce regressions. Tests should be fast to run, easy to understand, and focused on behavior —
not implementation details.

The testing pyramid for X-Ray:

```
        ┌──────────┐
        │  E2E (1) │     Slowest, highest confidence, fewest
        ├──────────┤
        │  Integ.  │     Medium speed, verifies module wiring
        │  (8-12)  │
        ├──────────────┤
        │   Unit Tests  │  Fast, isolated, many
        │   (30-50+)    │
        └──────────────────┘
```

---

## 1. Unit Tests

### Backend — `backend/tests/unit/`

Unit tests cover individual modules in isolation. The AI layer is always mocked.

---

#### `test_parser.py`

| Test | Description |
|---|---|
| `test_parse_simple_module` | Parse a file with a single function; verify function extracted |
| `test_parse_class_with_methods` | Parse a class with methods; verify class and methods extracted |
| `test_parse_import_statements` | Parse various import forms; verify import names and modules |
| `test_parse_class_inheritance` | Parse `class Child(Parent)`; verify base class recorded |
| `test_parse_function_calls` | Parse a function that calls another; verify call recorded |
| `test_parse_test_file_detected` | File named `test_login.py` should set `is_test=True` |
| `test_parse_syntax_error` | File with invalid Python; should return `parse_error`, not raise |
| `test_parse_empty_file` | Empty file should return empty lists, not raise |
| `test_parse_async_function` | `async def foo()` should be extracted as a function |
| `test_module_name_from_path` | `auth/login.py` → `auth.login` |

**Test fixture pattern:**
```python
# Use inline string fixtures — no real file I/O needed for unit tests
SOURCE = """
class AuthManager:
    def authenticate(self, username: str) -> bool:
        return self._check(username)
"""

def test_parse_class_with_methods():
    result = parse_source(SOURCE, path="auth/login.py")
    assert len(result.classes) == 1
    assert result.classes[0].name == "AuthManager"
    assert "authenticate" in result.classes[0].methods
```

---

#### `test_dependency_analyzer.py`

| Test | Description |
|---|---|
| `test_import_edge_resolved` | Import of a known module creates an IMPORT edge |
| `test_import_unresolved_skipped` | Import of `requests` (external) creates no edge |
| `test_call_edge_resolved` | Call to a known function creates a CALL edge |
| `test_inheritance_edge_resolved` | `class B(A)` creates an INHERITS edge to A's node |
| `test_test_file_linked_by_name` | `test_login.py` links to `login.py` via TEST_COVERS |
| `test_test_file_linked_by_import` | Test that imports `auth.login` links to it via TEST_COVERS |
| `test_relative_import_resolved` | `from . import utils` resolves correctly |
| `test_node_id_format` | Node IDs follow the dotted-path convention |
| `test_duplicate_edges_not_added` | Same import referenced twice → only one edge |

---

#### `test_impact_analyzer.py`

| Test | Description |
|---|---|
| `test_direct_dependencies` | Node with 2 direct imports; `direct_affected` has 2 items |
| `test_reverse_dependencies` | 3 files import node; reverse analysis finds all 3 |
| `test_transitive_impact` | A→B→C; selecting A returns B and C in transitive set |
| `test_test_nodes_separated` | Test nodes appear in `related_tests`, not `transitive_affected` |
| `test_selected_node_not_in_result` | The selected node must not appear in its own impact set |
| `test_unknown_node_raises` | Invalid `node_id` raises `NodeNotFoundError` |
| `test_isolated_node` | Node with no edges returns empty impact sets |
| `test_max_depth_correct` | Chain A→B→C→D; `max_depth` = 3 |

---

#### `test_risk_scorer.py`

| Test | Description |
|---|---|
| `test_high_risk_many_direct` | 15 direct affected → HIGH risk |
| `test_low_risk_few_affected` | 2 direct, 3 transitive → LOW risk |
| `test_no_test_coverage_increases_risk` | 0% test coverage pushes score up |
| `test_full_test_coverage_reduces_risk` | 100% coverage reduces risk score |
| `test_contributing_factors_populated` | Risk result contains human-readable factors |
| `test_risk_level_thresholds` | Score 0.70 → HIGH, 0.50 → MEDIUM, 0.20 → LOW |

---

#### `test_graph_queries.py`

| Test | Description |
|---|---|
| `test_get_node_by_id` | Returns correct node data for a valid ID |
| `test_get_neighbors` | Returns correct direct neighbors |
| `test_get_reachable` | BFS returns all reachable nodes |
| `test_graph_serialization` | Graph serializes to valid Cytoscape JSON |
| `test_graph_roundtrip` | Graph → JSON → reconstruct → same nodes and edges |

---

#### `test_git_analyzer.py`

| Test | Description |
|---|---|
| `test_no_git_directory` | Returns `GitData(available=False)` gracefully |
| `test_churn_calculated` | File with 5 commits has `commit_count=5` |
| `test_co_change_detected` | Two files changed in same commit appear in each other's `co_changed_with` |
| `test_corrupt_git_returns_unavailable` | Handles git errors without raising |

---

### Frontend — `frontend/tests/`

| Test | Description |
|---|---|
| `RiskBadge.test.tsx` | Renders HIGH/MEDIUM/LOW with correct colors |
| `ImpactPanel.test.tsx` | Shows deterministic results; AI panel hidden when unavailable |
| `AIPanel.test.tsx` | Shows "AI unavailable" message when `available=false` |
| `GraphViewer.test.tsx` | Renders with mock graph data; node click calls handler |
| `FileTree.test.tsx` | Renders directory structure correctly |

---

## 2. Integration Tests

### `test_scan_pipeline.py`

Tests the full pipeline from file paths → stored graph using a small real fixture repository.

```
fixture: backend/tests/fixtures/sample_repo/
├── auth/
│   ├── __init__.py
│   └── login.py
├── api/
│   └── users.py
└── tests/
    └── test_login.py
```

| Test | Description |
|---|---|
| `test_pipeline_produces_graph` | Run pipeline on sample repo; assert graph has expected nodes |
| `test_import_edges_present` | `api/users.py` imports `auth/login.py`; edge must exist |
| `test_test_coverage_edges` | `tests/test_login.py` → `auth/login.py` edge exists |
| `test_impact_on_login_module` | Impact analysis on `auth.login` returns `api.users` in affected set |
| `test_git_analysis_optional` | Pipeline completes correctly if sample repo has no `.git` |
| `test_parse_failure_does_not_stop_pipeline` | Insert one broken .py file; other files still parsed |

---

### `test_ai_service.py`

Tests the AI service layer with the mock adapter (no real API calls).

| Test | Description |
|---|---|
| `test_mock_adapter_returns_explanation` | MockAdapter returns a valid AIExplanation |
| `test_unavailable_adapter_returns_fallback` | Adapter in unavailable state returns `AIExplanation.unavailable()` |
| `test_prompt_builder_produces_non_empty_prompt` | PromptBuilder creates a non-empty, non-None prompt string |
| `test_response_parser_extracts_sections` | Parser correctly extracts EXPLANATION/RISK_AREAS/etc. from sample response |
| `test_response_parser_handles_missing_section` | Missing section in AI response returns safe default |

---

## 3. End-to-End Test

One full end-to-end test using the demo sample repository.

### `test_e2e_demo_scenario.py`

**Purpose:** Verify the complete user journey works without errors.

**Prerequisites:**
- Sample repo at `sample_repo/` (the demo project)
- Backend running (or using FastAPI TestClient)
- Mock AI adapter configured (no real API calls)

**Steps:**

```python
def test_full_demo_scenario():
    client = TestClient(app)

    # Step 1: Upload repository
    with open("sample_repo.zip", "rb") as f:
        response = client.post("/api/upload", files={"file": f})
    assert response.status_code == 200
    repo_id = response.json()["repo_id"]

    # Step 2: Trigger scan
    response = client.post(f"/api/scan/{repo_id}")
    assert response.status_code == 200

    # Step 3: Wait for scan to complete (poll status)
    for _ in range(10):
        response = client.get(f"/api/status/{repo_id}")
        if response.json()["status"] == "ready":
            break
        time.sleep(1)
    assert response.json()["status"] == "ready"

    # Step 4: Get graph
    response = client.get(f"/api/graph/{repo_id}")
    assert response.status_code == 200
    graph = response.json()
    assert len(graph["nodes"]) > 0

    # Step 5: Run impact analysis on auth.login
    response = client.post(f"/api/impact/{repo_id}", json={"node_id": "auth.login"})
    assert response.status_code == 200
    impact = response.json()
    assert len(impact["direct_affected"]) > 0
    assert impact["risk"]["level"] in ["HIGH", "MEDIUM", "LOW"]
    assert impact["analysis_type"] == "deterministic"

    # Step 6: Get AI explanation (mock)
    response = client.post(f"/api/explain/{repo_id}", json={
        "node_id": "auth.login",
        "change_description": "Replace authentication system"
    })
    assert response.status_code == 200
    explanation = response.json()
    assert explanation["analysis_type"] == "ai_assisted"
    assert len(explanation["migration_plan"]) > 0
```

---

## 4. Test Infrastructure

### Backend

```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["backend/tests"]
asyncio_mode = "auto"

[tool.coverage.run]
source = ["backend"]
omit = ["backend/tests/*"]
```

Run tests:
```bash
pytest backend/tests/unit/          # unit tests only (fast)
pytest backend/tests/integration/   # integration tests
pytest backend/tests/               # all tests
pytest --cov=backend --cov-report=term-missing  # with coverage
```

### Frontend

```bash
npm run test          # Vitest in watch mode
npm run test:run      # Vitest single run
npm run test:coverage # with coverage
```

---

## 5. CI Strategy (Future)

For post-MVP, a CI pipeline should run:
1. `pytest backend/tests/unit/` on every commit
2. `pytest backend/tests/` on every pull request
3. `npm run test:run` on every commit
4. Coverage report — fail if unit coverage drops below 80%

For the hackathon MVP, tests are run manually.
