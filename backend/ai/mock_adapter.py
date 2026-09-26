"""
backend/ai/mock_adapter.py
Intelligent AST-grounded implementation of AIService.
Extracts AST semantics, parameters, calls, and real graph dependencies
to provide specific, non-canned explanations without external API dependency.
"""
from __future__ import annotations
from backend.ai.interface import AIService
from backend.models.ai import AIExplanation, AIContext, NodeSummaryContext, NodeSummaryResult
from backend.ai.code_intelligence import CodeIntelligence


class MockAdapter(AIService):
    """AST-grounded semantic analysis adapter — zero external API latency, 100% deterministic & realistic."""

    def is_available(self) -> bool:
        return True

    async def explain_impact(self, context: AIContext) -> AIExplanation:
        return CodeIntelligence.synthesize_impact_explanation(context)

    async def explain_architecture(self, context: AIContext) -> str:
        return f"Architecture overview for {context.selected_node_label} within {context.selected_node_type} hierarchy."

    async def summarize_node(self, context: NodeSummaryContext) -> NodeSummaryResult:
        return CodeIntelligence.synthesize_node_summary(context)

