"""Rules-based matching: score a pair of users (0-100) with breakdown and explanation."""

from __future__ import annotations

from typing import Any

from app.models.user import User

MIN_MATCH_SCORE = 40
COMPLEMENTARITY_MAX = 40
COMMITMENT_MAX = 20
LOCATION_MAX = 15
INTENT_MAX = 15
INTEREST_BONUS_MAX = 5
PREFERENCE_BONUS_MAX = 5

BUILDER_AREAS = {"engineering", "product", "design"}
SELLER_AREAS = {"sales_marketing"}


def _areas_set(user: User) -> set[str]:
    if not user.areas_of_ownership or not isinstance(user.areas_of_ownership, list):
        return set()
    return {str(a).lower().strip() for a in user.areas_of_ownership}


def _topics_set(user: User) -> set[str]:
    if not user.topics_of_interest or not isinstance(user.topics_of_interest, list):
        return set()
    return {str(t).lower().strip() for t in user.topics_of_interest}


def _complementarity_score(me: User, other: User) -> int:
    """Complementarity (40): technical/non-technical, builder/seller, idea stage."""
    score = 0
    my_areas = _areas_set(me)
    other_areas = _areas_set(other)
    my_builder = bool(my_areas & BUILDER_AREAS)
    my_seller = bool(my_areas & SELLER_AREAS)
    other_builder = bool(other_areas & BUILDER_AREAS)
    other_seller = bool(other_areas & SELLER_AREAS)

    # Technical + non-technical or builder + seller
    if me.is_technical != other.is_technical:
        score += 18
    elif me.is_technical and other.is_technical:
        score += 14
    else:
        score += 8

    if (my_builder and other_seller) or (my_seller and other_builder):
        score += 14
    elif (my_builder and other_builder) or (my_seller and other_seller):
        score += 6
    else:
        score += 4

    # Stage alignment (idea_status)
    status_order = {"not_set_on_idea": 0, "have_ideas_flexible": 1, "building_specific_idea": 2}
    my_s = status_order.get(me.idea_status, -1)
    other_s = status_order.get(other.idea_status, -1)
    if my_s >= 0 and other_s >= 0:
        if my_s == other_s:
            score += 8
        elif abs(my_s - other_s) == 1:
            score += 5
        else:
            score += 2

    return min(score, COMPLEMENTARITY_MAX)


def _commitment_score(me: User, other: User) -> int:
    """Commitment alignment (20): full_time/part_time match."""
    c1, c2 = (me.commitment or "").strip().lower(), (other.commitment or "").strip().lower()
    if not c1 or not c2:
        return 10
    if c1 == c2:
        return COMMITMENT_MAX
    if c1 in ("full_time", "part_time") and c2 in ("full_time", "part_time"):
        return 8
    return 5


def _location_score(me: User, other: User) -> int:
    """Location fit (15): same country > same region > remote preference."""
    c1 = (me.location_country or "").strip().lower()
    c2 = (other.location_country or "").strip().lower()
    if c1 and c2:
        if c1 == c2:
            return LOCATION_MAX
        return 8
    me_remote = (me.work_location_preference or "").lower() in ("remote", "hybrid")
    other_remote = (other.work_location_preference or "").lower() in ("remote", "hybrid")
    if me_remote and other_remote:
        return 10
    return 5


def _intent_score(me: User, other: User) -> int:
    """Intent and proof of work (15): links, accomplishment, readiness."""
    def proof(u: User) -> int:
        n = 0
        if u.github_url or u.portfolio_url:
            n += 2
        if u.impressive_accomplishment and len((u.impressive_accomplishment or "").strip()) > 20:
            n += 1
        if (u.ready_to_start or "").strip().lower() in ("now", "1_month"):
            n += 1
        return min(n, 3)

    p1, p2 = proof(me), proof(other)
    if p1 >= 2 and p2 >= 2:
        return 12
    if p1 >= 1 or p2 >= 1:
        return 7
    return 3


def _interest_overlap_score(me: User, other: User) -> int:
    """Interest overlap bonus (5)."""
    my_t = _topics_set(me)
    other_t = _topics_set(other)
    if not my_t or not other_t:
        return 0
    overlap = len(my_t & other_t)
    if overlap >= 3:
        return INTEREST_BONUS_MAX
    if overlap >= 1:
        return 2
    return 0


def _preference_alignment_score(me: User, other: User) -> int:
    """Preference alignment bonus (5): pref_idea_status, pref_technical, areas."""
    s = 0
    if me.pref_idea_status and other.idea_status:
        if me.pref_idea_status == "no_preference" or me.pref_idea_status == other.idea_status:
            s += 1
    if me.pref_technical is not None and other.is_technical is not None:
        if me.pref_technical == other.is_technical:
            s += 2
    if me.pref_cofounder_areas and isinstance(me.pref_cofounder_areas, list):
        other_areas = _areas_set(other)
        want = {str(a).lower().strip() for a in me.pref_cofounder_areas}
        if want and (want & other_areas):
            s += 2
    return min(s, PREFERENCE_BONUS_MAX)


def score_match(me: User, other: User) -> dict[str, Any]:
    """Return total score (0-100), breakdown, and explanation."""
    complementarity = _complementarity_score(me, other)
    commitment = _commitment_score(me, other)
    location = _location_score(me, other)
    intent = _intent_score(me, other)
    interest = _interest_overlap_score(me, other)
    preference = _preference_alignment_score(me, other)
    total = complementarity + commitment + location + intent + interest + preference
    total = min(total, 100)

    explanation = _generate_explanation(
        complementarity, commitment, location, intent, interest, preference, me, other
    )
    return {
        "match_score": total,
        "complementarity_score": complementarity,
        "commitment_alignment_score": commitment,
        "location_fit_score": location,
        "intent_score": intent,
        "interest_overlap_score": interest,
        "preference_alignment_score": preference,
        "match_explanation": explanation,
    }


def _generate_explanation(
    comp: int,
    commitment: int,
    location: int,
    intent: int,
    interest: int,
    preference: int,
    me: User,
    other: User,
) -> str:
    parts = []
    if comp >= 25:
        parts.append(f"Strong complementarity ({comp}/{COMPLEMENTARITY_MAX})")
    elif comp >= 15:
        parts.append(f"Good complementarity ({comp}/{COMPLEMENTARITY_MAX})")
    if commitment >= 15:
        parts.append("Aligned commitment")
    if location >= 10:
        parts.append("Good location fit")
    if intent >= 8:
        parts.append("Both show proof of work")
    if interest > 0:
        parts.append(f"Shared interests (+{interest})")
    if preference > 0:
        parts.append(f"Preference alignment (+{preference})")
    return " ".join(parts) if parts else "Potential match based on profile."
