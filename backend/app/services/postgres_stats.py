"""PostgreSQL-native analytics used by the lightweight online path."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fanqie import FanqieBook
from app.models.qimao import QimaoBook
from app.models.zhihu import ZhihuAlbum
from app.services._duckdb_stats_helpers import (
    selected_stats_items,
    stats_date_key,
    stats_row_to_scoring_input,
    stats_source_key,
    stats_threshold_from_scored,
)
from app.services.feedback_signal import get_feedback_scores
from app.services.scoring_engine import score_items

_BASE_SCOPE = """
    c.crawled_at >= :cutoff
    AND NOT EXISTS (SELECT 1 FROM ignored_items ignored WHERE ignored.content_id = c.id)
    AND NOT EXISTS (
        SELECT 1
        FROM content_event_members event_member
        JOIN content_event_groups event_group ON event_group.id = event_member.event_group_id
        WHERE event_member.content_id = c.id
          AND event_group.status = 'active'
          AND event_member.review_status IN ('auto', 'confirmed')
    )
"""

_LATEST_ANALYSIS_JOIN = """
LEFT JOIN LATERAL (
    SELECT analysis.*
    FROM ai_analyses analysis
    WHERE analysis.content_id = c.id
    ORDER BY analysis.created_at DESC, analysis.id DESC
    LIMIT 1
) a ON TRUE
"""


async def _scored_items(db: AsyncSession, *, days: int) -> list[dict[str, Any]]:
    cutoff = datetime.now(UTC) - timedelta(days=days)
    result = await db.execute(
        text(f"""
        SELECT c.id, c.source_id,
               COALESCE(s.name, c.source_name, '未知') AS source_name,
               LOWER(COALESCE(s.source_type::text, c.source_type::text, 'unknown')) AS source_type,
               COALESCE(c.category, '未分类') AS category,
               c.crawled_at, a.curation_score, a.info_density, a.actionability,
               a.source_weight AS analysis_source_weight, a.creator_score,
               a.viral_score, a.freshness_score, a.quality_score, a.hot_score,
               a.risk_score, COALESCE(s.weight, 3) AS source_weight_db
        FROM content_items c
        {_LATEST_ANALYSIS_JOIN}
        LEFT JOIN sources s ON s.id = c.source_id
        WHERE {_BASE_SCOPE} AND a.curation_score IS NOT NULL
    """),
        {"cutoff": cutoff},
    )
    rows = [dict(row._mapping) for row in result.all()]
    feedback = await get_feedback_scores(db, [int(row["id"]) for row in rows])
    for row in rows:
        row["feedback_score"] = feedback.get(int(row["id"]), 0)
    row_map = {int(row["id"]): row for row in rows}
    output: list[dict[str, Any]] = []
    for breakdown, item in score_items([stats_row_to_scoring_input(row) for row in rows]):
        row = dict(row_map[item.content_id])
        row.update(
            final_score=breakdown.final_score,
            threshold_used=breakdown.threshold_used,
            selected=breakdown.selected,
        )
        output.append(row)
    return output


def _selected_by_source(scored: list[dict[str, Any]]) -> dict[tuple[str, str], int]:
    counts: dict[tuple[str, str], int] = {}
    for item in selected_stats_items(scored):
        key = stats_source_key(item)
        counts[key] = counts.get(key, 0) + 1
    return counts


def _selected_by_date(scored: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in selected_stats_items(scored):
        key = stats_date_key(item.get("crawled_at"))
        counts[key] = counts.get(key, 0) + 1
    return counts


async def build_overview(db: AsyncSession, *, days: int, scored: list[dict[str, Any]] | None = None) -> dict:
    cutoff = datetime.now(UTC) - timedelta(days=days)
    today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    if scored is None:
        scored = await _scored_items(db, days=days)
    row = (
        await db.execute(
            text(f"""
        SELECT COUNT(c.id) AS total,
               COUNT(c.id) FILTER (WHERE a.curation_score IS NOT NULL) AS analyzed,
               COUNT(c.id) FILTER (WHERE c.crawled_at >= :today) AS today_new
        FROM content_items c {_LATEST_ANALYSIS_JOIN}
        WHERE {_BASE_SCOPE}
    """),
            {"cutoff": cutoff, "today": today},
        )
    ).one()
    return {
        "total": int(row.total or 0),
        "analyzed": int(row.analyzed or 0),
        "curated": len(selected_stats_items(scored)),
        "curation_threshold": stats_threshold_from_scored(scored),
        "today_new": int(row.today_new or 0),
    }


async def build_source_distribution(db: AsyncSession, *, days: int, scored: list[dict[str, Any]] | None = None) -> dict:
    cutoff = datetime.now(UTC) - timedelta(days=days)
    if scored is None:
        scored = await _scored_items(db, days=days)
    selected = _selected_by_source(scored)
    rows = (
        await db.execute(
            text(f"""
        SELECT COALESCE(s.name, c.source_name, '未知') AS source_name,
               LOWER(COALESCE(s.source_type::text, c.source_type::text, 'unknown')) AS source_type,
               COUNT(c.id) AS content_count
        FROM content_items c
        LEFT JOIN sources s ON s.id = c.source_id
        WHERE {_BASE_SCOPE}
        GROUP BY 1, 2 ORDER BY content_count DESC LIMIT 20
    """),
            {"cutoff": cutoff},
        )
    ).all()
    return {
        "sources": [
            {
                "source_name": row.source_name,
                "source_type": row.source_type,
                "content_count": int(row.content_count or 0),
                "curated_count": selected.get((row.source_name, row.source_type), 0),
                "curation_rate": round(
                    selected.get((row.source_name, row.source_type), 0) / int(row.content_count) * 100, 1
                )
                if row.content_count
                else 0,
            }
            for row in rows
        ]
    }


async def build_category_distribution(db: AsyncSession, *, days: int) -> dict:
    cutoff = datetime.now(UTC) - timedelta(days=days)
    rows = (
        await db.execute(
            text(f"""
        SELECT COALESCE(c.category, '未分类') AS category, COUNT(c.id) AS content_count,
               ROUND(AVG(a.curation_score)::numeric, 1) AS avg_score
        FROM content_items c {_LATEST_ANALYSIS_JOIN}
        WHERE {_BASE_SCOPE}
        GROUP BY c.category ORDER BY content_count DESC
    """),
            {"cutoff": cutoff},
        )
    ).all()
    return {
        "categories": [
            {
                "category": row.category,
                "content_count": int(row.content_count or 0),
                "avg_score": float(row.avg_score or 0),
            }
            for row in rows
        ]
    }


async def build_daily_trend(db: AsyncSession, *, days: int, scored: list[dict[str, Any]] | None = None) -> dict:
    cutoff = datetime.now(UTC) - timedelta(days=days)
    if scored is None:
        scored = await _scored_items(db, days=days)
    selected = _selected_by_date(scored)
    rows = (
        await db.execute(
            text(f"""
        SELECT c.crawled_at::date AS crawl_date, COUNT(c.id) AS content_count,
               COUNT(c.id) FILTER (WHERE a.id IS NOT NULL) AS analyzed_count,
               ROUND(AVG(a.curation_score)::numeric, 1) AS avg_curation
        FROM content_items c {_LATEST_ANALYSIS_JOIN}
        WHERE {_BASE_SCOPE}
        GROUP BY c.crawled_at::date ORDER BY crawl_date
    """),
            {"cutoff": cutoff},
        )
    ).all()
    return {
        "trend": [
            {
                "date": row.crawl_date.isoformat(),
                "content_count": int(row.content_count or 0),
                "curated_count": selected.get(row.crawl_date.isoformat(), 0),
                "analyzed_count": int(row.analyzed_count or 0),
                "avg_curation": float(row.avg_curation or 0),
            }
            for row in rows
        ]
    }


async def build_novel_platforms(db: AsyncSession) -> dict:
    async def count_and_max(model, timestamp):
        row = (await db.execute(select(func.count(model.id), func.max(timestamp)))).one()
        return int(row[0] or 0), row[1].isoformat() if row[1] else None

    fanqie = await count_and_max(FanqieBook, FanqieBook.crawled_at)
    qimao = await count_and_max(QimaoBook, QimaoBook.crawled_at)
    zhihu = await count_and_max(ZhihuAlbum, ZhihuAlbum.updated_at)
    return {
        "platforms": [
            {"name": "番茄小说", "table": "fanqie", "count": fanqie[0], "last_sync": fanqie[1]},
            {"name": "七猫小说", "table": "qimao", "count": qimao[0], "last_sync": qimao[1]},
            {"name": "知乎盐选", "table": "zhihu", "count": zhihu[0], "last_sync": zhihu[1]},
        ]
    }


async def build_dashboard(db: AsyncSession, *, days: int) -> dict:
    scored = await _scored_items(db, days=days)
    overview = await build_overview(db, days=days, scored=scored)
    sources = await build_source_distribution(db, days=days, scored=scored)
    categories = await build_category_distribution(db, days=days)
    trend = await build_daily_trend(db, days=days, scored=scored)
    platforms = await build_novel_platforms(db)
    selected = selected_stats_items(scored)
    return {
        "overview": overview,
        "sources": sources["sources"],
        "categories": categories["categories"],
        "trend": trend["trend"],
        "platforms": platforms["platforms"],
        "kpi": {
            "total_crawled": overview["total"],
            "total_curated": len(selected),
            "avg_curation": round(sum(float(item.get("curation_score") or 0) for item in scored) / len(scored), 1)
            if scored
            else 0,
            "active_sources": len({item.get("source_id") for item in scored if item.get("source_id") is not None}),
        },
        "source_breakdown": [{**source, "avg_score": 0} for source in sources["sources"]],
        "daily_trend": trend["trend"],
    }
