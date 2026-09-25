# X-Ray — MVP Scope

## Purpose of This Document

This document defines exactly what is in scope for the Minimum Viable Product (MVP).

Everything listed here must work end-to-end before the hackathon demonstration.
Anything not listed here is either explicitly deferred to future releases or is not planned at all.

---

## MVP Summary

The MVP is a **working, end-to-end impact analysis tool** for **Python repositories**.

A user can:
1. Upload a Python project
2. See an interactive dependency graph of its components
3. Click a component and ask "what happens if I change this?"
4. Receive a deterministic impact report (direct + indirect affected components, related tests)
5. Receive an AI-generated explanation, risk assessment, and migration plan

---

## Language Support — MVP

| Language | MVP Support | Rationale |
|---|---|---|
| **Python** | ✅ Full support | Best parser ecosystem (`ast`, `libcst`); clear, readable structure |
| JavaScript | ❌ Deferred | Parser complexity; time constraint |
| TypeScript | ❌ Deferred | Requires separate toolchain |
| Java | ❌ Deferred | JVM ecosystem; different toolchain |
| Other | ❌ Not planned | Out of scope |

**Rationale for Python-first:** Python is the dominant language in AI/ML projects (making it
highly relevant for the hackathon audience), has an excellent built-in AST module, and produces
clean, parseable code structure. The demo scenario (authentication replacement) is naturally
expressible in Python.

---

## In-Scope Features (MVP)

### ✅ Repository Upload

- User uploads a `.zip` file containing a Python project
- OR user provides a local path (for development/demo)
- System extracts and stores the repository in an isolated temporary directory

### ✅ Project Structure Display

- Directory tree view of the repository
- File count, detected language summary
- Clear display of project layout in the UI

### ✅ Python Code Analysis

- Parse all `.py` files using Python `ast` module
- Extract: modules, classes, functions, imports
- Extract: function call relationships (within-file and cross-file)
- Extract: class inheritance (`class Foo(Base)`)
- Identify test files (files matching `test_*.py` or `*_test.py`)
- Link test functions to the modules/functions they appear to test

### ✅ Dependency Graph Generation

- Build a directed graph using NetworkX
- Nodes: files, classes, functions
- Edges: imports, function calls, inheritance, test coverage
- Persist graph as JSON for re-use without re-scanning
- Expose graph data via API

### ✅ Git History Analysis (if `.git` exists)

- Extract file change frequency (which files change most often)
- Identify co-change patterns (files that are frequently changed together)
- Surface this data as additional context in impact analysis
- Gracefully skip if no `.git` directory is present

### ✅ Interactive Visualization

- Cytoscape.js graph rendered in the browser
- Nodes colored by type: file (blue), class (purple), function (green), test (orange)
- Edges styled by type: import (solid), call (dashed), inheritance (dotted), test (light)
- Click a node to select it and trigger impact analysis
- Zoom, pan, fit-to-screen controls
- Node detail panel showing: name, type, file path, line number

### ✅ Impact Analysis Engine

- Given a selected node, compute:
  - **Direct dependencies**: components that directly import or call the selected node
  - **Reverse dependencies**: components that the selected node imports or calls
  - **Transitive impact**: full reachable set in both directions
  - **Related tests**: test functions/files that cover the affected set
  - **Risk level**: High / Medium / Low based on impact breadth
- All results clearly marked as **deterministic** (no AI involved)

### ✅ AI Explanation (watsonx.ai)

- Given the impact analysis result, send a structured prompt to watsonx.ai
- Receive and display:
  - Plain-language explanation of why components are affected
  - Risk areas requiring special attention
  - Suggested migration/change plan (step-by-step)
  - Recommended tests to run or add
- All AI results clearly labelled as **AI-generated suggestions**
- Graceful fallback: if AI is unavailable, deterministic results are still shown

### ✅ Risk Level Display

- Visual risk badge: 🔴 High / 🟡 Medium / 🟢 Low
- Risk is computed deterministically from impact breadth + depth + test coverage
- AI may add additional qualitative risk assessment

### ✅ Error Handling

- Unsupported file types are skipped silently with a log entry
- Parse failures for individual files are caught and reported without stopping analysis
- AI failures do not prevent deterministic results from being displayed
- All errors produce user-facing messages (not stack traces)

---

## Out-of-Scope for MVP (Deferred)

| Feature | Reason Deferred |
|---|---|
| JavaScript/TypeScript support | Parser complexity, time constraint |
| GitHub URL input | OAuth/API complexity |
| Pull request analysis | Requires GitHub integration |
| Automated code modifications | Out of product scope for MVP |
| Multi-user support | Not required for demo |
| User authentication | Not required for demo |
| Database persistence beyond session | SQLite is sufficient for MVP |
| CI/CD integration | Post-MVP |
| Architecture history tracking | Post-MVP |
| Technical debt scoring | Post-MVP |
| Security vulnerability scanning | Post-MVP |
| Before/after diff comparison | Post-MVP (complex UI) |
| Performance analysis | Post-MVP |
| Database schema analysis | Post-MVP |

---

## MVP Success Criteria

The MVP is considered complete when a judge can:

1. Open the application in a browser
2. Upload the provided sample Python repository
3. See an interactive dependency graph of the project
4. Click on `auth/login.py` or the `authenticate()` function
5. See a list of directly and indirectly affected components
6. See related tests highlighted
7. See a risk level badge
8. See an AI-generated explanation and migration plan
9. Understand immediately that this is **deterministic analysis + AI explanation** — not magic

All of the above must work without error during a live demonstration.

---

## Sample Repository for Demo

A sample Python repository will be created specifically for the demo. See
[`12-demo-scenario.md`](./12-demo-scenario.md) for the full scenario design.

The sample repository will include:

- An authentication module (`auth/`)
- API routes that use authentication (`api/`)
- Services that require authenticated users (`services/`)
- A middleware layer (`middleware/`)
- Models and utilities (`models/`, `utils/`)
- A test suite (`tests/`)
- A `.git` directory with a few sample commits

This gives X-Ray a rich graph to analyze without being overwhelming.
