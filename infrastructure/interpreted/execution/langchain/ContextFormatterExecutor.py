from __future__ import annotations

from typing import Any, Dict


def execute(payload: Dict[str, Any]) -> Dict[str, Any]:
    inputs = payload.get("inputs") or {}
    properties = payload.get("properties") or {}
    template = str(properties.get("template") or "[{index}] {content}")
    max_length = max(1, int(properties.get("maxLength") or 2000))
    rendered = []
    for index, item in enumerate(inputs.get("documents") or [], start=1):
        content = str(item.get("content") or item.get("text") or "") if isinstance(item, dict) else str(item)
        metadata = item.get("metadata") if isinstance(item, dict) and isinstance(item.get("metadata"), dict) else {}
        rendered.append(template.replace("{index}", str(index)).replace("{content}", content).replace("{metadata}", str(metadata)))
    return {"context": "\n\n".join(rendered)[:max_length]}
