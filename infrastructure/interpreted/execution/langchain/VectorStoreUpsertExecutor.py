from __future__ import annotations

from typing import Any, Dict, List


def _normalize_document(item: Any) -> Dict[str, Any]:
    if isinstance(item, str):
        return {"content": item, "metadata": {}}
    if isinstance(item, dict):
        content = str(item.get("content") or item.get("text") or item.get("page_content") or "")
        metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
        return {"content": content, "metadata": metadata}
    return {"content": str(item), "metadata": {}}


def execute(payload: Dict[str, Any]) -> Dict[str, Any]:
    inputs = payload.get("inputs") or {}
    properties = payload.get("properties") or {}
    documents = [_normalize_document(item) for item in (inputs.get("documents") or [])]
    embeddings = list(inputs.get("embeddings") or [])
    store_type = str(properties.get("storeType") or "memory")
    collection_name = str(properties.get("collectionName") or "default")
    vector_store = {
        "storeType": store_type,
        "collectionName": collection_name,
        "records": [
            {
                "id": f"{collection_name}-{index + 1}",
                "content": document["content"],
                "metadata": document["metadata"],
                "embedding": embeddings[index] if index < len(embeddings) else None,
            }
            for index, document in enumerate(documents)
        ],
    }
    return {"vectorStore": vector_store}
