# X-Ray — Requirements

## 1. Functional Requirements

### 1.1 Repository Management

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | User can upload a zipped repository or provide a local directory path | Must Have |
| FR-02 | System scans the uploaded repository and identifies all source files | Must Have |
| FR-03 | System displays the project directory structure | Must Have |
| FR-04 | System detects the primary programming language(s) present | Must Have |
| FR-05 | System gracefully skips unsupported files without crashing | Must Have |
| FR-06 | System isolates uploaded repositories from each other | Must Have |
| FR-07 | User can remove/clear a previously uploaded repository | Should Have |
| FR-08 | System supports GitHub URL input as an alternative to upload | Could Have |

---

### 1.2 Code Analysis

| ID | Requirement | Priority |
|---|---|---|
| FR-10 | System parses Python source files and extracts modules, classes, and functions | Must Have |
| FR-11 | System extracts import statements and resolves internal dependencies | Must Have |
| FR-12 | System extracts function call relationships within and across files | Must Have |
| FR-13 | System identifies test files and links them to the code they test | Must Have |
| FR-14 | System extracts class inheritance relationships | Should Have |
| FR-15 | System identifies configuration files and their role | Should Have |
| FR-16 | System analyzes Git history for change frequency and co-change patterns | Should Have |
| FR-17 | System supports JavaScript/TypeScript parsing | Could Have |

---

### 1.3 Dependency Graph

| ID | Requirement | Priority |
|---|---|---|
| FR-20 | System generates a directed dependency graph of all identified components | Must Have |
| FR-21 | Graph nodes represent files, modules, classes, and functions | Must Have |
| FR-22 | Graph edges represent imports, function calls, and inheritance | Must Have |
| FR-23 | Graph is persisted so it can be queried without re-scanning | Must Have |
| FR-24 | System can compute all direct dependencies of a given node | Must Have |
| FR-25 | System can compute all transitive (indirect) dependencies of a given node | Must Have |
| FR-26 | System can compute reverse dependencies (what depends on this node) | Must Have |

---

### 1.4 Interactive Visualization

| ID | Requirement | Priority |
|---|---|---|
| FR-30 | Frontend displays the dependency graph as an interactive visual | Must Have |
| FR-31 | User can click a node to select it and view its details | Must Have |
| FR-32 | User can zoom, pan, and navigate the graph | Must Have |
| FR-33 | Selected node and its affected neighbors are visually highlighted | Must Have |
| FR-34 | Nodes are color-coded by type (file, class, function, test) | Should Have |
| FR-35 | Edges are styled to differentiate relationship types | Should Have |
| FR-36 | User can filter the graph by node type or file path | Could Have |
| FR-37 | User can search/jump to a specific node by name | Should Have |

---

### 1.5 Impact Analysis

| ID | Requirement | Priority |
|---|---|---|
| FR-40 | User can select a component and trigger impact analysis | Must Have |
| FR-41 | System returns directly affected components (1-hop) | Must Have |
| FR-42 | System returns indirectly affected components (transitive) | Must Have |
| FR-43 | System returns related test files and functions | Must Have |
| FR-44 | System assigns a risk level to the analysis (High / Medium / Low) | Must Have |
| FR-45 | System distinguishes deterministic results from AI-assisted results | Must Have |
| FR-46 | System provides a human-readable explanation of the impact | Must Have |
| FR-47 | System suggests a structured change/migration plan | Must Have |
| FR-48 | System recommends tests to run or add | Must Have |

---

### 1.6 AI Explanation Layer

| ID | Requirement | Priority |
|---|---|---|
| FR-50 | AI explains why specific components are affected | Must Have |
| FR-51 | AI identifies potential risk areas based on the impact set | Must Have |
| FR-52 | AI generates a structured migration plan for the proposed change | Must Have |
| FR-53 | AI recommends which existing tests to run and what new tests are needed | Must Have |
| FR-54 | AI response is clearly labelled as AI-generated | Must Have |
| FR-55 | If AI is unavailable, deterministic analysis still functions | Must Have |
| FR-56 | AI can explain the overall architecture of the repository | Should Have |
| FR-57 | AI can compare a before/after diff and comment on impact | Could Have |

---

## 2. Non-Functional Requirements

### 2.1 Performance

| ID | Requirement |
|---|---|
| NFR-01 | Repository scan of a 500-file Python project should complete within 60 seconds |
| NFR-02 | Impact analysis query should return results within 5 seconds (excluding AI) |
| NFR-03 | AI explanation should return within 30 seconds |
| NFR-04 | Frontend graph rendering should handle up to 500 nodes without visible lag |

---

### 2.2 Reliability

| ID | Requirement |
|---|---|
| NFR-10 | A failure in one analysis module must not crash the entire analysis pipeline |
| NFR-11 | A failure in the AI layer must not prevent deterministic analysis from completing |
| NFR-12 | The application must provide clear error messages for all failure scenarios |
| NFR-13 | The system must not lose analysis results due to a transient error |

---

### 2.3 Security

| ID | Requirement |
|---|---|
| NFR-20 | API credentials must never be hardcoded in source code |
| NFR-21 | API credentials must be loaded from environment variables |
| NFR-22 | Uploaded repositories must be stored in isolated temporary directories |
| NFR-23 | Uploaded repositories must not be exposed to other users |
| NFR-24 | Source code sent to AI services must be minimized and filtered |
| NFR-25 | Temporary files must be cleaned up after processing |

---

### 2.4 Maintainability

| ID | Requirement |
|---|---|
| NFR-30 | Each module must have a single, clearly defined responsibility |
| NFR-31 | No source file in the backend should exceed 400 lines of code |
| NFR-32 | All public functions must include type hints |
| NFR-33 | All modules must include module-level docstrings |
| NFR-34 | Configuration must be centralized — not spread across files |
| NFR-35 | Logging must be structured and use Python's standard logging module |

---

### 2.5 Testability

| ID | Requirement |
|---|---|
| NFR-40 | Each analysis module must be independently testable without a running server |
| NFR-41 | The AI layer must be mockable for testing without real API calls |
| NFR-42 | A sample test repository must exist for integration and end-to-end tests |
| NFR-43 | Unit test coverage for core analysis modules should be ≥ 80% |

---

### 2.6 Developer Experience

| ID | Requirement |
|---|---|
| NFR-50 | Project must run locally with a single setup command after `.env` is configured |
| NFR-51 | A `.env.example` file must document all required environment variables |
| NFR-52 | Backend API must be documented via FastAPI's auto-generated OpenAPI spec |
| NFR-53 | All third-party dependencies must be pinned in `requirements.txt` |

---

## 3. Constraints

| Constraint | Description |
|---|---|
| **Time** | Hackathon scope — MVP must be buildable in a few days |
| **Language support** | MVP targets Python only; other languages are future scope |
| **AI provider** | IBM watsonx.ai is the target provider |
| **Infrastructure** | Must run on a local development machine without cloud infrastructure |
| **Open source** | All libraries and tools must be free and open source |

---

## 4. Out of Scope (MVP)

The following are explicitly **not** in scope for the MVP:

- Multi-user accounts or authentication for the X-Ray application itself
- GitHub/GitLab OAuth integration
- Automated code modification or patching
- Support for compiled languages (Java, C++, Go) in MVP
- Production deployment or containerization
- Real-time collaborative analysis
- Historical architecture tracking over time
- CI/CD pipeline integration
