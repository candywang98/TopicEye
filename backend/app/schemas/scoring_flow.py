from datetime import datetime

from pydantic import BaseModel, Field


class ScoringFlowCacheResponse(BaseModel):
    hit: bool
    mode: str
    age_ms: float


class ScoringFlowMixResponse(BaseModel):
    label: str
    count: int


class ScoringFlowStageResponse(BaseModel):
    key: str
    label: str
    count: int
    retention: float


class ScoringFlowWindowOptionResponse(BaseModel):
    hours: int
    count: int


class ScoringFlowDiagnosticsResponse(BaseModel):
    analyzed_total: int
    window_total: int
    collected_window_total: int
    pending_analysis_total: int
    window_options: list[ScoringFlowWindowOptionResponse]
    collected_window_options: list[ScoringFlowWindowOptionResponse]
    recommended_hours: int | None = None
    loaded_count: int
    scoring_input_count: int
    scored_count: int
    ignored_count: int
    candidate_limit: int
    sample_limit: int
    empty_reason: str
    generated_at: datetime


class ScoringFlowConfigResponse(BaseModel):
    curation_mode: str
    curation_percentile: float
    curation_threshold: float
    min_selected_base_score: float
    quality_gate_min: float
    quality_gate_strong: float
    quality_gate_floor: float
    risk_threshold: float
    risk_soft_start: float
    risk_soft_floor: float
    time_decay_lambda: float
    time_decay_floor: float
    diversity_top_n: int
    same_source_grace: int
    same_category_grace: int


class ScoringFlowSampleResponse(BaseModel):
    id: int
    title: str
    url: str
    source_name: str | None = None
    category: str
    summary: str | None = None
    recommendation: str | None = None
    tags: list[str] = Field(default_factory=list)
    creator_angles: list[str] = Field(default_factory=list)
    is_favorited: bool
    selected: bool
    final_score: float
    threshold_used: float
    base_score: float
    source_bonus: float
    quality_factor: float
    risk_factor: float
    time_decay: float
    diversity_factor: float
    feedback_score: float
    dimension_scores: dict[str, float]


class ScoringFlowResponse(BaseModel):
    total: int
    scored: int
    hours: int
    cache: ScoringFlowCacheResponse
    diagnostics: ScoringFlowDiagnosticsResponse
    scoring_config: ScoringFlowConfigResponse
    stages: list[ScoringFlowStageResponse]
    samples: list[ScoringFlowSampleResponse]
    category_mix: list[ScoringFlowMixResponse]
    source_mix: list[ScoringFlowMixResponse]
