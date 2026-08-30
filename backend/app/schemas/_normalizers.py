"""Reusable Pydantic boundary normalizers for legacy JSON-shaped fields."""

from __future__ import annotations

import json
from typing import Annotated, Any

from pydantic import BeforeValidator, JsonValue


def normalize_str_list(value: Any) -> list[str]:
    """Normalize legacy list storage into a deterministic ``list[str]``.

    Accepted forms: ``None``, a list, a JSON-encoded list/string, a comma
    separated string, or a single plain string. Unsupported container/scalar
    types fail at the API boundary instead of leaking an invalid shape.
    """

    if value is None:
        return []

    candidate = value
    for _ in range(3):
        if not isinstance(candidate, str):
            break
        text = candidate.strip()
        if not text:
            return []
        try:
            decoded = json.loads(text)
        except json.JSONDecodeError:
            candidate = text
            break
        if decoded == candidate:
            break
        candidate = decoded

    if candidate is None:
        return []
    if isinstance(candidate, str):
        candidate = candidate.replace("，", ",").split(",") if "," in candidate or "，" in candidate else [candidate]

    if not isinstance(candidate, list):
        raise ValueError(f"cannot normalize to list[str]: {type(value).__name__}")

    normalized: list[str] = []
    seen: set[str] = set()
    for item in candidate:
        text = str(item).strip()
        if not text or text in seen:
            continue
        seen.add(text)
        normalized.append(text)
    return normalized


def normalize_json_dict(value: Any) -> dict[str, Any]:
    """Normalize ``dict`` / JSON object string / ``None`` into a dict."""

    if value is None or value == "":
        return {}
    candidate = value
    for _ in range(3):
        if not isinstance(candidate, str):
            break
        try:
            decoded = json.loads(candidate)
        except json.JSONDecodeError as exc:
            raise ValueError("cannot normalize invalid JSON to dict") from exc
        if decoded == candidate:
            break
        candidate = decoded
    if candidate is None:
        return {}
    if not isinstance(candidate, dict):
        raise ValueError(f"cannot normalize to dict: {type(value).__name__}")
    return {str(key): item for key, item in candidate.items()}


def normalize_json_list(value: Any) -> list[JsonValue]:
    """Normalize a list or a repeatedly JSON-encoded list into JSON values."""

    if value is None or value == "":
        return []
    candidate = value
    for _ in range(3):
        if not isinstance(candidate, str):
            break
        try:
            decoded = json.loads(candidate)
        except json.JSONDecodeError as exc:
            raise ValueError("cannot normalize invalid JSON to list") from exc
        if decoded == candidate:
            break
        candidate = decoded
    if candidate is None:
        return []
    if not isinstance(candidate, list):
        raise ValueError(f"cannot normalize to list: {type(value).__name__}")
    return candidate


StrList = Annotated[list[str], BeforeValidator(normalize_str_list)]
JsonDict = Annotated[dict[str, Any], BeforeValidator(normalize_json_dict)]
JsonList = Annotated[list[JsonValue], BeforeValidator(normalize_json_list)]
