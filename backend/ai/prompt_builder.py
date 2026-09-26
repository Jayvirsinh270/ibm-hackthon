"""
backend/ai/prompt_builder.py
Constructs structured prompts from impact analysis data.
NO source code is ever included — only structural metadata.
"""
from __future__ import annotations
from backend.models.ai import AIContext

# Cap lists to keep prompts within token budget
_MAX_NODES_IN_PROMPT = 30


def _node_lines(nodes: list[dict], cap: int = _MAX_NODES_IN_PROMPT) -> str:
    """Format a list of node dicts into readable prompt lines."""
    lines = []
    for n in nodes[:cap]:
        label = n.get("label", n.get("id", "?"))
        ntype = n.get("type", "file")
        module = n.get("module_name", "")
        lines.append(f"  - {label} ({ntype}) — {module}")
    if len(nodes) > cap:
        lines.append(f"  ... and {len(nodes) - cap} more")
    return "\n".join(lines) if lines else "  (none)"


class PromptBuilder:

    @staticmethod
    def build_impact_prompt(ctx: AIContext) -> str:
        """Build the full impact-explanation prompt from an AIContext."""

        change_desc = (
            ctx.change_description.strip()
            if ctx.change_description.strip()
            else "The developer wants to modify or replace this component."
        )

        direct_lines      = _node_lines(ctx.direct_affected)
        transitive_lines  = _node_lines(ctx.transitive_affected)
        test_lines        = _node_lines(ctx.related_tests)

        coverage_pct = 0
        total = len(ctx.direct_affected) + len(ctx.transitive_affected)
        if total > 0:
            coverage_pct = int(len(ctx.related_tests) / total * 100)

        factors_text = "\n".join(f"  - {f}" for f in ctx.contributing_factors) or "  - No significant risk factors"

        prompt = f"""You are a software architecture advisor helping a developer understand the impact of a proposed change to their codebase.

## Selected Component
Name: {ctx.selected_node_label}
Type: {ctx.selected_node_type}
ID:   {ctx.selected_node_id}

## Proposed Change
{change_desc}

## Structural Impact (Deterministic Analysis)
The following components have been identified as potentially affected:

### Directly Affected ({len(ctx.direct_affected)} components):
{direct_lines}

### Transitively Affected ({len(ctx.transitive_affected)} components):
{transitive_lines}

### Related Tests ({len(ctx.related_tests)} test files/functions):
{test_lines}

### Risk Assessment:
- Risk Level: {ctx.risk_level}
- Risk Score: {ctx.risk_score:.2f} / 1.00
- Deepest dependency chain: {ctx.max_depth} hops
- Test coverage of affected components: {coverage_pct}%
- Contributing factors:
{factors_text}

## Your Task
Based ONLY on the structural information above, provide the following sections.
Do not speculate beyond what the structural data shows. Be concise and practical.

EXPLANATION:
A clear 2-3 sentence explanation of why these components are connected and what the risk is.

RISK_AREAS:
A bullet list of 3-5 specific areas that require special attention when making this change.

MIGRATION_PLAN:
A numbered step-by-step plan (5-8 steps) for making this change safely.

RECOMMENDED_TESTS:
A list of tests that should be run or written before and after this change.

Use exactly these headings: EXPLANATION:, RISK_AREAS:, MIGRATION_PLAN:, RECOMMENDED_TESTS:
"""
        return prompt.strip()
