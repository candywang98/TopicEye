from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.schemas._normalizers import normalize_json_dict, normalize_json_list, normalize_str_list
from app.schemas.analysis import AiAnalysisResponse
from app.schemas.content import ContentResponse
from app.schemas.daily_report import DailyReportResponse
from app.schemas.monthly_digest import MonthlyDigestResponse
from app.schemas.weekly_digest import WeeklyDigestResponse


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (None, []),
        ("null", []),
        ("", []),
        ([], []),
        (["a", "b"], ["a", "b"]),
        ('["a", "b"]', ["a", "b"]),
        ('"[\\"a\\", \\"b\\"]"', ["a", "b"]),
        ('"abc"', ["abc"]),
        ("a,b", ["a", "b"]),
        ("a，b", ["a", "b"]),
        ("abc", ["abc"]),
        ([" a ", "a", 2], ["a", "2"]),
    ],
)
def test_normalize_str_list(value, expected):
    assert normalize_str_list(value) == expected


@pytest.mark.parametrize("value", [{"a": 1}, 1, True, ("a",)])
def test_normalize_str_list_rejects_unsupported_values(value):
    with pytest.raises(ValueError, match="cannot normalize"):
        normalize_str_list(value)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (None, {}),
        ("null", {}),
        ("", {}),
        ({}, {}),
        ({"a": 1}, {"a": 1}),
        ('{"a": 1}', {"a": 1}),
        ('"{\\"a\\": 1}"', {"a": 1}),
        ({1: "value"}, {"1": "value"}),
        ('{"nested": {"ok": true}}', {"nested": {"ok": True}}),
        ('{"items": [1, 2]}', {"items": [1, 2]}),
    ],
)
def test_normalize_json_dict(value, expected):
    assert normalize_json_dict(value) == expected


@pytest.mark.parametrize("value", ["not-json", "[]", [], 1, True])
def test_normalize_json_dict_rejects_non_objects(value):
    with pytest.raises(ValueError, match="cannot normalize"):
        normalize_json_dict(value)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (None, []),
        ([], []),
        ('[1, "a"]', [1, "a"]),
        ('"[1, \\"a\\"]"', [1, "a"]),
    ],
)
def test_normalize_json_list(value, expected):
    assert normalize_json_list(value) == expected


def test_content_response_normalizes_real_incident_tags():
    now = datetime.now(UTC)
    payload = {
        "id": 1,
        "title": "test",
        "url": "https://example.com/item",
        "crawled_at": now,
        "status": "analyzed",
        "created_at": now,
        "updated_at": now,
        "tags": '"abc"',
    }
    assert ContentResponse.model_validate(payload).tags == ["abc"]


def test_analysis_response_normalizes_legacy_string_lists():
    payload = {
        "id": 1,
        "content_id": 1,
        "created_at": datetime.now(UTC),
        "tags": "ai,agent",
        "key_points": '["迁移风险", "回滚方案"]',
        "creator_angles": "工程团队视角",
        "title_suggestions": '"AI 迁移为什么容易失败"',
    }
    result = AiAnalysisResponse.model_validate(payload)
    assert result.tags == ["ai", "agent"]
    assert result.key_points == ["迁移风险", "回滚方案"]
    assert result.creator_angles == ["工程团队视角"]
    assert result.title_suggestions == ["AI 迁移为什么容易失败"]


@pytest.mark.parametrize(
    ("schema", "payload", "expected"),
    [
        (
            DailyReportResponse,
            {"id": 1, "report_date": "2026-08-29", "weekday": "周六", "keywords": '"AI"'},
            ["AI"],
        ),
        (
            WeeklyDigestResponse,
            {
                "id": 1,
                "week_key": "2026-W35",
                "week_label": "第 35 周",
                "week_start": "2026-08-24",
                "week_end": "2026-08-30",
                "keywords": "AI,Agent",
            },
            ["AI", "Agent"],
        ),
        (
            MonthlyDigestResponse,
            {
                "id": 1,
                "month_key": "2026-08",
                "month_label": "2026 年 8 月",
                "month_start": "2026-08-01",
                "month_end": "2026-08-31",
                "keywords": '["AI", "Agent"]',
            },
            ["AI", "Agent"],
        ),
    ],
)
def test_report_keywords_are_normalized(schema, payload, expected):
    assert schema.model_validate(payload).keywords == expected
