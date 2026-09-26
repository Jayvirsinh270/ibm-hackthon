"""
backend/ai/response_parser.py
Parses the structured response from watsonx.ai into an AIExplanation.

Looks for section markers: EXPLANATION:, RISK_AREAS:, MIGRATION_PLAN:, RECOMMENDED_TESTS:
Falls back gracefully if sections are missing or malformed.
"""
from __future__ import annotations
import re
from backend.models.ai import AIExplanation, NodeSummaryResult


class ResponseParser:

    SECTION_MARKERS = {
        "explanation":        "EXPLANATION:",
        "risk_areas":         "RISK_AREAS:",
        "migration_plan":     "MIGRATION_PLAN:",
        "recommended_tests":  "RECOMMENDED_TESTS:",
    }

    NODE_SUMMARY_MARKERS = {
        "purpose":             "PURPOSE:",
        "responsibilities":    "RESPONSIBILITIES:",
        "inputs_and_outputs":  "INPUTS_AND_OUTPUTS:",
        "architectural_role":  "ARCHITECTURAL_ROLE:",
        "complexity_rating":   "COMPLEXITY_RATING:",
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
            sline = line.strip()
            if sline.startswith(("#", "The final answer", "EXPLANATION:", "RISK_AREAS:", "MIGRATION_PLAN:", "RECOMMENDED_TESTS:")):
                continue
            # Strip bullets: -, *, •, numbers like "1.", "1)"
            clean = re.sub(r"^[\s]*[-*•][\s]*", "", line)
            clean = re.sub(r"^[\s]*\d+[.)]\s*", "", clean)
            clean = clean.strip()
            if clean and not clean.startswith(("\\boxed", "#")):
                items.append(clean)
        return items

    @classmethod
    def parse_node_summary(
        cls,
        raw: str,
        node_id: str,
        label: str,
        node_type: str,
        model_id: str = "",
    ) -> NodeSummaryResult:
        """Parse raw model output for node code summary."""
        if not raw or not raw.strip():
            return NodeSummaryResult(
                node_id=node_id,
                label=label,
                node_type=node_type,
                purpose=f"Executes core {node_type} logic for {label}.",
                responsibilities=[f"Implements {label} behavior"],
                inputs_and_outputs="Standard Python arguments and return values",
                architectural_role=f"{node_type.capitalize()} in application flow",
                complexity_rating="LOW",
                model_used=model_id or "watsonx",
                analysis_type="fallback",
            )

        # 1. Try flexible regex patterns
        patterns = {
            "purpose": r"(?:[0-9]+\.\s*)?(?:\*\*|###?\s*)?(?:Function[\s_]+)?Purpose(?:\*\*)?\s*:\s*(.*?)(?=(?:[0-9]+\.\s*)?(?:\*\*|###?\s*)?(?:Function[\s_]+)?(?:Responsibilities|Inputs|Architectural|Complexity)|\Z)",
            "responsibilities": r"(?:[0-9]+\.\s*)?(?:\*\*|###?\s*)?(?:Function[\s_]+)?Responsibilities(?:\*\*)?\s*:\s*(.*?)(?=(?:[0-9]+\.\s*)?(?:\*\*|###?\s*)?(?:Inputs|Architectural|Complexity)|\Z)",
            "inputs_and_outputs": r"(?:[0-9]+\.\s*)?(?:\*\*|###?\s*)?(?:Inputs?[\s_]+(?:and[\s_]+)?Outputs?|Contract)(?:\*\*)?\s*:\s*(.*?)(?=(?:[0-9]+\.\s*)?(?:\*\*|###?\s*)?(?:Architectural|Complexity)|\Z)",
            "architectural_role": r"(?:[0-9]+\.\s*)?(?:\*\*|###?\s*)?(?:Architectural[\s_]+Role)(?:\*\*)?\s*:\s*(.*?)(?=(?:[0-9]+\.\s*)?(?:\*\*|###?\s*)?(?:Complexity)|\Z)",
            "complexity_rating": r"(?:[0-9]+\.\s*)?(?:\*\*|###?\s*)?(?:Complexity[\s_]+Rating)(?:\*\*)?\s*:\s*(.*?)(?=\Z|\n\n)",
        }
        sections: dict[str, str] = {}
        for key, pat in patterns.items():
            m = re.search(pat, raw, re.IGNORECASE | re.DOTALL)
            if m and m.group(1).strip():
                sections[key] = m.group(1).strip()

        # 2. Fallback to exact markers if regex missed
        if not sections.get("purpose"):
            positions: list[tuple[str, int]] = []
            upper = raw.upper()
            for key, marker in cls.NODE_SUMMARY_MARKERS.items():
                idx = upper.find(marker)
                if idx != -1:
                    positions.append((key, idx + len(marker)))

            positions.sort(key=lambda x: x[1])

            for i, (key, start) in enumerate(positions):
                end = positions[i + 1][1] - len(
                    cls.NODE_SUMMARY_MARKERS[positions[i + 1][0]]
                ) if i + 1 < len(positions) else len(raw)
                sections[key] = raw[start:end].strip()

        purpose = sections.get("purpose") or raw[:300].strip()
        responsibilities = cls._parse_list(sections.get("responsibilities", ""))
        if not responsibilities:
            responsibilities = [f"Implements core {label} logic"]

        inputs_outputs = sections.get("inputs_and_outputs") or "Accepts inputs and produces return values"
        arch_role = sections.get("architectural_role") or f"{node_type.capitalize()} in application flow"
        comp_raw = sections.get("complexity_rating", "LOW").upper()
        complexity = "HIGH" if "HIGH" in comp_raw else ("MEDIUM" if "MEDIUM" in comp_raw else "LOW")

        return NodeSummaryResult(
            node_id=node_id,
            label=label,
            node_type=node_type,
            purpose=purpose,
            responsibilities=responsibilities,
            inputs_and_outputs=inputs_outputs,
            architectural_role=arch_role,
            complexity_rating=complexity,
            model_used=model_id or "watsonx",
            analysis_type="watsonx",
        )
