from __future__ import annotations

import pytest

from test_database_guard import UnsafeTestDatabaseError, validated_test_database_url


_TEST_URL = "postgresql+asyncpg://topiceye:topiceye@127.0.0.1:5433/topiceye_test"


def _allow_expected_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EXPECTED_TEST_DATABASE_HOST", "127.0.0.1")
    monkeypatch.setenv("EXPECTED_TEST_DATABASE_PORT", "5433")


def test_destructive_setup_requires_explicit_opt_in(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", _TEST_URL)
    monkeypatch.delenv("ALLOW_TEST_DATABASE_TRUNCATE", raising=False)

    with pytest.raises(UnsafeTestDatabaseError, match="ALLOW_TEST_DATABASE_TRUNCATE=true"):
        validated_test_database_url()


def test_destructive_setup_rejects_runtime_database(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://topiceye:topiceye@postgres:5432/topiceye",
    )
    monkeypatch.setenv("ALLOW_TEST_DATABASE_TRUNCATE", "true")

    with pytest.raises(UnsafeTestDatabaseError, match="topiceye_test"):
        validated_test_database_url()


def test_destructive_setup_rejects_unexpected_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", _TEST_URL)
    monkeypatch.setenv("ALLOW_TEST_DATABASE_TRUNCATE", "true")
    monkeypatch.setenv("EXPECTED_TEST_DATABASE_HOST", "127.0.0.1")
    monkeypatch.setenv("EXPECTED_TEST_DATABASE_PORT", "6543")

    with pytest.raises(UnsafeTestDatabaseError, match="disposable instance"):
        validated_test_database_url()


def test_destructive_setup_accepts_throwaway_database(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", _TEST_URL)
    monkeypatch.setenv("ALLOW_TEST_DATABASE_TRUNCATE", "true")
    _allow_expected_endpoint(monkeypatch)

    assert validated_test_database_url() == _TEST_URL
