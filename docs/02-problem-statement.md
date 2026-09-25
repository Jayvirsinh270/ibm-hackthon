# X-Ray — Problem Statement

## The Core Problem

Modern software systems are deeply interconnected. A change in one component can propagate
through dozens of other components in ways that are not immediately obvious — even to the
developer who built the system.

**Developers regularly make changes without a complete picture of their consequences.**

---

## The Scale of the Problem

Consider a mid-sized web application. It might contain:

- 200+ source files
- 50+ modules
- Dozens of classes and hundreds of functions
- Multiple external dependencies
- API routes, database models, and service layers
- A test suite spread across many files
- Years of Git history

When a developer modifies one function in this system, the following questions arise:

1. Which other files import this module?
2. Which classes inherit from this class?
3. Which API endpoints depend on this service?
4. Which tests cover this functionality?
5. Which database operations are affected?
6. Has this code been changed before? What broke last time?

A developer answering these questions manually must read through dozens of files,
trace import chains, search for usages, and guess at indirect relationships.
This takes time and is prone to human error.

---

## Real-World Consequences

When developers make changes without understanding full impact:

| Consequence | Description |
|---|---|
| **Regressions** | Features that worked before now fail silently |
| **Broken dependencies** | Modules that depend on changed interfaces break |
| **Security gaps** | Authentication or authorization changes introduce vulnerabilities |
| **Failed tests** | Tests fail in unexpected places due to hidden dependencies |
| **Debugging time** | Developers spend hours tracing the source of a breakage |
| **Production incidents** | Changes that passed local testing fail in production |
| **Technical fear** | Developers become afraid to touch certain parts of the codebase |

The last point — **technical fear** — is particularly damaging. Teams working with legacy or
poorly understood codebases often avoid necessary changes because the risk feels unquantifiable.
This leads to accumulating technical debt and a codebase that becomes increasingly difficult to maintain.

---

## A Concrete Example

A developer is asked to replace the authentication system in an existing application.

They open `auth/login.py`. It looks manageable — a few hundred lines.

What they may not realize is that this file is imported by:

- `api/users.py` — user profile endpoints
- `api/orders.py` — order creation (requires authenticated user)
- `api/admin.py` — admin panel access control
- `middleware/session.py` — session management
- `services/payment.py` — payment authorization
- `utils/decorators.py` — `@login_required` decorator used in 40+ places
- `tests/test_auth.py`, `tests/test_users.py`, `tests/test_orders.py` — test coverage

And indirectly:

- Everything that uses `@login_required`
- Every API endpoint that requires a logged-in user
- Every service that calls the payment system

The developer who only looked at `auth/login.py` in isolation is about to create a large incident.

---

## Why Current Tools Don't Fully Solve This

| Existing Tool | What It Does | What It Misses |
|---|---|---|
| **IDE "Find Usages"** | Finds direct references to a symbol | Indirect chains, risk explanation, migration plans |
| **Linters** | Finds syntax and style issues | Semantic relationships, cross-file impact |
| **Static analyzers** | Detects code quality issues | Change impact, dependency chains |
| **Dependency managers** | Tracks package versions | Internal code relationships |
| **Git blame/log** | Shows change history | Future impact of planned changes |
| **Code search (grep)** | Finds text patterns | Structural relationships, AI explanation |
| **Architecture diagrams** | Shows high-level structure | Are often outdated, not code-derived |

None of these tools answer the specific question:

> **"I want to change X. What is the full potential impact of that change?"**

---

## The Gap X-Ray Fills

X-Ray combines:

1. **Automated structural analysis** — extract real relationships from the actual code
2. **Graph-based dependency modeling** — represent the entire project as a navigable graph
3. **Interactive visualization** — let the developer see and explore the connections
4. **AI-powered explanation** — translate graph data into human-readable impact assessments
5. **Risk-aware change planning** — suggest a safe path through the change

The result is a tool that answers the question directly:

> **"Here is what will likely be affected if you change this. Here is how risky it is. Here is a suggested plan."**

---

## Who Experiences This Problem

- **Individual developers** working on large or legacy codebases they don't fully understand
- **Teams** where knowledge is siloed — only one person knows how part of the system works
- **New joiners** onboarding onto an existing project
- **Tech leads** who need to assess the risk of a proposed change before approving it
- **Organizations** dealing with technical debt in aging software systems

---

## Summary

The problem is real, widespread, and currently addressed only with fragmented, manual, and
incomplete tools. X-Ray provides an integrated, intelligent, and interactive solution specifically
designed for the question developers ask most before making a significant change:

> **"What will this break?"**
