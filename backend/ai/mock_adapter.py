# backend/ai/mock_adapter.py
# Phase 8 — Mock AI adapter for development and testing

from backend.ai.interface import AIService


class MockAdapter(AIService):
    """Mock implementation of AIService — returns canned responses."""

    def is_available(self) -> bool:
        return True

    async def explain_impact(self, context) -> object:
        # TODO: return a realistic mock AIExplanation in Phase 8
        return {
            "available": True,
            "explanation": "Mock explanation: this component is used by several modules.",
            "risk_areas": ["Downstream consumers may break", "Tests need updating"],
            "migration_plan": ["1. Review all callers", "2. Update signatures", "3. Run tests"],
            "recommended_tests": ["test_integration", "test_regression"],
            "model_used": "mock",
            "analysis_type": "mock",
        }

    async def explain_architecture(self, context) -> str:
        return "Mock architecture overview."
