from __future__ import annotations

from typing import Any, Dict, List


def execute(payload: Dict[str, Any]) -> Dict[str, Any]:
    inputs = payload.get("inputs") or {}
    properties = payload.get("properties") or {}
    query = str(inputs.get("query") or "").lower().strip()
    vector_store = inputs.get("vectorStore") or {}
    records = list(vector_store.get("records") or []) if isinstance(vector_store, dict) else []
    k = max(1, int(properties.get("k") or 4))
    threshold = float(properties.get("scoreThreshold") or 0)
    scored: List[Dict[str, Any]] = []
    for record in records:
        content = str(record.get("content") or "")
        score = 1.0 if query and query in content.lower() else 0.0
        if score >= threshold:
            scored.append({"content": content, "metadata": {**(record.get("metadata") or {}), "score": score}})
    return {"documents": scored[:k]}
