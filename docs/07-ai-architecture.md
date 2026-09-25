# X-Ray — AI Architecture

## Purpose of This Document

This document describes how X-Ray integrates with AI services — specifically IBM watsonx.ai —
including the abstraction design, prompt strategy, response handling, fallback behavior, and
the principle of keeping AI additive rather than essential.

---

## Core Principle

> The deterministic analysis must work without AI.
> AI enhances the results — it does not produce them.

This means:
- Impact analysis, dependency traversal, and risk scoring all run without AI
- AI is invoked only when the user explicitly requests an explanation
- If AI fails, the application continues to function normally

---

## AI Abstraction Layer

All AI functionality is isolated behind a single interface. No AI API calls exist anywhere in
the application outside of the `backend/ai/` module.

```
Application Code
      │
      │  calls only this interface:
      ▼
┌─────────────────────────────────────┐
│  AIService (abstract base class)    │
│  backend/ai/interface.py            │
│                                     │
│  + explain_impact(context) → AIExplanation  │
│  + explain_architecture(context) → str      │
│  + is_available() → bool                    │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌────────────┐   ┌──────────────┐
│  Watsonx   │   │     Mock     │
│  Adapter   │   │   Adapter    │
│            │   │              │
│  Real API  │   │  Returns     │
│  calls to  │   │  predefined  │
│  watsonx   │   │  responses   │
│  .ai       │   │  (testing)   │
└────────────┘   └──────────────┘
```

The active adapter is selected at startup based on configuration:
- `AI_PROVIDER=watsonx` → use `WatsonxAdapter`
- `AI_PROVIDER=mock` → use `MockAdapter` (useful for development without API keys)

---

## AIService Interface

```python
# backend/ai/interface.py

from abc import ABC, abstractmethod
from backend.models.ai import AIExplanation, AIContext

class AIService(ABC):
    """Abstract base class for AI provider integrations."""

    @abstractmethod
    async def explain_impact(self, context: AIContext) -> AIExplanation:
        """
        Given an impact analysis context, return an AI-generated explanation
        including risk areas, migration plan, and test recommendations.
        """
        ...

    @abstractmethod
    async def explain_architecture(self, context: AIContext) -> str:
        """
        Given a repository context summary, return a plain-language
        description of the architecture.
        """
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if the AI service is configured and reachable."""
        ...
```

---

## IBM watsonx.ai Adapter

```python
# backend/ai/watsonx_adapter.py

from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from backend.ai.interface import AIService
from backend.ai.prompt_builder import PromptBuilder
from backend.ai.response_parser import ResponseParser
from backend.models.ai import AIExplanation, AIContext
from backend.config import settings
import logging

logger = logging.getLogger(__name__)

class WatsonxAdapter(AIService):
    """IBM watsonx.ai implementation of AIService."""

    def __init__(self):
        self._client = None
        self._model = None
        self._available = False
        self._initialize()

    def _initialize(self):
        try:
            credentials = Credentials(
                url=settings.WATSONX_URL,
                api_key=settings.WATSONX_API_KEY,
            )
            self._client = APIClient(credentials)
            self._model = ModelInference(
                model_id=settings.WATSONX_MODEL_ID,
                api_client=self._client,
                project_id=settings.WATSONX_PROJECT_ID,
                params={
                    "max_new_tokens": 1024,
                    "temperature": 0.3,
                },
            )
            self._available = True
        except Exception as e:
            logger.warning(f"watsonx.ai initialization failed: {e}")
            self._available = False

    def is_available(self) -> bool:
        return self._available

    async def explain_impact(self, context: AIContext) -> AIExplanation:
        if not self._available:
            return AIExplanation.unavailable()
        try:
            prompt = PromptBuilder.build_impact_prompt(context)
            response = self._model.generate_text(prompt=prompt)
            return ResponseParser.parse_impact_explanation(response)
        except Exception as e:
            logger.error(f"watsonx.ai explain_impact failed: {e}")
            return AIExplanation.unavailable()
```

---

## Prompt Design

### Design Principles

1. **Structural metadata only** — never send raw source code to the AI
2. **Structured prompts** — use clear sections the model can follow
3. **Explicit output format** — tell the model exactly what structure to return
4. **Conservative temperature** — use `temperature=0.3` for more predictable responses
5. **Bounded size** — prompts are capped to prevent excessive token usage

### Impact Explanation Prompt Template

