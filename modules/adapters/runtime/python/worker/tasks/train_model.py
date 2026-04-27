from __future__ import annotations

import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from ..models import TrainModelTaskRequest, TrainModelTaskResult

SUPPORTED_METHODS = {"lora"}


def _require_non_empty(value: str | None, field: str) -> str:
    if value is None or value.strip() == "":
        raise ValueError(f"{field} is required.")
    return value.strip()


def train_model(payload: TrainModelTaskRequest) -> TrainModelTaskResult:
    _require_non_empty(payload.output.get("outputModelName"), "output.outputModelName")

    if payload.baseModel.modelRecordId is None and payload.baseModel.modelId is None and payload.baseModel.localPath is None:
        raise ValueError("baseModel must include modelRecordId, modelId, or localPath.")

    if len(payload.datasets) == 0:
        raise ValueError("datasets must include at least one dataset input.")

    for dataset in payload.datasets:
        _require_non_empty(dataset.artifactId, "datasets[].artifactId")

    if payload.method not in SUPPORTED_METHODS:
        raise ValueError(
            f"Training method '{payload.method}' is not supported by the current Python worker skeleton. Supported methods: lora"
        )

    run_id = f"train-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    output_model_name = payload.output.get("outputModelName")
    output_directory = payload.output.get("outputDirectory")

    if output_directory is None:
        output_directory = tempfile.mkdtemp(prefix=f"{output_model_name}-")

    output_path = Path(output_directory)
    output_path.mkdir(parents=True, exist_ok=True)

    run_metadata_path = output_path / "training-run.json"
    run_metadata_path.write_text(
        json.dumps(
            {
                "runId": run_id,
                "method": payload.method,
                "baseModel": payload.baseModel.model_dump(mode="json"),
                "datasets": [dataset.model_dump(mode="json") for dataset in payload.datasets],
                "startedAt": datetime.now(timezone.utc).isoformat(),
                "status": "succeeded",
                "skeleton": True,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    generated_model_path = str(output_path / output_model_name)
    return TrainModelTaskResult(
        runId=run_id,
        status="succeeded",
        outputDirectory=str(output_path),
        outputModelName=output_model_name,
        logs=["Executed train-model skeleton task (LoRA only)."],
        warnings=["Python worker executed skeleton training flow; no full fine-tuning implementation yet."],
        generatedModelCandidate={
            "displayName": output_model_name,
            "provider": payload.baseModel.provider or "unknown",
            "modelId": payload.baseModel.modelId,
            "localPath": generated_model_path,
            "artifactForm": "adapter",
            "inferenceMode": payload.baseModel.inferenceMode,
            "baseModelId": payload.baseModel.modelId,
            "adapterOfModelId": payload.baseModel.modelId,
            "generatedFromRunId": run_id,
            "metadata": {
                "runtimeTask": "train-model",
                "skeleton": True,
                "runMetadataPath": str(run_metadata_path),
            },
        },
    )
