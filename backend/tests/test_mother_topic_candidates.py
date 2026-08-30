from dataclasses import dataclass

from app.services.mother_topic_candidates import score_text_for_topics


@dataclass
class Topic:
    id: int
    name: str
    keywords: list[str]
    weight: float = 1.0


def test_candidate_scoring_matches_legacy_formula() -> None:
    topics = [Topic(id=1, name="AI", keywords=["AI", "Agent", "工作流"], weight=1.0)]
    score = score_text_for_topics(
        title="AI Agent 工作流",
        summary="",
        hot_value=0,
        topics=topics,
    )[0]

    assert score.keyword_score == 1.0
    assert score.final == 90.9
    assert score.matched_keywords == ("AI", "Agent", "工作流")


def test_candidate_scoring_is_sorted_and_keeps_freshness() -> None:
    topics = [
        Topic(id=1, name="weak", keywords=["missing"]),
        Topic(id=2, name="strong", keywords=["alpha", "beta"], weight=1.2),
    ]
    scores = score_text_for_topics(
        title="alpha beta",
        summary=None,
        hot_value=5000,
        topics=topics,
    )

    assert [score.name for score in scores] == ["strong", "weak"]
    assert scores[0].freshness == 0.5
    assert scores[0].final > scores[1].final
