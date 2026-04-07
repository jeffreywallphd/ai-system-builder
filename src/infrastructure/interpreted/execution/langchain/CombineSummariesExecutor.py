from __future__ import annotations

from typing import Any, Dict


def execute(payload: Dict[str, Any]) -> Dict[str, Any]:
    inputs = payload.get("inputs") or {}
    properties = payload.get("properties") or {}
    method = str(properties.get("method") or "concatenate")
    summaries = [str(item) for item in (inputs.get("summaries") or []) if str(item).strip()]
    combined = " ".join(summaries) if method == "reduce" else "\n\n".join(summaries)
    return {"combinedSummary": combined}
