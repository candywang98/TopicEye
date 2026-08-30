from __future__ import annotations

from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.api.v1.contents import router as contents_router

app = FastAPI()
app.include_router(contents_router, prefix="/api/v1")


EXPECTED_CONTENT_RESPONSE_MODELS = {
    ("GET", "/api/v1/contents"): "ContentListResponse",
    ("GET", "/api/v1/contents/today-picks"): "TodayPicksResponse",
    ("GET", "/api/v1/contents/today-count"): "TodayCountResponse",
    ("GET", "/api/v1/contents/scoring-flow"): "ScoringFlowResponse",
    ("GET", "/api/v1/contents/{content_id}"): "ContentDetailResponse",
    ("GET", "/api/v1/contents/{content_id}/relations"): "ContentRelationsResponse",
    ("POST", "/api/v1/contents/{content_id}/favorite"): "ContentFavoriteToggleResponse",
    ("POST", "/api/v1/contents/{content_id}/ignore"): "ContentIgnoreResponse",
    ("DELETE", "/api/v1/contents/{content_id}/ignore"): "ContentUnignoreResponse",
    ("GET", "/api/v1/contents/{content_id}/evidence"): "ContentEvidenceResponse",
    ("GET", "/api/v1/contents/evidence-batch"): "ContentEvidenceBatchResponse",
}


def _response_models_by_route() -> dict[tuple[str, str], str | None]:
    result: dict[tuple[str, str], str | None] = {}
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        model_name = getattr(route.response_model, "__name__", None)
        for method in route.methods:
            result[(method, route.path)] = model_name
    return result


def test_p0_content_routes_have_explicit_response_models():
    actual = _response_models_by_route()
    for route_key, expected_model in EXPECTED_CONTENT_RESPONSE_MODELS.items():
        assert actual.get(route_key) == expected_model, route_key


def test_p0_content_contracts_are_present_in_openapi():
    schemas = app.openapi()["components"]["schemas"]
    for expected_model in EXPECTED_CONTENT_RESPONSE_MODELS.values():
        assert expected_model in schemas
