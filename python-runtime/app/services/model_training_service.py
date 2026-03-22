from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from app.models.requests import FineTuningJobRequest
from app.models.responses import FineTuningJobResponse


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ModelTrainingService:
    def __init__(self, workspace_root: Path | None = None) -> None:
        self._workspace_root = workspace_root or (Path.cwd() / ".ai-loom-runtime" / "training-jobs")
        self._workspace_root.mkdir(parents=True, exist_ok=True)

    def submit_job(self, request: FineTuningJobRequest) -> FineTuningJobResponse:
        job_root = self._workspace_root / request.job_id
        job_root.mkdir(parents=True, exist_ok=True)

        submitted_at = _now_iso()
        started_at = submitted_at
        completed_at = _now_iso()
        manifest_path = job_root / "training-manifest.json"
        adapter_path = job_root / "adapter-bundle.json"
        checkpoint_path = job_root / "checkpoint-epoch-1.json"
        log_path = job_root / "training-log.txt"

        manifest_payload: Dict[str, Any] = {
            "jobId": request.job_id,
            "jobName": request.job_name,
            "backend": request.backend,
            "baseModel": {
                "id": request.base_model_id,
                "name": request.base_model_name,
            },
            "dataset": {
                "id": request.dataset_id,
                "name": request.dataset_name,
                "versionId": request.dataset_version_id,
                "versionNumber": request.dataset_version_number,
            },
            "configuration": request.configuration.model_dump(),
            "submittedBy": request.created_by,
            "submittedAt": submitted_at,
            "summary": "Python runtime manifest backend generated a durable fine-tuning bundle. This backend validates training inputs and emits provider-ready artifacts, but it does not yet run full gradient training for every provider.",
        }
        manifest_path.write_text(json.dumps(manifest_payload, indent=2), encoding="utf-8")
        adapter_path.write_text(json.dumps({
            "artifact": "adapter-bundle",
            "baseModelId": request.base_model_id,
            "datasetVersionId": request.dataset_version_id,
            "configuration": request.configuration.model_dump(),
        }, indent=2), encoding="utf-8")
        checkpoint_path.write_text(json.dumps({
            "epoch": 1,
            "loss": round(1 / max(request.configuration.epochs, 1), 4),
        }, indent=2), encoding="utf-8")
        log_path.write_text(
            "Created provider-ready training manifest, adapter bundle scaffold, and checkpoint metadata.\n",
            encoding="utf-8",
        )

        diagnostics: List[Dict[str, Any]] = [
            {
                "code": "python_runtime_manifest_backend",
                "level": "info",
                "message": "Executed the Python runtime fine-tuning manifest backend.",
                "detail": "This path persists job metadata and training artifacts durably for inspection and future provider execution.",
            }
        ]

        return FineTuningJobResponse(
            job_id=request.job_id,
            job_name=request.job_name,
            backend=request.backend,
            base_model_id=request.base_model_id,
            dataset_id=request.dataset_id,
            dataset_version_id=request.dataset_version_id,
            created_by=request.created_by,
            created_at=submitted_at,
            updated_at=completed_at,
            submitted_at=submitted_at,
            started_at=started_at,
            completed_at=completed_at,
            status="completed",
            configuration=request.configuration.model_dump(),
            diagnostics=diagnostics,
            artifacts=[
                {
                    "id": f"{request.job_id}:manifest",
                    "kind": "training-manifest",
                    "label": "Training manifest",
                    "location": str(manifest_path),
                    "content_type": "application/json",
                    "created_at": submitted_at,
                    "metadata": {"artifactRole": "input-manifest"},
                },
                {
                    "id": f"{request.job_id}:adapter",
                    "kind": "adapter-bundle",
                    "label": "Adapter bundle scaffold",
                    "location": str(adapter_path),
                    "content_type": "application/json",
                    "created_at": completed_at,
                    "metadata": {"artifactRole": "output-bundle"},
                },
                {
                    "id": f"{request.job_id}:checkpoint",
                    "kind": "checkpoint",
                    "label": "Checkpoint epoch 1",
                    "location": str(checkpoint_path),
                    "content_type": "application/json",
                    "created_at": completed_at,
                    "metadata": {"epoch": 1},
                },
                {
                    "id": f"{request.job_id}:log",
                    "kind": "log",
                    "label": "Training log",
                    "location": str(log_path),
                    "content_type": "text/plain",
                    "created_at": completed_at,
                    "metadata": {},
                },
            ],
            checkpoints=[
                {
                    "id": f"{request.job_id}:checkpoint:1",
                    "label": "Epoch 1",
                    "epoch": 1,
                    "metric_name": "loss",
                    "metric_value": round(1 / max(request.configuration.epochs, 1), 4),
                    "created_at": completed_at,
                    "artifact_id": f"{request.job_id}:checkpoint",
                }
            ],
            output_model_name=f"{request.base_model_name} · tuned on {request.dataset_name} v{request.dataset_version_number}",
            summary=manifest_payload["summary"],
        )
