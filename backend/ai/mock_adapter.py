"""
backend/ai/mock_adapter.py
Mock implementation of AIService for testing and AI_PROVIDER=mock mode.
Returns realistic canned responses without calling any external API.
"""
from __future__ import annotations
from backend.ai.interface import AIService
from backend.models.ai import AIExplanation, AIContext, NodeSummaryContext, NodeSummaryResult


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

    async def summarize_node(self, context: NodeSummaryContext) -> NodeSummaryResult:
        lbl = context.label
        ntype = context.node_type
        doc = context.docstring.strip() if context.docstring else ""

        if doc:
            purpose = f"Implements {lbl}. {doc}"
        elif "login" in lbl.lower() or "auth" in lbl.lower():
            purpose = f"Authenticates identity and manages session/token verification contract for {lbl}."
        elif "jwt" in lbl.lower() or "token" in lbl.lower():
            purpose = f"Encodes, decodes, and verifies cryptographic tokens and claims for {lbl}."
        elif "user" in lbl.lower():
            purpose = f"Encapsulates user entity state, role-based permissions, and profile credentials."
        elif "route" in lbl.lower() or "endpoint" in lbl.lower():
            purpose = f"Exposes and handles HTTP request dispatching, input validation, and API responses."
        elif "db" in lbl.lower() or "session" in lbl.lower():
            purpose = f"Manages persistent database sessions, connection pooling, and entity queries."
        else:
            purpose = f"Provides core business logic for {lbl} within the {context.module_name or 'application'} domain."

        responsibilities = [
            f"Processes and validates {lbl} inputs",
            f"Interacts with {len(context.callees)} downstream dependencies: {', '.join(context.callees[:3]) or 'standard libraries'}",
            f"Serves {len(context.callers)} direct callers in the system",
        ]

        role = "Domain Controller" if ntype == "function" else ("Data Model" if ntype == "class" else "Module")
        complexity = "HIGH" if context.git_churn > 10 else ("MEDIUM" if context.git_churn > 3 else "LOW")

        return NodeSummaryResult(
            node_id=context.node_id,
            label=lbl,
            node_type=ntype,
            purpose=purpose,
            responsibilities=responsibilities,
            inputs_and_outputs="Accepts standard parameters and returns formatted output",
            architectural_role=f"{role} within {context.module_name or 'system'}",
            complexity_rating=complexity,
            model_used="mock-granite",
            analysis_type="mock",
        )
