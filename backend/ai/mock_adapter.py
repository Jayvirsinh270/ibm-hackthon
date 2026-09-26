"""
backend/ai/mock_adapter.py
Mock implementation of AIService for testing and AI_PROVIDER=mock mode.
Returns realistic canned responses without calling any external API.
"""
from __future__ import annotations
from backend.ai.interface import AIService
from backend.models.ai import AIExplanation, AIContext


class MockAdapter(AIService):
    """Returns realistic predefined responses — no API calls."""

    def is_available(self) -> bool:
        return True

    async def explain_impact(self, context: AIContext) -> AIExplanation:
        node = context.selected_node_label
        direct = len(context.direct_affected)
        transitive = len(context.transitive_affected)
        tests = len(context.related_tests)
        risk = context.risk_level

        return AIExplanation(
            available=True,
            explanation=(
                f"The component '{node}' sits at a critical junction in the dependency graph. "
                f"Changes to it will directly affect {direct} component(s) and transitively "
                f"propagate to {transitive} more. "
                f"With a {risk} risk level, careful testing and staged rollout are recommended."
            ),
            risk_areas=[
                f"Downstream consumers of '{node}' may break if its interface changes",
                f"Only {tests} test(s) currently cover the affected components",
                "Integration points between modules need manual verification",
                "Any callers relying on current behaviour must be audited",
            ],
            migration_plan=[
                f"1. Review the full list of {direct} directly affected components",
                "2. Write or update unit tests for all affected public interfaces",
                f"3. Make the change to '{node}' in a feature branch",
                "4. Run all related tests listed in the impact analysis",
                "5. Check transitive dependencies for unexpected failures",
                "6. Perform code review with focus on the dependency boundaries",
                "7. Deploy to staging and run integration tests before merging",
            ],
            recommended_tests=[
                f"Run all {tests} existing test(s) in the related tests list",
                f"Add a unit test for each public method in '{node}'",
                "Add integration tests for each directly affected component",
                "Add a regression test capturing current behaviour before changing it",
            ],
            model_used="mock",
            analysis_type="mock",
        )

    async def explain_architecture(self, context: AIContext) -> str:
        return f"Mock architecture overview for {context.selected_node_label}."
