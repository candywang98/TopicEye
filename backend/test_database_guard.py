from __future__ import annotations

import os

from sqlalchemy.engine import make_url

TEST_DATABASE_NAME = "topiceye_test"
TEST_TRUNCATE_OPT_IN = "ALLOW_TEST_DATABASE_TRUNCATE"
TEST_DATABASE_HOST = "EXPECTED_TEST_DATABASE_HOST"
TEST_DATABASE_PORT = "EXPECTED_TEST_DATABASE_PORT"


class UnsafeTestDatabaseError(RuntimeError):
    pass


def validated_test_database_url() -> str:
    """Return DATABASE_URL only after proving it targets the disposable test DB."""
    raw_url = os.environ.get("DATABASE_URL")
    if not raw_url:
        raise UnsafeTestDatabaseError("DATABASE_URL is required for PostgreSQL integration tests")

    url = make_url(raw_url)
    if os.environ.get(TEST_TRUNCATE_OPT_IN) != "true":
        raise UnsafeTestDatabaseError(
            f"Refusing destructive test setup without {TEST_TRUNCATE_OPT_IN}=true"
        )
    if url.get_backend_name() != "postgresql" or url.database != TEST_DATABASE_NAME:
        raise UnsafeTestDatabaseError(
            "Refusing destructive test setup unless DATABASE_URL targets "
            f"PostgreSQL database {TEST_DATABASE_NAME!r}; got {url.database!r}"
        )

    expected_host = os.environ.get(TEST_DATABASE_HOST)
    expected_port = os.environ.get(TEST_DATABASE_PORT)
    if not expected_host or not expected_port:
        raise UnsafeTestDatabaseError(
            f"Refusing destructive test setup without {TEST_DATABASE_HOST} and {TEST_DATABASE_PORT}"
        )
    if url.host != expected_host or url.port != int(expected_port):
        raise UnsafeTestDatabaseError(
            "Refusing destructive test setup because DATABASE_URL endpoint does not "
            f"match the disposable instance {expected_host}:{expected_port}"
        )
    return raw_url
