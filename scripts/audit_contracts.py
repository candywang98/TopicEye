#!/usr/bin/env python3
"""Audit frontend API consumption against FastAPI response contracts.

The script is intentionally dependency-free so CI can run it before installing
the application. It performs static analysis only; dynamic route construction
is reported with ``{param}`` placeholders and should be reviewed manually.
"""

from __future__ import annotations

import argparse
import ast
import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_API = ROOT / "backend" / "app" / "api" / "v1"
SCHEMAS = ROOT / "backend" / "app" / "schemas"
FRONTEND_API = ROOT / "frontend" / "src" / "lib" / "api"
FRONTEND_HOOKS = ROOT / "frontend" / "src" / "hooks"
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}


@dataclass(frozen=True, order=True)
class Endpoint:
    method: str
    path: str
    response_model: str | None = None
    status_code: int | None = None
    source: str = ""


def _literal_string(node: ast.AST | None, default: str = "") -> str:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return default


def _expr_name(node: ast.AST) -> str:
    try:
        return ast.unparse(node)
    except Exception:
        return "<dynamic>"


def _join_path(*parts: str) -> str:
    joined = "/".join(part.strip("/") for part in parts if part and part != "/")
    return "/" + joined if joined else "/"


def _router_prefix(tree: ast.Module) -> str:
    for node in tree.body:
        if not isinstance(node, ast.Assign | ast.AnnAssign):
            continue
        value = node.value
        if not isinstance(value, ast.Call) or _expr_name(value.func) != "APIRouter":
            continue
        for keyword in value.keywords:
            if keyword.arg == "prefix":
                return _literal_string(keyword.value)
    return ""


def scan_backend() -> list[Endpoint]:
    endpoints: list[Endpoint] = []
    for path in sorted(BACKEND_API.glob("*.py")):
        if path.name.startswith("_") or path.name == "router.py":
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        prefix = _router_prefix(tree)
        for node in ast.walk(tree):
            if not isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
                continue
            for decorator in node.decorator_list:
                if not isinstance(decorator, ast.Call) or not isinstance(decorator.func, ast.Attribute):
                    continue
                method = decorator.func.attr.lower()
                if method not in HTTP_METHODS or _expr_name(decorator.func.value) != "router":
                    continue
                route_path = _literal_string(decorator.args[0] if decorator.args else None)
                response_model = None
                status_code = None
                for keyword in decorator.keywords:
                    if keyword.arg == "response_model":
                        response_model = _expr_name(keyword.value)
                    elif keyword.arg == "status_code" and isinstance(keyword.value, ast.Constant):
                        status_code = keyword.value.value if isinstance(keyword.value.value, int) else None
                endpoints.append(
                    Endpoint(
                        method=method.upper(),
                        path=_join_path(prefix, route_path),
                        response_model=response_model,
                        status_code=status_code,
                        source=str(path.relative_to(ROOT)),
                    )
                )
    return sorted(set(endpoints))


