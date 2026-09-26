# backend/ai/interface.py
# Phase 8 — AIService abstract base class

from abc import ABC, abstractmethod
from backend.models.ai import AIContext, AIExplanation, NodeSummaryContext, NodeSummaryResult


class AIService(ABC):
    """Abstract base class for AI provider integrations."""

    @abstractmethod
    async def explain_impact(self, context: AIContext) -> AIExplanation:
        """Given an impact analysis context, return an AI-generated explanation."""
        ...

    @abstractmethod
    async def explain_architecture(self, context: AIContext) -> str:
        """Given a repository context summary, return a plain-language description."""
        ...

    @abstractmethod
    async def summarize_node(self, context: NodeSummaryContext) -> NodeSummaryResult:
        """Given a node and its source code/structural context, return an AI summary of what it does."""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if the AI service is configured and reachable."""
        ...
