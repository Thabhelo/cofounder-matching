"""Unit tests for rules-based matching service."""

import pytest
from app.models.user import User
from app.services.matching import score_match, MIN_MATCH_SCORE


def _user(**kwargs):
    base = {
        "clerk_id": "clerk_1",
        "email": "u@example.com",
        "name": "User",
        "is_active": True,
        "is_banned": False,
    }
    base.update(kwargs)
    return User(**base)


@pytest.mark.unit
class TestMatchingScore:
    def test_score_returns_breakdown_and_total(self):
        me = _user(commitment="full_time", is_technical=True, areas_of_ownership=["engineering"])
        other = _user(commitment="full_time", is_technical=False, areas_of_ownership=["sales_marketing"])
        result = score_match(me, other)
        assert "match_score" in result
        assert "match_explanation" in result
        assert result["complementarity_score"] is not None
        assert result["commitment_alignment_score"] is not None
        assert result["location_fit_score"] is not None
        assert result["intent_score"] is not None
        assert result["interest_overlap_score"] is not None
        assert result["preference_alignment_score"] is not None
        total = (
            result["complementarity_score"]
            + result["commitment_alignment_score"]
            + result["location_fit_score"]
            + result["intent_score"]
            + result["interest_overlap_score"]
            + result["preference_alignment_score"]
        )
        assert result["match_score"] == min(total, 100)

    def test_commitment_match_scores_high(self):
        me = _user(commitment="full_time")
        other = _user(commitment="full_time")
        result = score_match(me, other)
        assert result["commitment_alignment_score"] == 20

    def test_interest_overlap_bonus(self):
        me = _user(topics_of_interest=["AI", "Healthcare", "EdTech"])
        other = _user(topics_of_interest=["AI", "Healthcare", "FinTech"])
        result = score_match(me, other)
        assert result["interest_overlap_score"] >= 2

    def test_min_score_threshold_constant(self):
        assert MIN_MATCH_SCORE == 40
