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
from backend.models.ai import AIExplanation, AIContext
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

            if not settings.WATSONX_API_KEY or not settings.WATSONX_PROJECT_ID:
                logger.info("watsonx.ai credentials not configured — using mock mode")
                return

            credentials = Credentials(
                url=settings.WATSONX_URL,
                api_key=settings.WATSONX_API_KEY,
            )
            client = APIClient(credentials)
            self._model = ModelInference(
                model_id=self._model_id,
                api_client=client,
                project_id=settings.WATSONX_PROJECT_ID,
                params={
                    "max_new_tokens": 1024,
                    "temperature": 0.3,
                    "repetition_penalty": 1.1,
                },
            )
            self._available = True
            logger.info(f"watsonx.ai initialised — model={self._model_id}")

        except Exception as exc:
            logger.warning(f"watsonx.ai initialisation failed: {type(exc).__name__}: {exc}")
            self._available = False

    def is_available(self) -> bool:
        return self._available

    async def explain_impact(self, context: AIContext) -> AIExplanation:
        if not self._available or self._model is None:
            return AIExplanation.unavailable()
        try:
            prompt = PromptBuilder.build_impact_prompt(context)
            logger.info(f"Sending impact prompt to watsonx.ai for node={context.selected_node_id}")
            response = self._model.generate_text(prompt=prompt)
            explanation = ResponseParser.parse_impact_explanation(response, self._model_id)
            logger.info(f"watsonx.ai response received for node={context.selected_node_id}")
            return explanation
        except Exception as exc:
            logger.error(f"watsonx.ai explain_impact failed: {type(exc).__name__}: {exc}")
            return AIExplanation.unavailable()

    async def explain_architecture(self, context: AIContext) -> str:
        if not self._available or self._model is None:
            return "AI architecture overview unavailable."
        try:
            prompt = f"Briefly describe the architecture of a Python project containing: {context.selected_node_label}."
            return self._model.generate_text(prompt=prompt)
        except Exception as exc:
            logger.error(f"watsonx.ai explain_architecture failed: {exc}")
            return "AI architecture overview unavailable."
