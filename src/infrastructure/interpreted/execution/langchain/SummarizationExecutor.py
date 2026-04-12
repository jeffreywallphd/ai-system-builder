from __future__ import annotations

from typing import Any, Dict


def execute(payload: Dict[str, Any]) -> Dict[str, Any]:
    inputs = payload.get("inputs") or {}
    properties = payload.get("properties") or {}
    strategy = str(properties.get("strategy") or "stuff")
    model = inputs.get("model") or "summary-model"
    documents = inputs.get("documents") or []
    combined = "\n\n".join(
        str(item.get("content") or item.get("text") or "") if isinstance(item, dict) else str(item)
        for item in documents
    )
    return {"summary": f"[{model}] {strategy} summary: {combined[:300]}"}
