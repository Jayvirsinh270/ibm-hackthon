"""
backend/ai/watsonx_adapter.py
IBM watsonx.ai implementation of AIService.
Uses ibm-watsonx-ai SDK. Credentials come from backend/config.py (loaded from .env).
"""
from __future__ import annotations
import logging

from backend.ai.interface import AIService
from backend.ai.prompt_builder import PromptBuilder
from backend.ai.response_parser import ResponseParser
from backend.models.ai import AIExplanation, AIContext, NodeSummaryContext, NodeSummaryResult
from backend.config import settings

logger = logging.getLogger(__name__)


class WatsonxAdapter(AIService):
    """IBM watsonx.ai implementation of AIService."""

    def __init__(self):
        self._model = None
        self._available = False
        self._model_id = settings.WATSONX_MODEL_ID
        self._initialize()

    def _initialize(self):
        """Try to connect to watsonx.ai. Sets _available=False on any failure."""
        try:
            from ibm_watsonx_ai import APIClient, Credentials
            from ibm_watsonx_ai.foundation_models import ModelInference

            if not settings.WATSONX_API_KEY or (not settings.WATSONX_PROJECT_ID and not settings.WATSONX_SPACE_ID):
                logger.info("watsonx.ai credentials not configured — using mock mode")
                return

            credentials = Credentials(
                url=settings.WATSONX_URL,
                api_key=settings.WATSONX_API_KEY,
            )
            client = APIClient(credentials)
            kwargs = {
                "model_id": self._model_id,
                "api_client": client,
                "params": {
                    "max_new_tokens": 1024,
                    "temperature": 0.3,
                    "repetition_penalty": 1.1,
                },
            }
            if settings.WATSONX_PROJECT_ID:
                kwargs["project_id"] = settings.WATSONX_PROJECT_ID
            elif settings.WATSONX_SPACE_ID:
                kwargs["space_id"] = settings.WATSONX_SPACE_ID

            self._model = ModelInference(**kwargs)
            self._available = True
            logger.info(f"watsonx.ai initialised — model={self._model_id}")

        except Exception as exc:
            logger.warning(f"watsonx.ai initialisation failed: {type(exc).__name__}: {exc}")
            self._available = False

    def is_available(self) -> bool:
        return self._available

    async def explain_impact(self, context: AIContext) -> AIExplanation:
        if not self._available or self._model is None:
            from backend.ai.mock_adapter import MockAdapter
            return await MockAdapter().explain_impact(context)
        try:
            prompt = PromptBuilder.build_impact_prompt(context)
            logger.info(f"Sending impact prompt to watsonx.ai for node={context.selected_node_id}")
            response = self._model.generate_text(prompt=prompt)
            explanation = ResponseParser.parse_impact_explanation(response, self._model_id)
            logger.info(f"watsonx.ai response received for node={context.selected_node_id}")
            return explanation
        except Exception as exc:
            logger.error(f"watsonx.ai explain_impact failed: {type(exc).__name__}: {exc}")
            from backend.ai.mock_adapter import MockAdapter
            return await MockAdapter().explain_impact(context)

    async def explain_architecture(self, context: AIContext) -> str:
        if not self._available or self._model is None:
            return f"Architecture overview for {context.selected_node_label}."
        try:
            prompt = f"Briefly describe the architecture of a Python project containing: {context.selected_node_label}."
            return self._model.generate_text(prompt=prompt)
        except Exception as exc:
            logger.error(f"watsonx.ai explain_architecture failed: {exc}")
            return f"Architecture overview for {context.selected_node_label}."

    async def summarize_node(self, context: NodeSummaryContext) -> NodeSummaryResult:
        """Generate a structured summary of what a function, class, or module does."""
        if not self._available or self._model is None:
            from backend.ai.mock_adapter import MockAdapter
            return await MockAdapter().summarize_node(context)

        try:
            prompt = PromptBuilder.build_node_summary_prompt(context)
            logger.info(f"Sending node summary prompt to watsonx.ai for node={context.node_id}")
            response = self._model.generate_text(prompt=prompt)
            return ResponseParser.parse_node_summary(
                response,
                context.node_id,
                context.label,
                context.node_type,
                model_id=self._model_id,
            )
        except Exception as exc:
            logger.error(f"watsonx.ai summarize_node failed: {exc}")
            from backend.ai.mock_adapter import MockAdapter
            return await MockAdapter().summarize_node(context)
