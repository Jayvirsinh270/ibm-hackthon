"""
backend/models/ai.py
Pydantic/dataclass models for AI explanation results and context.
"""
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class AIContext:
    """Everything the AI needs to generate an explanation — no source code."""
    selected_node_id: str
    selected_node_label: str
    selected_node_type: str
    change_description: str
    direct_affected: list[dict]
    transitive_affected: list[dict]
    related_tests: list[dict]
    risk_level: str
    risk_score: float
    max_depth: int
    contributing_factors: list[str]


@dataclass
class AIExplanation:
    available: bool
    explanation: str = ""
    risk_areas: list[str] = field(default_factory=list)
    migration_plan: list[str] = field(default_factory=list)
    recommended_tests: list[str] = field(default_factory=list)
    model_used: str = ""
    analysis_type: str = "ai_assisted"

    @classmethod
    def unavailable(cls) -> "AIExplanation":
        return cls(
            available=False,
            explanation="AI analysis is temporarily unavailable. Deterministic results are shown above.",
            analysis_type="unavailable",
        )