```
You are a software architecture advisor helping a developer understand the impact of a
proposed change to their codebase.

## Selected Component
Name: {node_name}
Type: {node_type}  (file | class | function)
Location: {file_path}

## Proposed Change
{change_description or "The developer wants to modify or replace this component."}

## Structural Impact (Deterministic Analysis)
The following components have been identified as potentially affected:

### Directly Affected ({direct_count} components):
{direct_affected_list}

### Transitively Affected ({transitive_count} components):
{transitive_affected_list}

### Related Tests ({test_count} test files/functions):
{related_tests_list}

### Risk Factors:
- Impact breadth: {direct_count} direct, {transitive_count} total
- Deepest dependency chain: {max_depth} hops
- Test coverage of affected components: {coverage_ratio}%
{git_churn_line if available}

## Your Task
Based on the structural information above, provide:

1. EXPLANATION: A clear, plain-language explanation of why these components are connected
   and what the risk is. 2-3 sentences.

2. RISK_AREAS: A bullet list of 3-5 specific areas that require special attention.

3. MIGRATION_PLAN: A numbered, step-by-step migration plan for making this change safely.
   Be specific and practical. 5-8 steps.

4. RECOMMENDED_TESTS: A list of tests that should be run or added before and after
   this change. Be specific about what each test should verify.

Use clear headings: EXPLANATION:, RISK_AREAS:, MIGRATION_PLAN:, RECOMMENDED_TESTS:

Do not speculate beyond what the structural data shows. Be honest about uncertainty.
```

---

## Response Parsing

The `ResponseParser` extracts structured sections from the AI's response text.

Strategy:
1. Look for known section markers: `EXPLANATION:`, `RISK_AREAS:`, `MIGRATION_PLAN:`, `RECOMMENDED_TESTS:`
2. Extract the content following each marker
3. Parse lists (numbered or bulleted) into Python lists
4. If a section is missing: use a safe default message
5. If parsing completely fails: return the raw text in the `explanation` field with empty lists for other fields

```python
# backend/ai/response_parser.py

class ResponseParser:
    SECTION_MARKERS = {
        "explanation": "EXPLANATION:",
        "risk_areas": "RISK_AREAS:",
        "migration_plan": "MIGRATION_PLAN:",
        "recommended_tests": "RECOMMENDED_TESTS:",
    }

    @classmethod
    def parse_impact_explanation(cls, raw_response: str) -> AIExplanation:
        sections = cls._extract_sections(raw_response)
        return AIExplanation(
            available=True,
            explanation=sections.get("explanation", raw_response[:500]),
            risk_areas=cls._parse_list(sections.get("risk_areas", "")),
            migration_plan=cls._parse_list(sections.get("migration_plan", "")),
            recommended_tests=cls._parse_list(sections.get("recommended_tests", "")),
            model_used=settings.WATSONX_MODEL_ID,
            analysis_type="ai_assisted",
        )
```

---

## Fallback Behavior

| Scenario | Behavior |
|---|---|
| AI not configured | `is_available()` returns False; UI shows "AI unavailable" message |
| API key invalid | Adapter fails to initialize; `is_available()` returns False |
| API timeout | Exception caught; `AIExplanation.unavailable()` returned |
| Response unparseable | Raw text used as explanation; lists default to empty |
| Rate limited | Exception caught; retry not attempted in MVP; returns unavailable |

In all failure cases:
- The error is **logged** (never shown to the user as a stack trace)
- The user sees a clear, friendly message: `"AI analysis is temporarily unavailable. Deterministic results are shown above."`
- The deterministic impact analysis and risk score remain fully functional

---

## Model Selection

For the MVP, the planned watsonx.ai model is:

| Option | Model ID | Notes |
|---|---|---|
| **Primary** | `ibm/granite-13b-chat-v2` | IBM's instruction-tuned model; good for structured tasks |
| **Alternative** | `meta-llama/llama-3-70b-instruct` | Available on watsonx; strong instruction following |
| **Fallback** | `ibm/granite-3-8b-instruct` | Smaller, faster, lower token cost |

The model ID should be configurable via environment variable `WATSONX_MODEL_ID`.

---

## Context Size Management

To avoid excessive token usage:

- Only **node names and types** are sent — not source code
- Lists of affected components are **capped at 30 items** in the prompt (with a note if truncated)
- Migration plan output is capped at `max_new_tokens: 1024`
- The prompt builder estimates token count before sending and truncates if needed

---

## AI Usage in X-Ray — Summary

| Use Case | AI Used? | Required? |
|---|---|---|
| Repository scan | No | — |
| Dependency graph generation | No | — |
| Impact analysis | No | — |
| Risk level calculation | No | — |
| Impact explanation | **Yes** | Optional |
| Migration plan generation | **Yes** | Optional |
| Architecture overview | **Yes** | Optional |
| Test recommendations | **Yes** | Optional |

The system is explicitly designed so that all columns marked "No" work without any AI configuration.
AI is a value-add layer, not a dependency.
