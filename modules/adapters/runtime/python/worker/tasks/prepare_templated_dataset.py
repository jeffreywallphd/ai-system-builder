from __future__ import annotations

import csv
import json
import os
import random
import re
import tempfile
from pathlib import Path
from typing import Any

from models import (
    PrepareTemplatedDatasetRequest,
    PrepareTemplatedDatasetResult,
    PythonRuntimeOutputDescriptor,
)

_TEMPLATE_TOKEN = re.compile(r"\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}")


def _read_input_rows(local_path: str, media_type: str) -> list[dict[str, Any]]:
    path = Path(local_path)
    if not path.exists():
        raise ValueError(f"Input path does not exist: {local_path}")

    normalized_media_type = media_type.lower()

    if normalized_media_type in {"application/json", "text/json"}:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, list):
            return [row if isinstance(row, dict) else {"value": row} for row in payload]
        if isinstance(payload, dict):
            return [payload]
        raise ValueError(f"JSON input must be object or array at {local_path}")

    if normalized_media_type in {"application/x-ndjson", "application/jsonl"}:
        rows: list[dict[str, Any]] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            row = json.loads(stripped)
            rows.append(row if isinstance(row, dict) else {"value": row})
        return rows

    if normalized_media_type in {"text/csv", "application/csv"}:
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            return [dict(row) for row in reader]

    raise ValueError(f"Unsupported media type: {media_type}")


def _template_row(template: str, row: dict[str, Any]) -> str:
    def replace_token(match: re.Match[str]) -> str:
        key = match.group(1)
        value = row.get(key, "")
        return str(value)

    return _TEMPLATE_TOKEN.sub(replace_token, template)


def _emit_rows(rows: list[dict[str, str]], output_format: str, role: str, base_name: str) -> PythonRuntimeOutputDescriptor:
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
                writer = csv.DictWriter(handle, fieldnames=["text"])
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
        metadata={"partition": role},
    )


def prepare_templated_dataset(payload: PrepareTemplatedDatasetRequest) -> PrepareTemplatedDatasetResult:
    all_rows: list[dict[str, Any]] = []
    for source in payload.sourceInputs:
        all_rows.extend(_read_input_rows(source.localPath, source.mediaType))

    templated_rows = [{"text": _template_row(payload.template, row)} for row in all_rows]

    if payload.shuffle:
        seed = int(payload.split.get("seed", 0))
        random.Random(seed).shuffle(templated_rows)

    train_ratio = float(payload.split.get("trainRatio", 0.8))
    if not 0 < train_ratio < 1:
        raise ValueError("split.trainRatio must be between 0 and 1")

    split_index = int(len(templated_rows) * train_ratio)
    train_rows = templated_rows[:split_index]
    test_rows = templated_rows[split_index:]

    output_naming = payload.outputNaming or {}
    base_name = output_naming.get("baseName", "templated-dataset")

    train_output = _emit_rows(train_rows, payload.outputFormat, "train", base_name)
    test_output = _emit_rows(test_rows, payload.outputFormat, "test", base_name)

    return PrepareTemplatedDatasetResult(
        outputs=[train_output, test_output],
        trainRowCount=len(train_rows),
        testRowCount=len(test_rows),
        warnings=[],
    )
