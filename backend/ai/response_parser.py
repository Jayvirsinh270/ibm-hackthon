"""
backend/ai/response_parser.py
Parses the structured response from watsonx.ai into an AIExplanation.

Looks for section markers: EXPLANATION:, RISK_AREAS:, MIGRATION_PLAN:, RECOMMENDED_TESTS:
Falls back gracefully if sections are missing or malformed.
"""
from __future__ import annotations
import re
from backend.models.ai import AIExplanation


class ResponseParser:

    SECTION_MARKERS = {
        "explanation":        "EXPLANATION:",
        "risk_areas":         "RISK_AREAS:",
        "migration_plan":     "MIGRATION_PLAN:",
        "recommended_tests":  "RECOMMENDED_TESTS:",
    }

    @classmethod
    def parse_impact_explanation(cls, raw: str, model_id: str = "") -> AIExplanation:
        """Parse a raw model response into a structured AIExplanation."""
        if not raw or not raw.strip():
            return AIExplanation.unavailable()

        try:
            sections = cls._extract_sections(raw)
            return AIExplanation(
                available=True,
                explanation=sections.get("explanation", raw[:500]),
                risk_areas=cls._parse_list(sections.get("risk_areas", "")),
                migration_plan=cls._parse_list(sections.get("migration_plan", "")),
                recommended_tests=cls._parse_list(sections.get("recommended_tests", "")),
                model_used=model_id,
                analysis_type="ai_assisted",
            )
        except Exception:
            # Last-resort fallback: return raw text as explanation
            return AIExplanation(
                available=True,
                explanation=raw[:500],
                model_used=model_id,
                analysis_type="ai_assisted",
            )

    @classmethod
    def _extract_sections(cls, text: str) -> dict[str, str]:
        """Split the response text into named sections by marker."""
        # Build an ordered list of (key, marker, position)
        positions: list[tuple[str, int]] = []
        upper = text.upper()
        for key, marker in cls.SECTION_MARKERS.items():
            idx = upper.find(marker)
            if idx != -1:
                positions.append((key, idx + len(marker)))

        positions.sort(key=lambda x: x[1])

        sections: dict[str, str] = {}
        for i, (key, start) in enumerate(positions):
            end = positions[i + 1][1] - len(
                cls.SECTION_MARKERS[positions[i + 1][0]]
            ) if i + 1 < len(positions) else len(text)
            sections[key] = text[start:end].strip()

        return sections

    @classmethod
    def _parse_list(cls, text: str) -> list[str]:
        """Parse a bulleted or numbered list into a Python list of strings."""
        if not text:
            return []
        items = []
        for line in text.splitlines():
            # Strip bullets: -, *, •, numbers like "1.", "1)"
            clean = re.sub(r"^[\s]*[-*•][\s]*", "", line)
            clean = re.sub(r"^[\s]*\d+[.)]\s*", "", clean)
            clean = clean.strip()
            if clean:
                items.append(clean)
        return items
