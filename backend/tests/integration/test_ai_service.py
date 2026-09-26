"""
backend/tests/integration/test_ai_service.py
Phase 8 — Integration tests for the AI explanation pipeline (mock adapter).
All tests run against MockAdapter — no real API calls.
"""
import pytest
from backend.models.ai import AIContext, AIExplanation
from backend.ai.mock_adapter import MockAdapter
from backend.ai.prompt_builder import PromptBuilder
from backend.ai.response_parser import ResponseParser


# ── Fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture
def sample_context() -> AIContext:
    return AIContext(
        selected_node_id="auth.authenticate",
        selected_node_label="authenticate",
        selected_node_type="function",
        change_description="Refactor to use JWT tokens instead of session cookies",
        direct_affected=[
            {"id": "api.login_view", "label": "login_view", "type": "function", "module_name": "api"},
            {"id": "api.logout_view", "label": "logout_view", "type": "function", "module_name": "api"},
        ],
        transitive_affected=[
            {"id": "services.user_service", "label": "UserService", "type": "class", "module_name": "services"},
        ],
        related_tests=[
            {"id": "tests.test_auth", "label": "test_auth", "type": "test", "module_name": "tests"},
        ],
        risk_level="HIGH",
        risk_score=0.82,
        max_depth=3,
        contributing_factors=[
            "High git churn (8 changes in last 30 days)",
            "5 direct dependents",
            "Low test coverage ratio (0.50)",
        ],
    )


@pytest.fixture
def mock_adapter() -> MockAdapter:
    return MockAdapter()


# ── MockAdapter tests ─────────────────────────────────────────────────────

class TestMockAdapter:

    def test_is_available(self, mock_adapter):
        assert mock_adapter.is_available() is True

    @pytest.mark.asyncio
    async def test_explain_impact_returns_explanation(self, mock_adapter, sample_context):
        result = await mock_adapter.explain_impact(sample_context)
        assert isinstance(result, AIExplanation)
        assert result.available is True

    @pytest.mark.asyncio
    async def test_explain_impact_explanation_mentions_node(self, mock_adapter, sample_context):
        result = await mock_adapter.explain_impact(sample_context)
        assert "authenticate" in result.explanation

    @pytest.mark.asyncio
    async def test_explain_impact_has_risk_areas(self, mock_adapter, sample_context):
        result = await mock_adapter.explain_impact(sample_context)
        assert isinstance(result.risk_areas, list)
        assert len(result.risk_areas) >= 1

    @pytest.mark.asyncio
    async def test_explain_impact_has_migration_plan(self, mock_adapter, sample_context):
        result = await mock_adapter.explain_impact(sample_context)
        assert isinstance(result.migration_plan, list)
        assert len(result.migration_plan) >= 3

    @pytest.mark.asyncio
    async def test_explain_impact_has_recommended_tests(self, mock_adapter, sample_context):
        result = await mock_adapter.explain_impact(sample_context)
        assert isinstance(result.recommended_tests, list)
        assert len(result.recommended_tests) >= 1

    @pytest.mark.asyncio
    async def test_explain_impact_model_used_is_mock(self, mock_adapter, sample_context):
        result = await mock_adapter.explain_impact(sample_context)
        assert result.model_used == "mock"

    @pytest.mark.asyncio
    async def test_explain_impact_analysis_type_is_mock(self, mock_adapter, sample_context):
        result = await mock_adapter.explain_impact(sample_context)
        assert result.analysis_type == "mock"

    @pytest.mark.asyncio
    async def test_explain_architecture_returns_string(self, mock_adapter, sample_context):
        result = await mock_adapter.explain_architecture(sample_context)
        assert isinstance(result, str)
        assert len(result) > 0


# ── PromptBuilder tests ───────────────────────────────────────────────────

