# backend/ai/watsonx_adapter.py
# Phase 8 — IBM watsonx.ai adapter
#
# API credentials are loaded from environment via backend/config.py.
# Leave the actual API call implementation for Phase 8.

from backend.ai.interface import AIService


class WatsonxAdapter(AIService):
    """IBM watsonx.ai implementation of AIService."""

    def __init__(self):
        # TODO: initialise ibm_watsonx_ai client in Phase 8
        self._available = False

    def is_available(self) -> bool:
        return self._available

    async def explain_impact(self, context) -> object:
        # TODO: implement in Phase 8
        raise NotImplementedError

    async def explain_architecture(self, context) -> str:
        # TODO: implement in Phase 8
        raise NotImplementedError
