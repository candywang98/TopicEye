from __future__ import annotations

from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.api.v1.sources import router as sources_router

app = FastAPI()
app.include_router(sources_router, prefix="/api/v1")


EXPECTED_RESPONSE_MODELS = {
    ("GET", "/api/v1/sources/me/recognize"): "SourceRecognitionResponse",
    ("GET", "/api/v1/sources/{source_id}/evidence-profile"): "SourceEvidenceProfileResponse",
    ("PUT", "/api/v1/sources/{source_id}/evidence-profile"): "SourceEvidenceProfileUpdateResponse",
    ("POST", "/api/v1/sources/reorder"): "SourceReorderResponse",
    ("POST", "/api/v1/sources/import-opml"): "SourceImportResponse",
    ("POST", "/api/v1/sources/preview-batch"): "SourceBatchPreviewResponse",
    ("POST", "/api/v1/sources/import-batch"): "SourceImportResponse",
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


def test_source_routes_have_explicit_response_models():
    actual = _response_models_by_route()
    for route_key, expected_model in EXPECTED_RESPONSE_MODELS.items():
        assert actual.get(route_key) == expected_model, route_key


def test_source_contracts_are_present_in_openapi():
    schemas = app.openapi()["components"]["schemas"]
    for expected_model in set(EXPECTED_RESPONSE_MODELS.values()):
        assert expected_model in schemas


def test_204_source_delete_routes_are_explicitly_bodyless():
    routes = {
        (method, route.path): route for route in app.routes if isinstance(route, APIRoute) for method in route.methods
    }
    for route_key in {
        ("DELETE", "/api/v1/sources/me/{source_id}"),
        ("DELETE", "/api/v1/sources/{source_id}"),
    }:
        route = routes[route_key]
        assert route.status_code == 204
        assert route.response_model is None
