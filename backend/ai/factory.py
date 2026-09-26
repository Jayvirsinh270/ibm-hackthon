"""
backend/ai/factory.py
Returns the correct AIService implementation based on AI_PROVIDER setting.
"""
from __future__ import annotations
from functools import lru_cache

from backend.config import settings


@lru_cache(maxsize=1)
def get_ai_service():
    """Return a singleton AIService — cached after first call."""
    provider = settings.AI_PROVIDER.lower()
    if provider == "watsonx":
        from backend.ai.watsonx_adapter import WatsonxAdapter
        adapter = WatsonxAdapter()
        if adapter.is_available():
            return adapter
        # Fall through to mock if watsonx init failed
        import logging
        logging.getLogger(__name__).warning(
            "WatsonxAdapter unavailable — falling back to MockAdapter"
        )

    from backend.ai.mock_adapter import MockAdapter
    return MockAdapter()
