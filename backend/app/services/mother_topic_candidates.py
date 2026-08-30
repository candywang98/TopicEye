"""Pure scoring helpers for paginated mother-topic candidates."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class TopicLike(Protocol):
    id: int
    name: str
    keywords: list[str]
    weight: float


@dataclass(frozen=True)
class TopicCandidateScore:
    topic_id: int
    name: str
    keyword_score: float
    weight: float
    freshness: float
    final: float
    matched_keywords: tuple[str, ...]


def score_text_for_topics(
    *,
    title: str,
    summary: str | None,
    hot_value: int,
    topics: list[TopicLike],
) -> list[TopicCandidateScore]:
    """Match the legacy score-batch formula exactly, once on the server."""
    text = f"{title} {summary or ''}".lower()
    freshness = min(1.0, hot_value / 10000)
    scores: list[TopicCandidateScore] = []

    for topic in topics:
        keywords = tuple(str(keyword) for keyword in (topic.keywords or []) if str(keyword).strip())
        matched = tuple(keyword for keyword in keywords if keyword.lower() in text)
        matched_count = len(matched)
        keyword_score = (
            min(1.0, matched_count * 0.3 + (0.0 if matched_count < 2 else 0.1 * (matched_count - 2)))
            if matched_count
            else 0.0
        )
        raw = keyword_score * topic.weight + freshness * 0.1
        final = round(min(raw * (100 / 1.1), 100), 1)
        scores.append(
            TopicCandidateScore(
                topic_id=topic.id,
                name=topic.name,
                keyword_score=round(keyword_score, 3),
                weight=topic.weight,
                freshness=round(freshness, 3),
                final=final,
                matched_keywords=matched,
            )
        )

    scores.sort(key=lambda score: score.final, reverse=True)
    return scores
