# X-Ray — Intelligent Software Change Impact Analyzer

> **See what could break before you break it.**

X-Ray analyzes a software repository and creates an interactive dependency map. Select any
component and ask: *"What happens if I change this?"* — X-Ray identifies affected components,
highlights related tests, scores the risk, and uses IBM watsonx.ai to generate a plain-language
explanation and migration plan.

---

## The Problem

Modern software systems are deeply interconnected. A small change in one place can cascade
silently through dozens of components — until something breaks in production.

X-Ray makes those invisible connections visible **before** the developer touches the code.

---

## How It Works

```
Upload Repository
       ↓
X-Ray scans all Python files
       ↓
Extracts: imports · classes · functions · calls · tests · Git history
       ↓
Builds an interactive dependency graph
       ↓
Developer selects a component
       ↓
X-Ray shows: direct impact · transitive impact · related tests · risk level
       ↓
IBM watsonx.ai explains: risk areas · migration plan · test recommendations
```

---

## Two Layers of Analysis

| Layer | Type | Description |
|---|---|---|
| 🔬 **Deterministic** | Facts | Extracted directly from code — imports, calls, inheritance, tests |
| 🤖 **AI-Assisted** | Suggestions | watsonx.ai explanations, risk reasoning, migration plans |

The UI clearly labels which results are facts and which are AI-generated suggestions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 + FastAPI |
| Code Analysis | Python `ast` module + NetworkX |
| Git Analysis | GitPython |
| AI Provider | IBM watsonx.ai |
| Frontend | React 18 + TypeScript + Vite |
| Graph Visualization | Cytoscape.js |
| Styling | Tailwind CSS |
| Storage | SQLite + SQLAlchemy |
| Testing | pytest + Vitest |

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- IBM watsonx.ai API credentials (or use mock mode)

### Backend Setup

```bash
# Clone the repository
git clone <repo-url>
cd xray

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your watsonx.ai credentials

# Start the backend
uvicorn backend.main:app --reload --port 8000
```

### Frontend Setup

```bash
# In a separate terminal
cd frontend
npm install
npm run dev
```

Open your browser at **http://localhost:5173**

### Running Without watsonx.ai

Set `AI_PROVIDER=mock` in your `.env` file to use the built-in mock adapter.
All deterministic analysis features work without any AI credentials.

---

## Running Tests

```bash
# Backend unit tests
pytest backend/tests/unit/

# Backend all tests
pytest backend/tests/

# Backend with coverage
pytest --cov=backend --cov-report=term-missing

# Frontend tests
cd frontend && npm run test:run
```

---

## Project Structure

```
xray/
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Centralized configuration
│   ├── api/                 # HTTP route handlers
│   ├── models/              # Pydantic data models
│   ├── repository/          # Upload and file management
│   ├── analysis/            # Parser, dependency analyzer, impact engine
│   ├── graph/               # Graph builder, queries, serialization
│   ├── ai/                  # AI service abstraction + watsonx adapter
│   └── tests/               # Unit, integration, and E2E tests
├── frontend/
│   └── src/
│       ├── components/      # React components
│       ├── pages/           # Page-level components
│       ├── hooks/           # Custom React hooks
│       ├── api/             # API client
│       └── types/           # TypeScript type definitions
├── docs/                    # Full project documentation
├── sample_repo/             # Demo Python project for hackathon
├── .env.example             # Environment variable template
└── requirements.txt         # Python dependencies
```

---

## Documentation

| Document | Description |
|---|---|
| [Project Overview](docs/01-project-overview.md) | What X-Ray is and does |
| [Problem Statement](docs/02-problem-statement.md) | The problem being solved |
| [Requirements](docs/03-requirements.md) | Functional and non-functional requirements |
| [MVP Scope](docs/04-mvp-scope.md) | What is in scope for the MVP |
| [Architecture](docs/05-architecture.md) | System architecture and design decisions |
| [Data Flow](docs/06-data-flow.md) | How data moves through the system |
| [AI Architecture](docs/07-ai-architecture.md) | AI integration and abstraction design |
| [Analysis Engine](docs/08-analysis-engine.md) | Code analysis and graph engine design |
| [Security](docs/09-security.md) | Security controls and considerations |
| [Testing Strategy](docs/10-testing-strategy.md) | Test plan and test cases |
| [Development Plan](docs/11-development-plan.md) | Phased implementation plan |
| [Demo Scenario](docs/12-demo-scenario.md) | Hackathon demo walkthrough |
| [Hackathon Strategy](docs/13-hackathon-strategy.md) | Presentation and judging strategy |

---

## MVP Language Support

| Language | Status |
|---|---|
| Python | ✅ Supported |
| JavaScript/TypeScript | 🔜 Planned |
| Java | 🔜 Planned |
| Other | 📋 Future |

---

## IBM Technologies

- **IBM Bob** — AI development partner used throughout the build process
- **IBM watsonx.ai** — AI provider for impact explanation and migration planning

---

## License

MIT