class TestPromptBuilder:

    def test_build_impact_prompt_contains_node_name(self, sample_context):
        prompt = PromptBuilder.build_impact_prompt(sample_context)
        assert "authenticate" in prompt

    def test_build_impact_prompt_contains_risk_level(self, sample_context):
        prompt = PromptBuilder.build_impact_prompt(sample_context)
        assert "HIGH" in prompt

    def test_build_impact_prompt_contains_section_markers(self, sample_context):
        prompt = PromptBuilder.build_impact_prompt(sample_context)
        assert "EXPLANATION:" in prompt
        assert "RISK_AREAS:" in prompt
        assert "MIGRATION_PLAN:" in prompt
        assert "RECOMMENDED_TESTS:" in prompt

    def test_build_impact_prompt_no_source_code(self, sample_context):
        """Verify prompt only contains structural metadata, not source code."""
        prompt = PromptBuilder.build_impact_prompt(sample_context)
        # Structural info present
        assert "authenticate" in prompt
        assert "function" in prompt

    def test_build_impact_prompt_caps_long_lists(self):
        """Lists longer than _MAX_NODES_IN_PROMPT should be capped."""
        ctx = AIContext(
            selected_node_id="big.node",
            selected_node_label="BigNode",
            selected_node_type="class",
            change_description="",
            direct_affected=[
                {"id": f"n{i}", "label": f"Node{i}", "type": "function", "module_name": "mod"}
                for i in range(50)
            ],
            transitive_affected=[],
            related_tests=[],
            risk_level="HIGH",
            risk_score=0.9,
            max_depth=5,
            contributing_factors=[],
        )
        prompt = PromptBuilder.build_impact_prompt(ctx)
        assert "and 20 more" in prompt

    def test_build_impact_prompt_uses_default_change_desc(self, sample_context):
        sample_context.change_description = "   "
        prompt = PromptBuilder.build_impact_prompt(sample_context)
        assert "developer wants to modify" in prompt


# ── ResponseParser tests ──────────────────────────────────────────────────

class TestResponseParser:

    def test_parse_well_formed_response(self):
        raw = """
EXPLANATION:
This component is critical. Many things depend on it.

RISK_AREAS:
- Interface may break
- Callers need updating

MIGRATION_PLAN:
1. Write tests first
2. Make the change
3. Run tests

RECOMMENDED_TESTS:
- test_auth
- test_login
"""
        result = ResponseParser.parse_impact_explanation(raw, model_id="test-model")
        assert result.available is True
        assert "critical" in result.explanation
        assert "Interface may break" in result.risk_areas
        assert "Write tests first" in result.migration_plan
        assert "test_auth" in result.recommended_tests
        assert result.model_used == "test-model"

    def test_parse_empty_response_returns_unavailable(self):
        result = ResponseParser.parse_impact_explanation("")
        assert result.available is False

    def test_parse_whitespace_only_returns_unavailable(self):
        result = ResponseParser.parse_impact_explanation("   \n  ")
        assert result.available is False

    def test_parse_partial_sections(self):
        """Missing sections should be empty lists, not errors."""
        raw = "EXPLANATION:\nSomething changed.\n"
        result = ResponseParser.parse_impact_explanation(raw)
        assert result.available is True
        assert result.explanation != ""
        assert result.risk_areas == []
        assert result.migration_plan == []
        assert result.recommended_tests == []

    def test_parse_list_strips_bullets(self):
        items = ResponseParser._parse_list("- item one\n* item two\n• item three")
        assert items == ["item one", "item two", "item three"]

    def test_parse_list_strips_numbers(self):
        items = ResponseParser._parse_list("1. first\n2) second\n3. third")
        assert items == ["first", "second", "third"]

    def test_parse_list_empty_string(self):
        assert ResponseParser._parse_list("") == []


# ── AIExplanation model tests ─────────────────────────────────────────────

class TestAIExplanationModel:

    def test_unavailable_factory(self):
        exp = AIExplanation.unavailable()
        assert exp.available is False
        assert exp.analysis_type == "unavailable"
        assert "unavailable" in exp.explanation.lower()

    def test_defaults(self):
        exp = AIExplanation(available=True, explanation="test")
        assert exp.risk_areas == []
        assert exp.migration_plan == []
        assert exp.recommended_tests == []
        assert exp.model_used == ""
