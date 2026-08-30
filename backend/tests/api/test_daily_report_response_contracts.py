from __future__ import annotations

from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.api.v1.daily_reports import router as daily_reports_router

app = FastAPI()
app.include_router(daily_reports_router, prefix="/api/v1")


EXPECTED_RESPONSE_MODELS = {
    ("POST", "/api/v1/daily-reports/generate-version"): "DailyReportGenerateVersionResponse",
    ("POST", "/api/v1/daily-reports/push-webhook"): "DailyReportWebhookPushResponse",
    ("GET", "/api/v1/daily-reports/sparkline"): "DailyReportSparklineResponse",
    ("GET", "/api/v1/daily-reports/yesterday-tracking"): "YesterdayTrackingResponse",
    ("GET", "/api/v1/daily-reports/me/yesterday-tracking"): "YesterdayTrackingResponse",
    ("GET", "/api/v1/daily-reports/pick-marks"): "PickMarkListResponse",
    ("POST", "/api/v1/daily-reports/pick-marks"): "PickMarkMutationResponse",
    ("DELETE", "/api/v1/daily-reports/pick-marks"): "PickMarkDeleteResponse",
    ("GET", "/api/v1/daily-reports/webhook-logs"): "WebhookDeliveryLogListResponse",
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


def test_daily_report_routes_have_explicit_response_models():
    actual = _response_models_by_route()
    for route_key, expected_model in EXPECTED_RESPONSE_MODELS.items():
        assert actual.get(route_key) == expected_model, route_key


def test_daily_report_contracts_are_present_in_openapi():
    schemas = app.openapi()["components"]["schemas"]
    for expected_model in set(EXPECTED_RESPONSE_MODELS.values()):
        assert expected_model in schemas
