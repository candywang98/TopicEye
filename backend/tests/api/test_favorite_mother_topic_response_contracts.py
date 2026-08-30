from __future__ import annotations

from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.api.v1.favorites import router as favorites_router
from app.api.v1.mother_topics import router as mother_topics_router

app = FastAPI()
app.include_router(favorites_router, prefix="/api/v1")
app.include_router(mother_topics_router, prefix="/api/v1")


EXPECTED_RESPONSE_MODELS = {
    ("GET", "/api/v1/favorites/index"): "FavoriteIndexResponse",
    ("GET", "/api/v1/favorites/state"): "FavoriteStateResponse",
    ("POST", "/api/v1/favorites/bulk-delete"): "FavoriteBulkDeleteResponse",
    ("DELETE", "/api/v1/favorites/{favorite_id}"): "FavoriteDeleteResponse",
    ("POST", "/api/v1/mother-topics/fork-defaults"): "MotherTopicForkResponse",
    ("DELETE", "/api/v1/mother-topics/{topic_id}"): "MotherTopicDeleteResponse",
    ("GET", "/api/v1/mother-topics/match/{content_id}"): "MotherTopicMatchResponse",
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


def test_favorite_and_mother_topic_routes_have_explicit_response_models():
    actual = _response_models_by_route()
    for route_key, expected_model in EXPECTED_RESPONSE_MODELS.items():
        assert actual.get(route_key) == expected_model, route_key


def test_favorite_and_mother_topic_contracts_are_present_in_openapi():
    schemas = app.openapi()["components"]["schemas"]
    for expected_model in EXPECTED_RESPONSE_MODELS.values():
        assert expected_model in schemas