def scan_models_with_any() -> set[str]:
    annotations: dict[str, str] = {}
    for path in sorted(SCHEMAS.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in tree.body:
            if not isinstance(node, ast.ClassDef):
                continue
            parts: list[str] = []
            for child in ast.walk(node):
                if isinstance(child, ast.AnnAssign):
                    parts.append(_expr_name(child.annotation))
            annotations[node.name] = " ".join(parts)

    any_models = {name for name, annotation in annotations.items() if re.search(r"\bAny\b", annotation)}
    changed = True
    while changed:
        changed = False
        for name, annotation in annotations.items():
            if name in any_models:
                continue
            if any(re.search(rf"\b{re.escape(dependency)}\b", annotation) for dependency in any_models):
                any_models.add(name)
                changed = True
    return any_models


_CALL_RE = re.compile(
    r"(?P<func>request(?:<[^\n;(]*>)?|fetch)\s*\(\s*(?P<quote>`|'|\")(?P<url>.*?)(?P=quote)",
    re.DOTALL,
)


def _normalise_frontend_path(raw: str) -> str | None:
    if raw.startswith("${BASE_URL}"):
        raw = raw[len("${BASE_URL}") :]
    if raw.startswith(("http://", "https://")):
        return None
    # Common client pattern: `/contents${query}` where query already starts
    # with "?". It changes query parameters, not the route path.
    raw = re.sub(
        r"\$\{(?:query|qs|params|searchParams|refresh|reportDate)\b.*$",
        "",
        raw,
        flags=re.DOTALL,
    )
    raw = re.sub(r"\$\{[^}]+\}", "{param}", raw)
    raw = raw.split("?", 1)[0]
    if not raw.startswith("/"):
        return None
    return _join_path(raw)


def scan_frontend() -> list[Endpoint]:
    endpoints: list[Endpoint] = []
    paths = sorted(FRONTEND_API.glob("*.ts")) + sorted(FRONTEND_HOOKS.rglob("*.ts"))
    for path in paths:
        text = path.read_text(encoding="utf-8")
        for match in _CALL_RE.finditer(text):
            route_path = _normalise_frontend_path(match.group("url"))
            if route_path is None:
                continue
            statement_end_candidates = [
                position
                for position in (
                    text.find(");", match.end()),
                    text.find(";\n", match.end()),
                )
                if position >= 0
            ]
            statement_end = min(statement_end_candidates) if statement_end_candidates else match.end() + 160
            nearby = text[match.end() : min(statement_end + 2, match.end() + 320)]
            method_match = re.search(r"method\s*:\s*['\"](GET|POST|PUT|PATCH|DELETE)['\"]", nearby)
            method = method_match.group(1) if method_match else "GET"
            endpoints.append(
                Endpoint(
                    method=method,
                    path=route_path,
                    source=str(path.relative_to(ROOT)),
                )
            )
    return sorted(set(endpoints))


def _match_key(endpoint: Endpoint) -> tuple[str, str]:
    path = re.sub(r"\{[^}/]+\}", "{}", endpoint.path)
    return endpoint.method, path.rstrip("/") or "/"


def _priority(path: str) -> str:
    critical = ("/contents", "/favorites", "/mother-topics", "/daily-reports")
    high = ("/auth", "/sources", "/trending", "/trends", "/stats")
    if path == "/contents" or any(path.startswith(prefix) for prefix in critical):
        return "P0"
    if any(path.startswith(prefix) for prefix in high):
        return "P1"
    return "P2"


def _table(headers: list[str], rows: list[list[str]]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    lines.extend("| " + " | ".join(cell.replace("|", "\\|") for cell in row) + " |" for row in rows)
    return "\n".join(lines)


def build_report() -> str:
    backend = scan_backend()
    frontend = scan_frontend()
    any_models = scan_models_with_any()
    backend_by_key = {_match_key(endpoint): endpoint for endpoint in backend}
    frontend_by_key = {_match_key(endpoint): endpoint for endpoint in frontend}

    consumed_missing: list[list[str]] = []
    unmatched_frontend: list[list[str]] = []
    for endpoint in frontend:
        backend_endpoint = backend_by_key.get(_match_key(endpoint))
        if backend_endpoint is None:
            unmatched_frontend.append([endpoint.method, endpoint.path, endpoint.source])
        elif backend_endpoint.response_model is None and backend_endpoint.status_code != 204:
            consumed_missing.append(
                [_priority(endpoint.path), endpoint.method, endpoint.path, backend_endpoint.source, endpoint.source]
            )

    any_contracts: list[list[str]] = []
    for endpoint in backend:
        model = endpoint.response_model or ""
        matched = sorted(name for name in any_models if re.search(rf"\b{re.escape(name)}\b", model))
        if matched:
            any_contracts.append([endpoint.method, endpoint.path, model, ", ".join(matched), endpoint.source])

    backend_only = [
        [endpoint.method, endpoint.path, endpoint.response_model or "—", endpoint.source]
        for endpoint in backend
        if _match_key(endpoint) not in frontend_by_key
    ]

    consumed_missing.sort(key=lambda row: (row[0], row[2], row[1]))
    generated = "2026-08-29"
    return f"""# TopicEye API 契约审计

> 生成日期：{generated}
> 生成命令：`python scripts/audit_contracts.py --output docs/api-contract-audit.md`

## 摘要

- 后端静态识别路由：{len(backend)} 个；
- 前端静态识别请求：{len(frontend)} 个；
- 前端消费但缺少 `response_model`：{len(consumed_missing)} 个；
- 响应模型直接或间接包含 `Any`：{len(any_contracts)} 个；
- 后端存在但前端未静态识别消费：{len(backend_only)} 个；
- 前端请求未匹配后端静态路由：{len(unmatched_frontend)} 个。

说明：本报告是静态分析结果。动态拼接、同一路径多路由注册和直接使用原生 `fetch` 的复杂表达式可能需要人工复核；“后端未被前端消费”不代表接口无用，Agent API、CLI 或外部集成仍可能调用。

## 1. 前端消费但无 response_model

优先级规则：内容、精选、收藏、母题、日报为 P0；认证、信源、趋势和统计为 P1；其余为 P2。

{_table(["优先级", "方法", "路径", "后端位置", "前端位置"], consumed_missing)}

## 2. response_model 中含 Any

{_table(["方法", "路径", "response_model", "涉及模型", "后端位置"], any_contracts)}

## 3. 后端存在但前端未静态识别消费

{_table(["方法", "路径", "response_model", "后端位置"], backend_only)}

## 4. 前端请求未匹配到后端路由

这些项目优先检查静态分析误差，其次检查失效或拼写错误的客户端调用。

{_table(["方法", "路径", "前端位置"], unmatched_frontend)}
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, help="Write Markdown report to this path")
    args = parser.parse_args()
    report = build_report()
    if args.output:
        output = args.output if args.output.is_absolute() else ROOT / args.output
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(report, encoding="utf-8")
    else:
        print(report)


if __name__ == "__main__":
    main()
