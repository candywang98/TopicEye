from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, JsonValue, field_serializer

from app.schemas._normalizers import StrList, normalize_str_list
from app.schemas.analysis import AiAnalysisResponse
from app.services.content_summary import clean_content_summary
from app.services.zhihu_url import normalize_zhihu_url

normalize_content_tags = normalize_str_list


class ContentResponse(BaseModel):
    id: int
    title: str
    url: str
    source_id: int | None = None
    source_name: str | None = None
    source_type: str | None = None
    platform: str | None = None
    author: str | None = None
    published_at: datetime | None = None
    crawled_at: datetime
    content_hash: str | None = None
    summary: str | None = None
    raw_content: str | None = None
    cover_url: str | None = None
    category: str | None = None
    content_type: str | None = None
    tags: StrList = Field(default_factory=list)
    language: str | None = None
    status: str
    is_favorited: bool = False
    created_at: datetime
    updated_at: datetime
    analysis: AiAnalysisResponse | None = None

    model_config = {"from_attributes": True}

    @field_serializer("url")
    def serialize_url(self, value: str) -> str:
        return normalize_zhihu_url(value)

    @field_serializer("summary")
    def serialize_summary(self, value: str | None) -> str | None:
        # Response-level fallback covers records ingested before summary
        # normalisation was introduced without changing raw article bodies.
        return clean_content_summary(value) or None

class ContentMetricsResponse(BaseModel):
    id: int
    content_id: int
    views: int | None = 0
    likes: int | None = 0
    comments: int | None = 0
    shares: int | None = 0
    favorites: int | None = 0
    followers_count: int | None = 0
    engagement_rate: float | None = 0.0
    explosion_ratio: float | None = 0.0
    snapshot_at: datetime

    model_config = {"from_attributes": True}


class ContentDetailResponse(ContentResponse):
    metrics: list[ContentMetricsResponse] = Field(default_factory=list)


class TodayCountResponse(BaseModel):
    today_content: int
    today_picks: int


class TodayPickScoreBreakdownResponse(BaseModel):
    content_id: int
    base_score: float
    source_bonus: float
    quality_factor: float
    risk_factor: float
    time_decay: float
    diversity_factor: float
    final_score: float
    dimension_scores: dict[str, float]
    selected: bool
    threshold_used: float


class TodayPickAnalysisResponse(BaseModel):
    id: int
    content_id: int
    quality_score: float
    hot_score: float
    freshness_score: float
    creator_score: float
    viral_score: float
    risk_score: float
    platform_fit: JsonValue = None
    recommended_reason: str | None = None
    summary: str | None = None
    key_points: StrList = Field(default_factory=list)
    audience_emotion: str | None = None
    creator_angles: StrList = Field(default_factory=list)
    title_suggestions: StrList = Field(default_factory=list)
    outline_suggestions: JsonValue = None
    xiaohongshu_plan: JsonValue = None
    short_video_plan: JsonValue = None
    risk_notes: JsonValue = None
    curation_score: float
    tags: StrList = Field(default_factory=list)
    recommendation: str | None = None
    info_density: float
    actionability: float
    source_weight: float
    enrichment_status: str
    enrichment: JsonValue = None
    adjusted_curation_score: float
    score_breakdown: TodayPickScoreBreakdownResponse
    created_at: datetime


class ContentNormalizationMemberResponse(BaseModel):
    id: int
    title: str
    url: str | None = None
    source_name: str | None = None
    source_type: str | None = None
    platform: str | None = None
    published_at: datetime | None = None
    crawled_at: datetime | None = None
    relation_type: Literal["duplicate", "corroboration", "update"]
    confidence: float | None = None
    reason: str | None = None


class ContentNormalizationResponse(BaseModel):
    canonical_id: int
    member_count: int
    source_count: int
    has_more: bool
    members: list[ContentNormalizationMemberResponse] = Field(default_factory=list)


class TodayPickContentResponse(BaseModel):
    id: int
    title: str
    url: str
    source_id: int | None = None
    source_name: str | None = None
    source_type: str | None = None
    platform: str | None = None
    author: str | None = None
    published_at: datetime | None = None
    crawled_at: datetime
    content_hash: str | None = None
    summary: str | None = None
    cover_url: str | None = None
    category: str | None = None
    content_type: str | None = None
    tags: StrList = Field(default_factory=list)
    language: str | None = None
    status: str
    is_favorited: bool = False
    created_at: datetime
    updated_at: datetime
    topic_id: int | None = None
    analysis: TodayPickAnalysisResponse
    personalization_boost: float = 0.0
    normalization: ContentNormalizationResponse | None = None


class TodayPickTopicResponse(BaseModel):
    id: int
    name: str
    summary: str | None = None
    keywords: StrList = Field(default_factory=list)
    best_score: float
    content_count: int


class TodayPicksResponse(BaseModel):
    items: list[TodayPickContentResponse]
    total: int
    event_members_hidden: int
    topics: list[TodayPickTopicResponse]
    page: int
    page_size: int


class ContentRelationResponse(BaseModel):
    relation_id: int
    source_id: int
    target_id: int
    relation_type: str
    confidence: float
    evidence: str | None = None
    target_title: str
    target_source_name: str | None = None
    target_category: str | None = None
    target_crawled_at: str | None = None


class ContentRelationsResponse(BaseModel):
    content_id: int
    relations: list[ContentRelationResponse] = Field(default_factory=list)
    count: int


class ContentFavoriteToggleResponse(BaseModel):
    is_favorited: bool
    favorite_id: int | None = None


class ContentIgnoreResponse(BaseModel):
    content_id: int
    ignored: bool
    reason: str


class ContentUnignoreResponse(BaseModel):
    content_id: int
    ignored: bool
    removed: bool


class ContentEvidenceMarkResponse(BaseModel):
    cross_source_level: str
    platform_count: int
    platforms: StrList = Field(default_factory=list)
    evidence_count: int
    independent_publisher_count: int
    has_primary_source: bool
    has_official_source: bool


class ContentEvidenceLinkResponse(BaseModel):
    evidence_content_id: int | None = None
    evidence_url: str | None = None
    evidence_type: str
    publisher_family: str | None = None
    similarity_score: float | None = None
    time_delta_minutes: float | None = None
    match_basis: str | None = None


class ContentEvidenceResponse(BaseModel):
    content_id: int
    evidence_mark: ContentEvidenceMarkResponse | None = None
    evidence_links: list[ContentEvidenceLinkResponse] = Field(default_factory=list)


class ContentEvidenceBatchResponse(BaseModel):
    marks: dict[str, ContentEvidenceMarkResponse] = Field(default_factory=dict)


class ArticleReaderBlock(BaseModel):
    """A safe semantic block extracted from publisher content."""

    type: Literal["heading", "paragraph", "quote", "list_item", "code", "image"]
    # 图片 block 只有 src/alt、没有正文，因此 text 允许缺省为空串
    text: str = ""
    level: int | None = None
    src: str | None = None
    alt: str | None = None


class ArticleReaderResponse(BaseModel):
    """A safe, text-only representation of a source article."""

    content_id: int
    canonical_url: str
    title: str
    byline: str | None = None
    published_at: datetime | None = None
    excerpt: str | None = None
    text_content: str
    content_blocks: list[ArticleReaderBlock] = []
    text_content_zh: str | None = None
    content_blocks_zh: list[ArticleReaderBlock] | None = None
    reading_minutes: int
    extraction_method: str
    fetched_at: datetime
    expires_at: datetime
    cache_status: str


class ContentListResponse(BaseModel):
    items: list[ContentResponse]
    total: int
    page: int
    page_size: int
