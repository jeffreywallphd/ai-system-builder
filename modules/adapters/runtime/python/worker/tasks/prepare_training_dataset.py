from __future__ import annotations

import csv
import json
import os
import random
import tempfile
from pathlib import Path
from typing import Callable

from ..models import (
    DatasetPreparationSummary,
    DatasetPreparationWarning,
    PrepareTrainingDatasetRequest,
    PrepareTrainingDatasetResult,
    PythonRuntimeOutputDescriptor,
)
from .document_normalization import normalize_sources_to_markdown
from .example_generation import GeneratedQaExample, generate_qa_examples_for_chunks
from .markdown_chunking import chunk_markdown_documents

DEFAULT_MAX_CHUNK_COUNT = 10000


class DatasetPreparationStageError(ValueError):
    def __init__(self, stage: str, message: str, error_code: str) -> None:
        super().__init__(message)
        self.stage = stage
        self.error_code = error_code


def _validate_split_config(train_ratio: float, test_ratio: float) -> None:
    if train_ratio <= 0:
        raise ValueError("split.trainRatio must be greater than 0")
    if test_ratio <= 0:
        raise ValueError("split.testRatio must be greater than 0")
    if abs((train_ratio + test_ratio) - 1.0) > 1e-6:
        raise ValueError("split.trainRatio + split.testRatio must equal 1.0")

def _resolve_split_index(total_rows: int, train_ratio: float) -> int:
    if total_rows < 2:
        raise DatasetPreparationStageError(
            "split",
            (
                "Generated examples cannot be split into non-empty train/test outputs. "
                f"At least 2 rows are required, but only {total_rows} row(s) were generated."
            ),
            "split_insufficient_rows",
        )

    raw_split_index = int(total_rows * train_ratio)
    return max(1, min(total_rows - 1, raw_split_index))


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
                fieldnames = ["artifactId", "chunkIndex", "question", "answer", "generationMode"]
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


def _build_generated_rows(
    payload: PrepareTrainingDatasetRequest,
    generator: Callable[[list, object], list[GeneratedQaExample]],
) -> tuple[list[dict[str, object]], list[DatasetPreparationWarning], int, int, int]:
    try:
        normalization = normalize_sources_to_markdown(payload.sourceInputs, payload.recipe.normalization)
    except Exception as error:
        raise DatasetPreparationStageError("normalization", str(error), "normalization_failed") from error

    try:
        chunks = chunk_markdown_documents(normalization.documents, payload.recipe.chunking)
    except Exception as error:
        raise DatasetPreparationStageError("chunking", str(error), "chunking_failed") from error

    max_chunk_count = int(payload.recipe.chunking.maxChunkCount or DEFAULT_MAX_CHUNK_COUNT)
    if len(chunks) > max_chunk_count:
        raise DatasetPreparationStageError(
            "chunking",
            f"Chunk count {len(chunks)} exceeds configured maxChunkCount {max_chunk_count}.",
            "chunk_limit_exceeded",
        )

    failure_policy = payload.recipe.generation.failurePolicy
    if not failure_policy:
        normalization_mode = payload.recipe.normalization.normalizationMode or "strict"
        failure_policy = "skip" if normalization_mode == "best-effort" else "fail"

    batch_size = int(payload.recipe.generation.batchSize or 1)
    rows: list[dict[str, object]] = []
    warnings: list[DatasetPreparationWarning] = list(normalization.warnings)
    for start in range(0, len(chunks), batch_size):
        chunk_batch = chunks[start : start + batch_size]
        try:
            generated_examples = generator(chunk_batch, payload.recipe.generation)
            for example in generated_examples:
                rows.append(
                    {
                        "artifactId": example.artifact_id,
                        "chunkIndex": example.chunk_index,
                        "question": example.question,
                        "answer": example.answer,
                        "generationMode": example.generation_mode,
                    }
                )
        except Exception as error:
            if failure_policy == "skip":
                for chunk in chunk_batch:
                    warnings.append(
                        DatasetPreparationWarning(
                            code="generation_example_skipped",
                            message=(
                                f"Skipped chunk {chunk.chunk_index} from source '{chunk.artifact_id}' during generation: {error}"
                            ),
                            sourceArtifactId=chunk.artifact_id,
                        )
                    )
                continue
            raise DatasetPreparationStageError("generation", str(error), "generation_failed") from error

    return (
        rows,
        warnings,
        len(normalization.documents),
        normalization.skipped_document_count,
        len(chunks),
    )


def prepare_training_dataset(
    payload: PrepareTrainingDatasetRequest,
    example_generator: Callable[[list, object], list[GeneratedQaExample]] = generate_qa_examples_for_chunks,
) -> PrepareTrainingDatasetResult:
    try:
        _validate_split_config(float(payload.split.trainRatio), float(payload.split.testRatio))
    except Exception as error:
        raise DatasetPreparationStageError("split", str(error), "split_validation_failed") from error

    rows, warnings, normalized_count, skipped_count, chunk_count = _build_generated_rows(payload, example_generator)

    if payload.split.shuffle:
        seed = int(payload.split.seed or 0)
        random.Random(seed).shuffle(rows)

    train_ratio = float(payload.split.trainRatio)

    split_index = _resolve_split_index(len(rows), train_ratio)
    train_rows = rows[:split_index]
    test_rows = rows[split_index:]

    base_name = payload.output.naming.baseName if payload.output.naming and payload.output.naming.baseName else "training-dataset"
    output_metadata = {
        "stage": "generated-examples",
        "generationMode": payload.recipe.generation.mode,
        "generationModel": {
            "provider": payload.recipe.generation.model.provider,
            "modelId": payload.recipe.generation.model.modelId,
        },
        "sourceArtifactIds": [source.artifactId for source in payload.sourceInputs],
        "summary": {
            "chunkCount": chunk_count,
            "generatedExampleCount": len(rows),
        },
        "split": payload.split.model_dump(mode="json"),
        "outputConfig": payload.output.model_dump(mode="json"),
    }

    train_output = _emit_rows(
        train_rows,
        payload.output.format,
        "train",
        base_name,
        {**output_metadata, "partition": "train"},
    )
    test_output = _emit_rows(
        test_rows,
        payload.output.format,
        "test",
        base_name,
        {**output_metadata, "partition": "test"},
    )

    summary = DatasetPreparationSummary(
        sourceDocumentCount=len(payload.sourceInputs),
        normalizedDocumentCount=normalized_count,
        skippedDocumentCount=skipped_count,
        chunkCount=chunk_count,
        generatedExampleCount=len(rows),
        trainRowCount=len(train_rows),
        testRowCount=len(test_rows),
    )

    return PrepareTrainingDatasetResult(
        outputs=[train_output, test_output],
        summary=summary,
        warnings=warnings or None,
    )
