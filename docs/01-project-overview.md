# X-Ray — Project Overview

## Name

**X-Ray — Intelligent Software Change Impact Analyzer**

## One-Line Description

X-Ray helps developers understand what could break before they change their software.

---

## Vision

Software systems are complex, interconnected, and often poorly documented. When a developer
changes one part of an application, the ripple effects can be invisible — until something breaks
in production.

X-Ray turns those invisible connections into a visible, interactive map. Before a developer
touches a single line of code, X-Ray shows them the full potential impact of that change:
which files are connected, which tests are relevant, where the risk is highest, and what a
safe migration path looks like.

---

## Core Value Proposition

> "X-Ray helps developers understand the potential consequences of changing software **before** they make the change."

This is not a code generator. This is not a linter. This is a **change-impact intelligence tool**.

---

## What X-Ray Does

1. **Scans** a software repository and builds a structural model of the project.
2. **Extracts** relationships between files, modules, classes, functions, imports, and tests.
3. **Visualizes** those relationships as an interactive dependency graph.
4. **Analyzes** the blast radius of a proposed change — which components are directly or indirectly affected.
5. **Explains** the impact using AI — in plain language, with risk levels, migration suggestions, and test recommendations.

---

## What X-Ray Does NOT Do

- It does not automatically make changes to the codebase.
- It does not guarantee it will find every possible bug.
- It does not replace proper testing, code review, or engineering judgment.
- It does not send entire codebases to external AI services without filtering.

X-Ray augments developer judgment — it does not replace it.

---

## Two Layers of Analysis

X-Ray deliberately separates two types of output:

| Layer | Type | Examples |
|---|---|---|
| **Deterministic** | Facts extracted from the code | File imports, function calls, test coverage, Git changes |
| **AI-Assisted** | Interpretations and recommendations | Risk levels, migration plans, plain-language explanations |

The UI clearly labels which results are deterministic facts and which are AI-generated suggestions.

---

## Target Users

- **Individual developers** working on unfamiliar or legacy codebases
- **Tech leads** reviewing the safety of a proposed refactor
- **Teams** onboarding onto a new codebase
- **Hackathon judges** who need to immediately understand the product value

---

## IBM Technologies

| Technology | Role |
|---|---|
| **IBM Bob** | AI development partner throughout the entire build process |
| **IBM watsonx.ai** | AI provider for impact explanation, risk analysis, and migration planning |

---

## Project Status

This document describes the **planned MVP**. The project is currently in the documentation and
architecture phase. No application code has been written yet.

See [`11-development-plan.md`](./11-development-plan.md) for the phased implementation plan.

---

## Document Map

| Document | Purpose |
|---|---|
| [`01-project-overview.md`](./01-project-overview.md) | This document — high-level product description |
| [`02-problem-statement.md`](./02-problem-statement.md) | The problem being solved in depth |
| [`03-requirements.md`](./03-requirements.md) | Functional and non-functional requirements |
| [`04-mvp-scope.md`](./04-mvp-scope.md) | What is in scope for the MVP |
| [`05-architecture.md`](./05-architecture.md) | System architecture and component design |
| [`06-data-flow.md`](./06-data-flow.md) | How data flows through the system |
| [`07-ai-architecture.md`](./07-ai-architecture.md) | AI integration design and abstraction layer |
| [`08-analysis-engine.md`](./08-analysis-engine.md) | Code analysis and dependency extraction design |
| [`09-security.md`](./09-security.md) | Security considerations and controls |
| [`10-testing-strategy.md`](./10-testing-strategy.md) | Testing approach and test plan |
| [`11-development-plan.md`](./11-development-plan.md) | Phased development plan with complexity estimates |
| [`12-demo-scenario.md`](./12-demo-scenario.md) | The primary demo walkthrough |
| [`13-hackathon-strategy.md`](./13-hackathon-strategy.md) | Hackathon presentation and judging strategy |
