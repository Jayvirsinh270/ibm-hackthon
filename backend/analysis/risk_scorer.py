"""
backend/analysis/risk_scorer.py
Deterministic risk scoring from impact analysis metrics.

Formula (weighted sum, each factor normalised to 0–1):
  score = direct_factor*0.30 + transitive_factor*0.25 + depth_factor*0.15
        + coverage_factor*0.20 + churn_factor*0.10

Thresholds:
  score >= 0.65 → HIGH
  score >= 0.35 → MEDIUM
  score <  0.35 → LOW
"""
from __future__ import annotations

from backend.models.impact import RiskAssessment, RiskLevel


def score_risk(
    direct_count:     int,
    transitive_count: int,
    max_depth:        int,
    test_count:       int,
    impact_total:     int,
    avg_churn:        float = 0.0,
) -> RiskAssessment:
    """
    Compute a RiskAssessment from raw impact metrics.
    All inputs are non-negative integers/floats.
    """
    # ── Normalise each factor to [0, 1] ──────────────────────────────────
    direct_factor     = min(direct_count     / 10,  1.0)
    transitive_factor = min(transitive_count / 50,  1.0)
    depth_factor      = min(max_depth        / 8,   1.0)
    churn_factor      = min(avg_churn        / 20,  1.0)

    # Test coverage factor: low coverage = high risk
    # covered_ratio = test nodes / total impacted (0 if no impact)
    if impact_total > 0:
        covered_ratio = min(test_count / impact_total, 1.0)
    else:
        covered_ratio = 1.0  # nothing impacted → full "coverage"
    coverage_factor = 1.0 - covered_ratio   # inverted: low coverage → high risk

    # ── Weighted sum ──────────────────────────────────────────────────────
    score = (
        direct_factor     * 0.30 +
        transitive_factor * 0.25 +
        depth_factor      * 0.15 +
        coverage_factor   * 0.20 +
        churn_factor      * 0.10
    )
    score = round(min(score, 1.0), 4)

    # ── Risk level thresholds ─────────────────────────────────────────────
    if score >= 0.65:
        level = RiskLevel.HIGH
    elif score >= 0.35:
        level = RiskLevel.MEDIUM
    else:
        level = RiskLevel.LOW

    # ── Human-readable contributing factors ──────────────────────────────
    factors: list[str] = []
    if direct_count > 5:
        factors.append(f"Affects {direct_count} components directly")
    if transitive_count > 20:
        factors.append(f"Transitive impact reaches {transitive_count} components")
    if max_depth > 4:
        factors.append(f"Dependency chain depth is {max_depth} hops")
    if impact_total > 0:
        pct = int(covered_ratio * 100)
        if pct < 50:
            factors.append(f"Only {pct}% of affected components have test coverage")
    if avg_churn > 10:
        factors.append(f"This area has high Git churn ({avg_churn:.0f} avg commits)")

    if not factors:
        factors.append("Low impact — change appears well-contained")

    return RiskAssessment(level=level, score=score, contributing_factors=factors)
