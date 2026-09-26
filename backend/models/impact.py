"""
backend/models/impact.py
Pydantic/dataclass models for impact analysis results and risk assessment.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum


class RiskLevel(str, Enum):
    HIGH   = "HIGH"
    MEDIUM = "MEDIUM"
    LOW    = "LOW"


@dataclass
class RiskAssessment:
    level: RiskLevel
    score: float                          # 0.0 – 1.0
    contributing_factors: list[str] = field(default_factory=list)


@dataclass
class ImpactResult:
    selected_node_id: str
    selected_node_label: str
    selected_node_type: str
    direct_affected: list[dict]           # list of node attribute dicts
    transitive_affected: list[dict]
    related_tests: list[dict]
    risk: RiskAssessment
    max_depth: int
    analysis_type: str = "deterministic"
