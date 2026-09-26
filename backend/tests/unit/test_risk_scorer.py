"""
backend/tests/unit/test_risk_scorer.py
Unit tests for the risk scorer.
"""
import pytest

from backend.analysis.risk_scorer import score_risk
from backend.models.impact import RiskLevel


class TestScoreRisk:

    def test_returns_risk_assessment(self):
        r = score_risk(0, 0, 0, 0, 0)
        assert r.level in (RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW)
        assert 0.0 <= r.score <= 1.0
        assert isinstance(r.contributing_factors, list)

    def test_zero_impact_is_low(self):
        r = score_risk(direct_count=0, transitive_count=0, max_depth=0,
                       test_count=0, impact_total=0)
        assert r.level == RiskLevel.LOW

    def test_high_risk_scenario(self):
        # Many direct, many transitive, deep chain, no tests, high churn
        r = score_risk(
            direct_count=15,
            transitive_count=100,
            max_depth=10,
            test_count=0,
            impact_total=115,
            avg_churn=30.0,
        )
        assert r.level == RiskLevel.HIGH
        assert r.score >= 0.65

    def test_medium_risk_scenario(self):
        r = score_risk(
            direct_count=4,
            transitive_count=10,
            max_depth=3,
            test_count=2,
            impact_total=14,
        )
        assert r.level in (RiskLevel.MEDIUM, RiskLevel.LOW)

    def test_low_risk_well_tested(self):
        # Small impact, fully tested
        r = score_risk(
            direct_count=1,
            transitive_count=1,
            max_depth=1,
            test_count=5,
            impact_total=2,
        )
        assert r.level == RiskLevel.LOW

    def test_score_capped_at_one(self):
        r = score_risk(1000, 1000, 1000, 0, 1000, avg_churn=1000.0)
        assert r.score <= 1.0

    def test_score_non_negative(self):
        r = score_risk(0, 0, 0, 100, 100)
        assert r.score >= 0.0

    def test_contributing_factors_populated_for_high_risk(self):
        r = score_risk(
            direct_count=15,
            transitive_count=60,
            max_depth=9,
            test_count=0,
            impact_total=75,
            avg_churn=25.0,
        )
        assert len(r.contributing_factors) >= 2

    def test_low_risk_has_fallback_message(self):
        r = score_risk(0, 0, 0, 0, 0)
        assert len(r.contributing_factors) >= 1
        assert "well-contained" in r.contributing_factors[0].lower()

    def test_coverage_factor_inverted(self):
        # Full test coverage → lower risk than no coverage
        no_coverage  = score_risk(5, 5, 3, 0,  10)
        full_coverage = score_risk(5, 5, 3, 10, 10)
        assert full_coverage.score < no_coverage.score

    def test_thresholds_high(self):
        r = score_risk(0, 0, 0, 0, 0)
        r.score = 0.65
        from backend.analysis.risk_scorer import score_risk as sr
        high = sr(15, 100, 10, 0, 115, 30)
        assert high.level == RiskLevel.HIGH

    def test_thresholds_medium(self):
        r = score_risk(3, 8, 3, 1, 10)
        assert r.level in (RiskLevel.MEDIUM, RiskLevel.LOW)
