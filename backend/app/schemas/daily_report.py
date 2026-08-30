"""
Daily Report schema — request/response models.
"""

import json
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, Field, JsonValue, RootModel, field_serializer

from app.schemas._normalizers import JsonDict, StrList, normalize_json_list
from app.services.zhihu_url import normalize_zhihu_url


def _parse_json_value(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _normalize_top_pick_urls(value: Any) -> Any:
    parsed = _parse_json_value(value)
    if isinstance(parsed, list):
        for pick in parsed:
            if isinstance(pick, dict) and "source_url" in pick:
                pick["source_url"] = normalize_zhihu_url(pick.get("source_url"))
    return parsed


class DailyReportResponse(BaseModel):
    id: int
    owner_user_id: int | None = None
    report_date: str
    weekday: str
    edition: str = "snapshot"
    generated_at: datetime | None = None
    window_start: datetime | None = None
    window_end: datetime | None = None
    cutoff_at: datetime | None = None
    source_scope: str = "curated"
    source_item_ids: Annotated[list[int], BeforeValidator(normalize_json_list)] = Field(default_factory=list)
    overview: str | None = None
    takeaway: str | None = None
    keywords: StrList = Field(default_factory=list)
    trends: Annotated[list[dict[str, JsonValue]], BeforeValidator(normalize_json_list)] = Field(default_factory=list)
    top_picks: Annotated[list[dict[str, JsonValue]], BeforeValidator(normalize_json_list)] = Field(default_factory=list)
    platform_tips: JsonDict = Field(default_factory=dict)
    topic_count: int = 0
    content_count: int = 0
    analyzed_count: int = 0
    status: str = "PENDING"
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_serializer("keywords", "trends", "platform_tips", "source_item_ids")
    def serialize_json_fields(self, value: Any) -> Any:
        return _parse_json_value(value)

    @field_serializer("top_picks")
    def serialize_top_picks(self, value: Any) -> Any:
        return _normalize_top_pick_urls(value)


class DailyReportListResponse(BaseModel):
    items: list[DailyReportResponse]
    total: int


class DailyReportDateSummary(BaseModel):
    """Lightweight summary for the date sidebar."""

    report_date: str
    weekday: str
    takeaway: str | None = None
    status: str = "PENDING"
    edition: str = "snapshot"
    generated_at: datetime | None = None
    cutoff_at: datetime | None = None


class DailyReportDatesResponse(BaseModel):
    """Response for the dates-list endpoint."""

    dates: list[DailyReportDateSummary]


class DailyReportCalendarDay(BaseModel):
    """One day in the report recovery calendar."""

    report_date: str
    weekday: str
    status: str = "MISSING"
    edition: str | None = None
    generated_at: datetime | None = None
    cutoff_at: datetime | None = None
    takeaway: str | None = None
    content_count: int = 0
    analyzed_count: int = 0
    topic_count: int = 0
    has_report: bool = False
    can_generate: bool = True
    is_today: bool = False


class DailyReportCalendarResponse(BaseModel):
    """Response for the daily-report date map."""

    days: list[DailyReportCalendarDay]
    total_days: int
    done_count: int
    error_count: int
    missing_count: int
    generating_count: int


class DailyReportGenerationAcceptedResponse(BaseModel):
    id: int
    report_date: str
    status: Literal["GENERATING"]
    message: str


class DailyReportGenerateVersionResponse(RootModel[DailyReportResponse | DailyReportGenerationAcceptedResponse]):
    pass


class DailyReportWebhookPushResponse(BaseModel):
    sent: bool
    message: str


class DailyReportSparklinePointResponse(BaseModel):
    ts: datetime
    count: int
    baseline: float | None = None


class DailyReportSparklineResponse(BaseModel):
    points: list[DailyReportSparklinePointResponse] = Field(default_factory=list)
    keywords: StrList = Field(default_factory=list)
    total: int
    window_hours: int


class YesterdayTrackingPickResponse(BaseModel):
    title: str
    source_title: str
    rank: int
    old_score: float | None = None
    yesterday_lifecycle: str | None = None
    today_score: float | None = None
    today_lifecycle: str | None = None
    heat_delta_pct: float | None = None
    status: Literal["confirmed", "reversed", "persisted", "dropped"]


class YesterdayMarkedPickResponse(BaseModel):
    title: str
    mark: Literal["write", "watch"]
    category: str | None = None
    today_score: float | None = None
    today_lifecycle: str | None = None
    status: Literal["persisted", "dropped"]


class YesterdayTrackingResponse(BaseModel):
    has_yesterday: bool
    report_date: str
    picks: list[YesterdayTrackingPickResponse] = Field(default_factory=list)
    your_marked: list[YesterdayMarkedPickResponse] = Field(default_factory=list)


class PickMarkResponse(BaseModel):
    report_date: str
    pick_title: str
    action: Literal["write", "watch", "skip"]
    pick_category: str | None = None
    pick_source_url: str | None = None


class PickMarkListResponse(BaseModel):
    marks: list[PickMarkResponse] = Field(default_factory=list)
    total: int


class PickMarkMutationResponse(BaseModel):
    status: Literal["ok"]
    action: Literal["write", "watch", "skip"]


class PickMarkDeleteResponse(BaseModel):
    status: Literal["deleted"]


class WebhookDeliveryLogResponse(BaseModel):
    id: int
    alert_key: str
    event_type: str
    title: str
    severity: str
    webhook_url_preview: str
    status_code: int | None = None
    success: bool
    error_message: str | None = None
    response_preview: str | None = None
    duration_ms: int
    created_at: datetime | None = None


class WebhookDeliveryLogListResponse(BaseModel):
    items: list[WebhookDeliveryLogResponse] = Field(default_factory=list)
    total: int
    limit: int
    offset: int
