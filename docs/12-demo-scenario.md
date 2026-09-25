# X-Ray — Demo Scenario

## Purpose

This document defines the exact scenario used to demonstrate X-Ray at the hackathon.
It serves two purposes:
1. A design specification for the `sample_repo/` project
2. A step-by-step script for the live demonstration

---

## The Scenario

A developer has inherited an existing Python web application. They've been asked to:

> **"Replace the authentication system."**

They open X-Ray to understand what this change will affect before touching a single line of code.

---

## Sample Repository Design

The sample repository is named **`sample_app`** — a minimal but realistic Python web application
that represents a typical structure a developer might encounter.

### Structure

```
sample_app/
├── auth/
│   ├── __init__.py
│   ├── login.py            ← THE focal point of the demo
│   ├── session.py
│   └── permissions.py
├── api/
│   ├── __init__.py
│   ├── users.py            ← imports auth.login
│   ├── orders.py           ← imports auth.login, auth.permissions
│   ├── products.py         ← no auth dependency
│   └── admin.py            ← imports auth.login, auth.permissions, auth.session
├── services/
│   ├── __init__.py
│   ├── user_service.py     ← imports auth.login
│   ├── order_service.py    ← imports services.user_service
│   └── payment_service.py  ← imports services.user_service, auth.permissions
├── middleware/
│   ├── __init__.py
│   └── auth_middleware.py  ← imports auth.login, auth.session
├── models/
│   ├── __init__.py
│   ├── user.py
│   └── order.py
├── utils/
│   ├── __init__.py
│   └── decorators.py       ← imports auth.login (defines @login_required)
├── tests/
│   ├── __init__.py
│   ├── test_login.py       ← tests auth.login
│   ├── test_users_api.py   ← tests api.users (which uses auth)
│   ├── test_orders_api.py  ← tests api.orders
│   ├── test_admin.py       ← tests api.admin
│   └── test_payment.py     ← tests services.payment_service
└── config.py
```

### Key Design Decisions

- `auth/login.py` is the **hub** — many modules depend on it
- `api/products.py` is **intentionally isolated** — no auth dependency, so it won't be affected
- `utils/decorators.py` has **transitive reach** — it uses `@login_required` which wraps auth
- The test suite covers most (but not all) affected components — demonstrates partial coverage
- `services/order_service.py` → `services/user_service.py` → `auth/login.py` demonstrates **transitive impact**

---

## Expected Analysis Results

When X-Ray analyzes `auth/login.py`:

### Direct Dependencies (what `auth.login` imports)
- `models/user.py`
- External: `hashlib`, `datetime` (skipped — external)

### Direct Reverse Dependencies (what directly imports `auth.login`)
- `auth/session.py`
- `api/users.py`
- `api/orders.py`
- `api/admin.py`
- `services/user_service.py`
- `middleware/auth_middleware.py`
- `utils/decorators.py`

### Transitive Impact (indirect chain)
- `services/order_service.py` (via `user_service.py`)
- `services/payment_service.py` (via `user_service.py`)
- And their tests

### Related Tests
- `tests/test_login.py` (direct)
- `tests/test_users_api.py` (via `api/users.py`)
- `tests/test_orders_api.py` (via `api/orders.py`)
- `tests/test_admin.py` (via `api/admin.py`)
- `tests/test_payment.py` (via `services/payment_service.py`)

### Risk Level
- Expected: **🔴 HIGH**
- Factors: high direct count, deep transitive chain, partial test coverage

---

## Demo Script

### Step 1 — Open X-Ray (30 seconds)

> "This is X-Ray — an intelligent change impact analyzer. It helps developers understand
> what could break **before** they change their code."

Show the upload screen.

---

### Step 2 — Upload the Repository (30 seconds)

Upload `sample_app.zip`.

> "We have a Python web application here. Let's let X-Ray scan it."

Watch the scan progress indicator.

> "X-Ray is parsing every Python file, extracting imports, class relationships, function calls,
> and test coverage — all from the actual source code. No guessing."

---

### Step 3 — Show the Dependency Graph (1 minute)

The interactive graph appears.

> "This is the X-Ray view. Every node you see is a real component from the codebase.
> Every edge is a real relationship extracted from the code."

Pan around and show:
- Blue nodes = files
- Green nodes = functions
- Orange nodes = test files

> "Notice `api/products.py` over here — it has very few connections. Now look at `auth/login.py`."

Click to zoom to the `auth/login.py` cluster.

> "Look at how many things connect to authentication. That's already telling us something."

---

### Step 4 — Select the Component (30 seconds)

Click on `auth/login.py`.

> "Let's ask X-Ray: what happens if I change this?"

The node highlights. The impact panel slides open.

---

### Step 5 — Show Deterministic Impact (1 minute)

Point to the impact panel.

> "This section — labelled 'Deterministic Analysis' — is extracted directly from the code.
> These are facts, not guesses."

Show:
- **Direct affected**: 7 components
- **Transitive affected**: 12 components
- **Related tests**: 5 test files

Highlight affected nodes in the graph (they light up in red/orange).

> "Notice that `api/products.py` is NOT highlighted — because it has no connection to
> authentication. X-Ray correctly identifies it as unaffected."

Show the risk badge: 🔴 **HIGH RISK**

> "X-Ray tells us this is a high-risk change. Here's why..."

Read out the contributing factors.

---

### Step 6 — AI Explanation (1 minute)

Click "Explain with AI".

> "Now we ask IBM watsonx.ai to reason about this impact."

Wait for the AI response (or use a pre-loaded response).

> "This section — labelled 'AI-Generated Suggestions' — is the AI's interpretation."

Read out:
- The explanation paragraph
- 2-3 risk areas
- First 3 steps of the migration plan

> "This isn't magic. X-Ray sent only the structural metadata — component names and
> relationships — to the AI. No source code was sent. The AI used that map to reason
> about the change."

---

### Step 7 — The Business Case (30 seconds)

> "Without X-Ray, a developer would have to manually trace all of these relationships —
> reading through dozens of files, hoping they don't miss anything.
>
> With X-Ray, they have the full picture in under 60 seconds, with a risk score and a
> migration plan ready to go.
>
> This is X-Ray — helping developers see what they can't see before they break something."

---

## Fallback Plan

If the live demo fails (network issues, API unavailability):

1. **Pre-recorded screenshots**: Prepare a PDF or HTML walkthrough with screenshots of each step
2. **Mock AI adapter**: If watsonx.ai is unreachable, the mock adapter returns a pre-written explanation
3. **Pre-analyzed repo**: If the scan is slow, start with a pre-analyzed repo already loaded in the app

The most critical fallback is the mock AI adapter — this should always be available as a fallback
so the demonstration never shows an empty AI panel.

---

## Timing

| Step | Target Time |
|---|---|
| Open + upload | 1 minute |
| Scan completes | 15-30 seconds |
| Graph overview | 1 minute |
| Select component | 30 seconds |
| Show deterministic impact | 1 minute |
| AI explanation | 1 minute |
| Business case close | 30 seconds |
| **Total** | **~5-6 minutes** |
