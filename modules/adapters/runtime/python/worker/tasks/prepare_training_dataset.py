from __future__ import annotations

import csv
import json
import os
import random
import tempfile
from pathlib import Path

from models import (
    DatasetPreparationSummary,
    DatasetPreparationWarning,
    PrepareTrainingDatasetRequest,
    PrepareTrainingDatasetResult,
    PythonRuntimeOutputDescriptor,
)
from tasks.document_normalization import normalize_sources_to_markdown
from tasks.markdown_chunking import chunk_markdown_documents


def _emit_rows(
    rows: list[dict[str, object]],
    output_format: str,
    role: str,
    base_name: str,
    metadata: dict[str, object],
) -> PythonRuntimeOutputDescriptor:
    suffix = {"jsonl": ".jsonl", "json": ".json", "csv": ".csv"}[output_format]
    fd, temp_path = tempfile.mkstemp(prefix=f"{base_name}-{role}-", suffix=suffix)
    path = Path(temp_path)

    try:
        if output_format == "jsonl":
            path.write_text(
                "\n".join(json.dumps(row, ensure_ascii=False) for row in rows),
                encoding="utf-8",
            )
        elif output_format == "json":
            path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        else:
            with path.open("w", encoding="utf-8", newline="") as handle:
                fieldnames = ["artifactId", "chunkIndex", "text"]
                writer = csv.DictWriter(handle, fieldnames=fieldnames)
                writer.writeheader()
                for row in rows:
                    writer.writerow(row)
    finally:
        os.close(fd)

    media_type = {
        "jsonl": "application/x-ndjson",
        "json": "application/json",
        "csv": "text/csv",
    }[output_format]

    return PythonRuntimeOutputDescriptor(
        name=f"{base_name}-{role}",
        role=role,
        tempPath=temp_path,
        mediaType=media_type,
        sizeBytes=path.stat().st_size,
        metadata=metadata,
    )


def _build_chunk_rows(payload: PrepareTrainingDatasetRequest) -> tuple[list[dict[str, object]], list[DatasetPreparationWarning], int, int]:
    normalization = normalize_sources_to_markdown(payload.sourceInputs, payload.recipe.normalization)
    chunks = chunk_markdown_documents(normalization.documents, payload.recipe.chunking)

    rows = [
        {
            "artifactId": chunk.artifact_id,
            "chunkIndex": chunk.chunk_index,
            "text": chunk.text,
        }
        for chunk in chunks
    ]

    return rows, normalization.warnings, len(normalization.documents), normalization.skipped_document_count


def prepare_training_dataset(payload: PrepareTrainingDatasetRequest) -> PrepareTrainingDatasetResult:
    rows, warnings, normalized_count, skipped_count = _build_chunk_rows(payload)

    if payload.split.shuffle:
        seed = int(payload.split.seed or 0)
        random.Random(seed).shuffle(rows)

    train_ratio = float(payload.split.trainRatio)
    if not 0 < train_ratio < 1:
        raise ValueError("split.trainRatio must be between 0 and 1")

    split_index = int(len(rows) * train_ratio)
    train_rows = rows[:split_index]
    test_rows = rows[split_index:]

    base_name = payload.output.naming.baseName if payload.output.naming and payload.output.naming.baseName else "training-dataset"
    interim_metadata = {
        "stage": "chunk-level-interim",
        "generationStatus": "not-started",
        "format": "markdown-chunk",
    }

    train_output = _emit_rows(
        train_rows,
        payload.output.format,
        "train",
        base_name,
        {**interim_metadata, "partition": "train"},
    )
    test_output = _emit_rows(
        test_rows,
        payload.output.format,
        "test",
        base_name,
        {**interim_metadata, "partition": "test"},
    )

    summary = DatasetPreparationSummary(
        sourceDocumentCount=len(payload.sourceInputs),
        normalizedDocumentCount=normalized_count,
        skippedDocumentCount=skipped_count,
        chunkCount=len(rows),
        generatedExampleCount=0,
        trainRowCount=len(train_rows),
        testRowCount=len(test_rows),
    )

    all_warnings = [
        DatasetPreparationWarning(
            code="generation_not_implemented",
            message=(
                "Local-model example generation is not implemented yet; "
                "outputs currently contain chunk-level interim rows."
            ),
        ),
        *warnings,
    ]

    return PrepareTrainingDatasetResult(
        outputs=[train_output, test_output],
        summary=summary,
        warnings=all_warnings,
    )
