from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple
from uuid import uuid4

from app.models.requests import DatasetGenerationRequest
from app.models.responses import DatasetGenerationResponse


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _pick_topic(text: str, fallback: str) -> str:
    words = [word.strip(".,:;!?()[]{}\"'") for word in text.split() if len(word.strip(".,:;!?()[]{}\"'")) > 4]
    return words[0] if words else fallback


def _qa_examples(request: DatasetGenerationRequest, batch_id: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    examples: List[Dict[str, Any]] = []
    diagnostics: List[Dict[str, Any]] = []
    max_segments = request.configuration.max_segments_per_source if request.configuration else 4

    for document in request.source_documents:
        segments = document.segments or [
            {
                "id": f"{document.id}-0",
                "index": 0,
                "kind": "paragraph",
                "text": document.content,
            }
        ]
        for segment in segments[: max_segments or 4]:
            segment_text = segment.text if hasattr(segment, "text") else segment["text"]
            segment_index = segment.index if hasattr(segment, "index") else segment.get("index", 0)
            if len(segment_text.strip()) < 40:
                diagnostics.append({
                    "code": "segment_too_short",
                    "level": "warning",
                    "message": f"Skipped short source segment from {document.name}.",
                })
                continue
            topic = _pick_topic(segment_text, document.name)
            examples.append({
                "taskType": "question_answering",
                "question": f"What guidance should a model preserve about {topic}?",
                "answer": segment_text[:320].rstrip(),
                "context": segment_text,
                "sourceDocumentId": document.id,
                "sourceMetadata": {"sourceName": document.name, "chunkIndex": segment_index},
                "lineageMetadata": {"batchId": batch_id},
            })

    return examples, diagnostics


def _chat_examples(request: DatasetGenerationRequest, batch_id: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    examples: List[Dict[str, Any]] = []
    diagnostics: List[Dict[str, Any]] = []
    max_segments = request.configuration.max_segments_per_source if request.configuration else 4

    for document in request.source_documents:
        segments = document.segments or [
            {
                "id": f"{document.id}-0",
                "index": 0,
                "kind": "paragraph",
                "text": document.content,
            }
        ]
        for segment in segments[: max_segments or 4]:
            segment_text = segment.text if hasattr(segment, "text") else segment["text"]
            segment_index = segment.index if hasattr(segment, "index") else segment.get("index", 0)
            if len(segment_text.strip()) < 40:
                diagnostics.append({
                    "code": "segment_too_short",
                    "level": "warning",
                    "message": f"Skipped short source segment from {document.name}.",
                })
                continue
            topic = _pick_topic(segment_text, document.name)
            examples.append({
                "taskType": "chat_completion",
                "messages": [
                    {"role": "system", "content": f"Ground your answer in {document.name}."},
                    {"role": "user", "content": f"Summarize the most important guidance about {topic}."},
                    {"role": "assistant", "content": segment_text[:320].rstrip()},
                ],
                "lineageMetadata": {"batchId": batch_id, "sourceName": document.name},
            })

    return examples, diagnostics


class DatasetGenerationService:
    def generate(self, request: DatasetGenerationRequest) -> DatasetGenerationResponse:
        batch_id = f"generation_batch_{uuid4().hex[:12]}"
        if request.task_type == "question_answering":
            examples, diagnostics = _qa_examples(request, batch_id)
            generator_id = "python-runtime-qa-generator"
        elif request.task_type == "chat_completion":
            examples, diagnostics = _chat_examples(request, batch_id)
            generator_id = "python-runtime-chat-generator"
        else:
            raise ValueError(f"Task type '{request.task_type}' is not supported by the Python runtime dataset generator.")

        executed_at = _now_iso()
        return DatasetGenerationResponse(
            batch_id=batch_id,
            generated_at=executed_at,
            generated_count=len(examples),
            skipped_count=0,
            examples=examples,
            provenance={
                "provider": "python-runtime",
                "generator_id": generator_id,
                "generator_version": "1.0.0",
                "batch_id": batch_id,
                "mode": "provider-backed",
                "detail": "Examples were generated by the Python runtime provider-backed generation backend.",
                "parameters": request.configuration.model_dump() if request.configuration else {},
                "executed_at": executed_at,
                "diagnostics": diagnostics,
            },
        )
