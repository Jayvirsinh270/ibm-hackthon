# backend/ai/interface.py
# Phase 8 — AIService abstract base class

from abc import ABC, abstractmethod


class AIService(ABC):
    """Abstract base class for AI provider integrations."""

    @abstractmethod
    async def explain_impact(self, context) -> object:
        """Given an impact analysis context, return an AI-generated explanation."""
        ...

    @abstractmethod
    async def explain_architecture(self, context) -> str:
        """Given a repository context summary, return a plain-language description."""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if the AI service is configured and reachable."""
        ...
