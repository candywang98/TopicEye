"""Runtime coverage for the lightweight PostgreSQL analytics path."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime

import pytest
from fastapi import Response
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.v1 import stats, trends
from app.models.analysis import AiAnalysis
from app.models.content import ContentItem, ContentStatus
from app.models.source import Source, SourceStatus, SourceType
from app.models.trend import TopicTrend
from app.services.json_cache import invalidate_json_cache
from app.services.postgres_stats import build_dashboard
from app.services.today_picks import build_today_picks
from test_database_guard import validated_test_database_url


def _postgres_session_factory():
    engine = create_async_engine(validated_test_database_url(), pool_pre_ping=True)
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.mark.asyncio
async def test_postgres_dashboard_and_today_picks_use_latest_analysis(monkeypatch):
    monkeypatch.setattr(stats.settings, "ANALYTICS_ENGINE", "postgres")
    now = datetime.now(UTC)
    engine, session_factory = _postgres_session_factory()

    async with session_factory() as db:
        source = Source(
            name="PostgreSQL 测试信源",
            source_type=SourceType.RSS,
            url="https://example.com/feed.xml",
            status=SourceStatus.ACTIVE,
            weight=4,
        )
        db.add(source)
        await db.flush()
        content = ContentItem(
            title="PostgreSQL 在线分析样本",
            url="https://example.com/item",
            source_id=source.id,
            source_name=source.name,
            source_type=SourceType.RSS,
            category="AI",
            status=ContentStatus.ANALYZED,
            crawled_at=now,
            created_at=now,
            updated_at=now,
        )
        db.add(content)
        await db.flush()
        db.add_all(
            [
                AiAnalysis(content_id=content.id, curation_score=10, risk_score=0, created_at=now.replace(year=2025)),
                AiAnalysis(
                    content_id=content.id,
                    curation_score=96,
                    info_density=95,
                    actionability=95,
                    source_weight=95,
                    creator_score=95,
                    viral_score=95,
                    freshness_score=95,
                    quality_score=95,
                    hot_score=95,
                    risk_score=0,
                    created_at=now,
                ),
            ]
        )
        await db.commit()

    async with session_factory() as db:
        dashboard = await build_dashboard(db, days=7)
        picks = await build_today_picks(db, hours=48, limit=20)
    await engine.dispose()

    assert dashboard["overview"]["total"] == 1
    assert dashboard["overview"]["analyzed"] == 1
    assert dashboard["categories"] == [{"category": "AI", "content_count": 1, "avg_score": 96.0}]
    assert picks["total"] == 1
    assert [item["id"] for item in picks["items"]] == [content.id]
    assert picks["items"][0]["analysis"]["curation_score"] == 96


@pytest.mark.asyncio
async def test_postgres_stats_and_trends_expose_backend_header(monkeypatch):
    monkeypatch.setattr(stats.settings, "ANALYTICS_ENGINE", "postgres")
    monkeypatch.setattr(trends.settings, "ANALYTICS_ENGINE", "postgres")
    invalidate_json_cache()
    engine, session_factory = _postgres_session_factory()
    monkeypatch.setattr(stats, "async_session", session_factory)

    async with session_factory() as db:
        db.add(
            TopicTrend(
                snapshot_date=date.today(),
                topic_id=101,
                topic_name="性能优化",
                keyword=None,
                content_count=3,
                avg_score=88,
                max_score=95,
                pick_count=2,
                top_items=[],
                provenance_status="complete",
            )
        )
        db.add(
            TopicTrend(
                snapshot_date=date.today(),
                topic_id=None,
                topic_name=None,
                keyword="性能",
                content_count=4,
                avg_score=0,
                max_score=0,
                pick_count=0,
                top_items=[],
                provenance_status="complete",
            )
        )
        await db.commit()

    stats_response = await stats.get_dashboard_stats(days=7)
    assert stats_response.headers["X-Analytics-Backend"] == "postgres"
    assert json.loads(stats_response.body)["overview"]["total"] == 0

    async with session_factory() as db:
        topic_response = Response()
        topic_payload = await trends.topic_trends(response=topic_response, days=7, db=db)
        keyword_response = Response()
        keyword_payload = await trends.keyword_cloud(response=keyword_response, days=7, limit=50, db=db)

    assert topic_response.headers["X-Analytics-Backend"] == "postgres"
    assert keyword_response.headers["X-Analytics-Backend"] == "postgres"
    assert topic_payload["trends"][0]["topic_name"] == "性能优化"
    assert keyword_payload["keywords"] == [{"keyword": "性能", "count": 4, "traceability": "complete"}]
    invalidate_json_cache()
    await engine.dispose()
