from __future__ import annotations

import pytest
from fastapi import HTTPException, Request
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1.auth import get_current_user, get_optional_current_user
from app.api.v1.oauth import oauth_providers
from app.core.config import Settings, settings
from app.core.database import Base
from app.main import ensure_local_no_login_safety
from app.models.app_setting import AppSetting
from app.models.user import User, UserApiToken, UserSession
from app.repositories.app_setting_repo import AppSettingRepository
from app.services.auth_service import create_user
from app.services.local_workspace_service import (
    LOCAL_WORKSPACE_EMAIL,
    ensure_local_workspace,
    get_local_workspace_user,
)
from app.services.plan_catalog import plan_allows_private_source, private_sources_quota

_TEST_DB_URL = "postgresql+asyncpg://test:test@localhost:5432/test"


def _request(*, cookie: str | None = None) -> Request:
    headers = [] if cookie is None else [(b"cookie", cookie.encode("ascii"))]
    return Request(
        {
            "type": "http",
            "client": ("127.0.0.1", 0),
            "headers": headers,
            "query_string": b"",
            "path": "/auth/me",
            "method": "GET",
        }
    )


@pytest.mark.asyncio
async def test_local_workspace_reuses_identity_and_removes_password():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, tables=[User.__table__, AppSetting.__table__])

    async with session_factory() as db:
        existing = await create_user(
            db,
            email=LOCAL_WORKSPACE_EMAIL,
            password="PreviouslyExposedPassword123!",
            display_name="Existing Workspace",
        )
        existing_id = existing.id
        existing.is_active = False
        await db.flush()

        local_user = await ensure_local_workspace(db)
        await db.commit()

        assert local_user.id == existing_id
        assert local_user.password_hash is None
        assert local_user.display_name == "Existing Workspace"
        assert local_user.role == "admin"
        assert local_user.plan == "pro"
        assert local_user.is_active is True
        assert (await AppSettingRepository(db).list_feature_flags())["webnovel_module"] is True
        assert (await get_local_workspace_user(db)).id == existing_id

        second = await ensure_local_workspace(db)
        assert second.id == existing_id

    await engine.dispose()


@pytest.mark.asyncio
async def test_auth_dependencies_use_local_identity_without_browser_session(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(
            Base.metadata.create_all,
            tables=[User.__table__, UserSession.__table__, UserApiToken.__table__, AppSetting.__table__],
        )

    monkeypatch.setattr(settings, "LOCAL_NO_LOGIN_ENABLED", True)
    async with session_factory() as db:
        local_user = await ensure_local_workspace(db)
        await db.commit()

        stale_cookie = f"{settings.AUTH_COOKIE_NAME}=stale-session"
        assert await get_current_user(_request(cookie=stale_cookie), None, db) is local_user
        assert await get_optional_current_user(_request(), None, db) is local_user

        with pytest.raises(HTTPException, match="Invalid or expired token") as exc_info:
            await get_current_user(_request(), "Bearer invalid-token", db)
        assert exc_info.value.status_code == 401

    await engine.dispose()


def test_local_no_login_defaults_off_and_environment_is_restricted(monkeypatch):
    monkeypatch.delenv("LOCAL_NO_LOGIN_ENABLED", raising=False)
    configured = Settings(_env_file=None, DATABASE_URL=_TEST_DB_URL, APP_ENV="local")
    assert configured.LOCAL_NO_LOGIN_ENABLED is False
    assert configured.local_no_login_environment_allowed is True

    monkeypatch.setattr(settings, "LOCAL_NO_LOGIN_ENABLED", True)
    monkeypatch.setattr(settings, "APP_ENV", "production")
    with pytest.raises(RuntimeError, match="LOCAL_NO_LOGIN_ENABLED"):
        ensure_local_no_login_safety()

    monkeypatch.setattr(settings, "APP_ENV", "staging")
    with pytest.raises(RuntimeError, match="LOCAL_NO_LOGIN_ENABLED"):
        ensure_local_no_login_safety()

    monkeypatch.setattr(settings, "APP_ENV", "development")
    ensure_local_no_login_safety()


@pytest.mark.asyncio
async def test_public_auth_config_reports_local_mode(monkeypatch):
    monkeypatch.setattr(settings, "LOCAL_NO_LOGIN_ENABLED", True)
    response = await oauth_providers()
    assert response["local_no_login_enabled"] is True


def test_full_access_bypass_is_explicitly_local(monkeypatch):
    monkeypatch.setattr(settings, "LOCAL_NO_LOGIN_ENABLED", False)
    monkeypatch.setattr(settings, "APP_ENV", "development")
    assert plan_allows_private_source("free") is False
    assert private_sources_quota("free") == 0

    monkeypatch.setattr(settings, "LOCAL_NO_LOGIN_ENABLED", True)
    assert plan_allows_private_source("free") is True
    assert private_sources_quota("free") == -1
