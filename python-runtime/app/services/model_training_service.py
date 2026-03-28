from __future__ import annotations

import json
import math
import re
import threading
import time
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from app.models.requests import FineTuningJobRequest
from app.models.responses import FineTuningJobResponse


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_numpy():
    try:
        import numpy as np  # type: ignore[import-not-found]
    except Exception as error:
        raise ValueError(
            "Local gradient training is unavailable because NumPy could not be initialized on this host. "
            f"Underlying error: {error}"
        ) from error
    return np


class ModelTrainingService:
    def __init__(self, workspace_root: Path | None = None) -> None:
        self._workspace_root = workspace_root or (Path.cwd() / ".ai-loom-runtime" / "training-jobs")
        self._workspace_root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._cancel_requests: set[str] = set()
        self._active_job_ids: set[str] = set()
        self._load_jobs()

    def submit_job(self, request: FineTuningJobRequest) -> FineTuningJobResponse:
        if not request.examples:
            raise ValueError("Training requires at least one dataset example.")
        if request.dataset_task_type not in {"question_answering", "chat_completion"}:
            raise ValueError(
                "The local Python runtime trainer currently supports only question_answering and chat_completion datasets."
            )
        if request.execution_kind == "preparation-only":
            return self._prepare_job(request)
        if request.backend != "python-runtime-local":
            raise ValueError("Real training requires the python-runtime-local backend.")
        return self._start_local_training_job(request)

    def list_jobs(self) -> List[FineTuningJobResponse]:
        with self._lock:
            self._reconcile_orphaned_jobs()
            ordered = sorted(self._jobs.values(), key=lambda job: job.get("submitted_at") or job["created_at"], reverse=True)
            return [FineTuningJobResponse.model_validate(deepcopy(job)) for job in ordered]

    def get_job(self, job_id: str) -> FineTuningJobResponse:
        normalized_job_id = job_id.strip()
        with self._lock:
            self._reconcile_orphaned_jobs(job_ids=[normalized_job_id])
            payload = self._jobs.get(normalized_job_id)
            if not payload:
                raise KeyError(normalized_job_id)
            return FineTuningJobResponse.model_validate(deepcopy(payload))

    def refresh_job(self, job_id: str) -> FineTuningJobResponse:
        normalized_job_id = job_id.strip()
        with self._lock:
            payload = self._jobs.get(normalized_job_id)
            if not payload:
                raise KeyError(normalized_job_id)
            self._reconcile_orphaned_jobs(job_ids=[normalized_job_id], force=False)
            return FineTuningJobResponse.model_validate(deepcopy(self._jobs[normalized_job_id]))

    def reconcile_job(self, job_id: str) -> FineTuningJobResponse:
        normalized_job_id = job_id.strip()
        with self._lock:
            payload = self._jobs.get(normalized_job_id)
            if not payload:
                raise KeyError(normalized_job_id)
            self._reconcile_orphaned_jobs(job_ids=[normalized_job_id], force=True)
            return FineTuningJobResponse.model_validate(deepcopy(self._jobs[normalized_job_id]))

    def cancel_job(self, job_id: str) -> FineTuningJobResponse:
        normalized_job_id = job_id.strip()
        with self._lock:
            payload = self._jobs.get(normalized_job_id)
            if not payload:
                raise KeyError(normalized_job_id)
            if payload["status"] in {"completed", "failed", "cancelled", "exported-without-training", "partially-completed"}:
                return FineTuningJobResponse.model_validate(deepcopy(payload))
            self._cancel_requests.add(normalized_job_id)
            self._append_diagnostic(
                payload,
                code="job_cancellation_requested",
                level="warning",
                message="Cancellation was requested for the local training job.",
                detail="The Python runtime will stop after the current step and persist the latest checkpoint state.",
            )
            payload["updated_at"] = _now_iso()
            self._persist_job(payload)
            return FineTuningJobResponse.model_validate(deepcopy(payload))

    def _prepare_job(self, request: FineTuningJobRequest) -> FineTuningJobResponse:
        job_root = self._job_root(request.job_id)
        job_root.mkdir(parents=True, exist_ok=True)
        created_at = _now_iso()
        manifest_path = job_root / "training-manifest.json"
        bundle_path = job_root / "prepared-bundle.json"
        log_path = job_root / "training-log.txt"

        manifest_payload: Dict[str, Any] = {
            "jobId": request.job_id,
            "jobName": request.job_name,
            "backend": request.backend,
            "executionKind": request.execution_kind,
            "baseModel": {
                "id": request.base_model_id,
                "name": request.base_model_name,
                "location": request.base_model_location,
            },
            "dataset": {
                "id": request.dataset_id,
                "name": request.dataset_name,
                "versionId": request.dataset_version_id,
                "versionNumber": request.dataset_version_number,
                "taskType": request.dataset_task_type,
                "exampleCount": len(request.examples),
            },
            "configuration": request.configuration.model_dump(),
            "submittedBy": request.created_by,
            "createdAt": created_at,
            "summary": "Prepared a durable manifest/export bundle. This path validates inputs and writes reviewable artifacts, but it does not run gradient training.",
        }
        manifest_path.write_text(json.dumps(manifest_payload, indent=2), encoding="utf-8")
        bundle_path.write_text(
            json.dumps(
                {
                    "artifact": "prepared-bundle",
                    "baseModelId": request.base_model_id,
                    "datasetVersionId": request.dataset_version_id,
                    "exampleCount": len(request.examples),
                    "configuration": request.configuration.model_dump(),
                    "exportedWithoutTraining": True,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        log_path.write_text("Prepared manifest/export-only bundle. No training job was executed.\n", encoding="utf-8")

        payload = self._base_job_payload(request, status="exported-without-training", created_at=created_at)
        payload.update(
            {
                "completed_at": created_at,
                "summary": manifest_payload["summary"],
                "output_model_name": None,
                "progress": {
                    "percent": 100,
                    "current_step": 1,
                    "total_steps": 1,
                    "status_detail": "Preparation/export-only artifacts written.",
                },
                "artifacts": [
                    self._artifact(request.job_id, "training-manifest", "Training manifest", manifest_path, created_at, {"artifactRole": "input-manifest"}),
                    self._artifact(request.job_id, "prepared-bundle", "Prepared bundle", bundle_path, created_at, {"artifactRole": "prepared-export"}),
                    self._artifact(request.job_id, "log", "Preparation log", log_path, created_at, {}),
                ],
            }
        )
        self._append_diagnostic(
            payload,
            code="manifest_preparation_complete",
            level="info",
            message="Prepared manifest/export-only artifacts without starting a training job.",
            detail="Use the local-gradient-training execution kind to run the real local trainer.",
        )
        payload["provenance"].update(
            {
                "truthfulness": "exported-without-training",
                "run_mode": "preparation-only",
                "supports_gradient_training": False,
                "is_preparation_only": True,
                "provider": "python-runtime",
                "model_identity": request.base_model_name,
                "path": str(job_root),
                "detail": "Prepared a manifest/export-only bundle; no gradient training was executed.",
            }
        )

        with self._lock:
            self._jobs[request.job_id] = payload
            self._persist_job(payload)
        return FineTuningJobResponse.model_validate(deepcopy(payload))

    def _start_local_training_job(self, request: FineTuningJobRequest) -> FineTuningJobResponse:
        created_at = _now_iso()
        job_root = self._job_root(request.job_id)
        job_root.mkdir(parents=True, exist_ok=True)
        manifest_path = job_root / "training-manifest.json"
        manifest_path.write_text(
            json.dumps(
                {
                    "jobId": request.job_id,
                    "jobName": request.job_name,
                    "executionKind": request.execution_kind,
                    "backend": request.backend,
                    "baseModel": {
                        "id": request.base_model_id,
                        "name": request.base_model_name,
                        "location": request.base_model_location,
                    },
                    "dataset": {
                        "id": request.dataset_id,
                        "name": request.dataset_name,
                        "versionId": request.dataset_version_id,
                        "versionNumber": request.dataset_version_number,
                        "taskType": request.dataset_task_type,
                        "exampleCount": len(request.examples),
                    },
                    "configuration": request.configuration.model_dump(),
                    "trainingBackend": "lightweight-text-adapter",
                },
                indent=2,
            ),
            encoding="utf-8",
        )

        total_steps = max(request.configuration.epochs, 1) * max(math.ceil(len(request.examples) / max(request.configuration.batch_size, 1)), 1)
        payload = self._base_job_payload(request, status="submitted", created_at=created_at)
        payload.update(
            {
                "submitted_at": created_at,
                "summary": "Submitted a real local NumPy training job. This backend trains a lightweight text adapter in-process; it is not provider fine-tuning.",
                "progress": {
                    "percent": 0,
                    "current_epoch": 0,
                    "total_epochs": request.configuration.epochs,
                    "current_step": 0,
                    "total_steps": total_steps,
                    "status_detail": "Training job submitted to the local Python runtime backend.",
                },
                "artifacts": [
                    self._artifact(request.job_id, "training-manifest", "Training manifest", manifest_path, created_at, {"artifactRole": "input-manifest"}),
                ],
            }
        )
        self._append_diagnostic(
            payload,
            code="local_training_submitted",
            level="info",
            message="Submitted the local NumPy gradient-training backend.",
            detail="This path runs real gradient updates against a lightweight text adapter; it does not call a remote provider fine-tuning API.",
        )
        payload["provenance"].update(
            {
                "truthfulness": "real-execution",
                "run_mode": "local-gradient-training",
                "supports_gradient_training": True,
                "is_preparation_only": False,
                "provider": "python-runtime-local",
                "model_identity": request.base_model_name,
                "path": str(job_root),
                "detail": "Running a real in-process local training job using NumPy gradient descent.",
            }
        )

        with self._lock:
            self._jobs[request.job_id] = payload
            self._active_job_ids.add(request.job_id)
            self._persist_job(payload)

        thread = threading.Thread(target=self._run_local_training_job, args=(request,), daemon=True, name=f"training-{request.job_id}")
        thread.start()
        return FineTuningJobResponse.model_validate(deepcopy(payload))

    def _run_local_training_job(self, request: FineTuningJobRequest) -> None:
        job_root = self._job_root(request.job_id)
        log_path = job_root / "training-log.txt"
        metrics_path = job_root / "training-metrics.json"
        trained_model_path = job_root / "trained-model.json"
        diagnostic_path = job_root / "failure-diagnostic.json"
        log_path.write_text("", encoding="utf-8")

        self._append_log(log_path, "Queued local training job.")
        total_steps = max(request.configuration.epochs, 1) * max(math.ceil(len(request.examples) / max(request.configuration.batch_size, 1)), 1)
        self._patch_job(
            request.job_id,
            {
                "status": "queued",
                "updated_at": _now_iso(),
                "progress": {
                    "percent": 1,
                    "current_epoch": 0,
                    "total_epochs": request.configuration.epochs,
                    "current_step": 0,
                    "total_steps": total_steps,
                    "status_detail": "Queued for local training execution.",
                },
            },
        )
        time.sleep(0.05)

        self._append_log(log_path, "Starting local training job.")
        started_at = _now_iso()
        self._patch_job(
            request.job_id,
            {
                "status": "running",
                "started_at": started_at,
                "updated_at": started_at,
                "progress": {
                    "percent": 2,
                    "current_epoch": 0,
                    "total_epochs": request.configuration.epochs,
                    "current_step": 0,
                    "total_steps": total_steps,
                    "status_detail": "Loading examples and initializing weights.",
                },
            },
        )

        try:
            np = _require_numpy()
            examples = request.examples
            vocab = self._build_vocabulary(examples)
            x_matrix = np.vstack([self._vectorize(example.input_text, vocab) for example in examples])
            y_matrix = np.vstack([self._vectorize(example.target_text, vocab) for example in examples])
            weights = np.zeros((len(vocab), len(vocab)), dtype=np.float64)
            learning_rate = max(request.configuration.learning_rate, 1e-6)
            epochs = max(request.configuration.epochs, 1)
            batch_size = max(request.configuration.batch_size, 1)
            checkpoints: List[Dict[str, Any]] = []
            metrics_history: List[Dict[str, Any]] = []
            total_examples = len(examples)
            total_batches = max(math.ceil(total_examples / batch_size), 1)
            completed_steps = 0

            for epoch in range(1, epochs + 1):
                for batch_index, batch_start in enumerate(range(0, total_examples, batch_size), start=1):
                    if request.job_id in self._cancel_requests:
                        completed_at = _now_iso()
                        self._append_log(log_path, f"Cancellation detected during epoch {epoch}; stopping job.")
                        self._patch_job(
                            request.job_id,
                            {
                                "status": "cancelled",
                                "completed_at": completed_at,
                                "updated_at": completed_at,
                                "progress": {
                                    "percent": max(int((completed_steps / total_steps) * 100), 1),
                                    "current_epoch": epoch,
                                    "total_epochs": epochs,
                                    "current_step": completed_steps,
                                    "total_steps": total_steps,
                                    "status_detail": "Training cancelled after persisting the latest durable state.",
                                },
                            },
                        )
                        self._append_log(log_path, "Cancellation completed.")
                        self._persist_artifact_if_missing(request.job_id, "log", "Training log", log_path, completed_at)
                        return

                    batch_x = x_matrix[batch_start: batch_start + batch_size]
                    batch_y = y_matrix[batch_start: batch_start + batch_size]
                    predictions = batch_x @ weights
                    error = predictions - batch_y
                    gradient = (2.0 / max(len(batch_x), 1)) * (batch_x.T @ error)
                    weights -= learning_rate * gradient
                    batch_loss = float(np.mean(error ** 2))
                    completed_steps += 1
                    progress_percent = min(95, max(2, int((completed_steps / total_steps) * 100)))
                    self._append_log(
                        log_path,
                        f"Epoch {epoch}/{epochs} batch {batch_index}/{total_batches} completed with batch_loss={batch_loss:.6f}.",
                    )
                    self._patch_job(
                        request.job_id,
                        {
                            "updated_at": _now_iso(),
                            "progress": {
                                "percent": progress_percent,
                                "current_epoch": epoch,
                                "total_epochs": epochs,
                                "current_step": completed_steps,
                                "total_steps": total_steps,
                                "latest_metric_name": "batch_loss",
                                "latest_metric_value": batch_loss,
                                "status_detail": f"Running epoch {epoch}/{epochs}, batch {batch_index}/{total_batches}.",
                            },
                        },
                    )

                predictions = x_matrix @ weights
                error = predictions - y_matrix
                epoch_loss = float(np.mean(error ** 2))
                epoch_mae = float(np.mean(np.abs(error)))
                checkpoint_time = _now_iso()
                checkpoint_path = job_root / f"checkpoint-epoch-{epoch}.json"
                checkpoint_payload = {
                    "epoch": epoch,
                    "loss": epoch_loss,
                    "meanAbsoluteError": epoch_mae,
                    "vocabSize": len(vocab),
                    "completedSteps": completed_steps,
                }
                checkpoint_path.write_text(json.dumps(checkpoint_payload, indent=2), encoding="utf-8")
                checkpoint_artifact_id = f"{request.job_id}:checkpoint:{epoch}"
                artifact = self._artifact(
                    request.job_id,
                    "checkpoint",
                    f"Checkpoint epoch {epoch}",
                    checkpoint_path,
                    checkpoint_time,
                    {"epoch": epoch, "loss": epoch_loss, "meanAbsoluteError": epoch_mae},
                )
                checkpoints.append(
                    {
                        "id": checkpoint_artifact_id,
                        "label": f"Epoch {epoch}",
                        "epoch": epoch,
                        "metric_name": "loss",
                        "metric_value": epoch_loss,
                        "created_at": checkpoint_time,
                        "artifact_id": artifact["id"],
                    }
                )
                metrics_history.append(
                    {
                        "epoch": epoch,
                        "loss": epoch_loss,
                        "meanAbsoluteError": epoch_mae,
                        "completedSteps": completed_steps,
                    }
                )
                self._append_log(log_path, f"Epoch {epoch}/{epochs} finished with loss={epoch_loss:.6f} and mae={epoch_mae:.6f}.")
                with self._lock:
                    artifacts = [*self._jobs[request.job_id]["artifacts"], artifact]
                self._patch_job(
                    request.job_id,
                    {
                        "checkpoints": checkpoints,
                        "updated_at": checkpoint_time,
                        "artifacts": artifacts,
                        "progress": {
                            "percent": min(97, int((completed_steps / total_steps) * 100)),
                            "current_epoch": epoch,
                            "total_epochs": epochs,
                            "current_step": completed_steps,
                            "total_steps": total_steps,
                            "latest_metric_name": "loss",
                            "latest_metric_value": epoch_loss,
                            "status_detail": f"Persisted checkpoint for epoch {epoch} of {epochs}.",
                        },
                    },
                )
                time.sleep(0.05)

            completed_at = _now_iso()
            metrics_payload = {
                "summary": {
                    "epochs": epochs,
                    "batchSize": batch_size,
                    "totalSteps": total_steps,
                    "vocabSize": len(vocab),
                    "finalLoss": metrics_history[-1]["loss"] if metrics_history else None,
                    "bestLoss": min((entry["loss"] for entry in metrics_history), default=None),
                },
                "history": metrics_history,
            }
            metrics_path.write_text(json.dumps(metrics_payload, indent=2), encoding="utf-8")
            trained_model_path.write_text(
                json.dumps(
                    {
                        "backend": "python-runtime-local",
                        "training": "lightweight-text-adapter",
                        "baseModel": {
                            "id": request.base_model_id,
                            "name": request.base_model_name,
                            "location": request.base_model_location,
                        },
                        "dataset": {
                            "id": request.dataset_id,
                            "name": request.dataset_name,
                            "versionId": request.dataset_version_id,
                            "versionNumber": request.dataset_version_number,
                        },
                        "configuration": request.configuration.model_dump(),
                        "vocabulary": vocab,
                        "weights": np.round(weights, 8).tolist(),
                        "metrics": metrics_payload,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            self._append_log(log_path, "Local training completed successfully.")
            with self._lock:
                artifacts = list(self._jobs[request.job_id]["artifacts"])
                artifacts.append(self._artifact(request.job_id, "trained-model", "Trained local adapter", trained_model_path, completed_at, {"vocabSize": len(vocab)}))
                artifacts.append(self._artifact(request.job_id, "metrics", "Training metrics", metrics_path, completed_at, {"epochs": epochs, "batchSize": batch_size}))
                artifacts.append(self._artifact(request.job_id, "log", "Training log", log_path, completed_at, {}))
                self._jobs[request.job_id].update(
                    {
                        "status": "completed",
                        "updated_at": completed_at,
                        "completed_at": completed_at,
                        "artifacts": artifacts,
                        "output_model_name": f"{request.base_model_name} · local adapter tuned on {request.dataset_name} v{request.dataset_version_number}",
                        "summary": "Completed a real local NumPy training run for the lightweight adapter backend.",
                        "progress": {
                            "percent": 100,
                            "current_epoch": epochs,
                            "total_epochs": epochs,
                            "current_step": total_steps,
                            "total_steps": total_steps,
                            "latest_metric_name": "loss",
                            "latest_metric_value": metrics_history[-1]["loss"] if metrics_history else None,
                            "status_detail": "Training completed.",
                        },
                    }
                )
                self._append_diagnostic(
                    self._jobs[request.job_id],
                    code="local_training_completed",
                    level="info",
                    message="Local gradient training completed successfully.",
                    detail="Artifacts include checkpoints, training metrics, and the final lightweight adapter model.",
                )
                self._persist_job(self._jobs[request.job_id])
        except Exception as error:  # noqa: BLE001
            completed_at = _now_iso()
            self._append_log(log_path, f"Training failed: {error}")
            with self._lock:
                existing_checkpoints = list(self._jobs[request.job_id].get("checkpoints", []))
                status = "partially-completed" if existing_checkpoints else "failed"
                diagnostic_payload = {
                    "error": str(error),
                    "errorType": error.__class__.__name__,
                    "jobId": request.job_id,
                    "status": status,
                    "checkpointCount": len(existing_checkpoints),
                    "recordedAt": completed_at,
                }
                diagnostic_path.write_text(json.dumps(diagnostic_payload, indent=2), encoding="utf-8")
                artifacts = list(self._jobs[request.job_id]["artifacts"])
                artifacts.append(self._artifact(request.job_id, "diagnostic", "Failure diagnostic", diagnostic_path, completed_at, {"status": status}))
                artifacts.append(self._artifact(request.job_id, "log", "Training log", log_path, completed_at, {}))
                self._jobs[request.job_id].update(
                    {
                        "status": status,
                        "updated_at": completed_at,
                        "completed_at": completed_at,
                        "artifacts": artifacts,
                        "summary": "Training stopped before a clean completion and durable diagnostics were written.",
                        "progress": {
                            "percent": self._jobs[request.job_id].get("progress", {}).get("percent", 0),
                            "current_epoch": self._jobs[request.job_id].get("progress", {}).get("current_epoch"),
                            "total_epochs": request.configuration.epochs,
                            "current_step": self._jobs[request.job_id].get("progress", {}).get("current_step"),
                            "total_steps": self._jobs[request.job_id].get("progress", {}).get("total_steps", total_steps),
                            "status_detail": "Training failed before clean completion." if status == "failed" else "Training stopped after writing partial checkpoints.",
                        },
                    }
                )
                self._append_diagnostic(
                    self._jobs[request.job_id],
                    code="local_training_failed",
                    level="error",
                    message="Local gradient training failed.",
                    detail=str(error),
                )
                self._persist_job(self._jobs[request.job_id])
        finally:
            self._cancel_requests.discard(request.job_id)
            self._active_job_ids.discard(request.job_id)

    def _build_vocabulary(self, examples: List[Any], limit: int = 128) -> List[str]:
        counts: Dict[str, int] = {}
        for example in examples:
            for token in self._tokenize(example.input_text):
                counts[token] = counts.get(token, 0) + 1
            for token in self._tokenize(example.target_text):
                counts[token] = counts.get(token, 0) + 1
        ordered = [token for token, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:limit]]
        return ordered or ["<empty>"]

    def _vectorize(self, text: str, vocab: List[str]) -> np.ndarray:
        np = _require_numpy()
        tokens = self._tokenize(text)
        vector = np.zeros((len(vocab),), dtype=np.float64)
        index = {token: position for position, token in enumerate(vocab)}
        for token in tokens:
            token_index = index.get(token)
            if token_index is not None:
                vector[token_index] += 1.0
        norm = np.linalg.norm(vector)
        return vector if norm == 0 else vector / norm

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r"[a-z0-9']+", text.lower())

    def _base_job_payload(self, request: FineTuningJobRequest, status: str, created_at: str) -> Dict[str, Any]:
        job_root = self._job_root(request.job_id)
        return {
            "job_id": request.job_id,
            "job_name": request.job_name,
            "backend": request.backend,
            "execution_kind": request.execution_kind,
            "base_model_id": request.base_model_id,
            "dataset_id": request.dataset_id,
            "dataset_version_id": request.dataset_version_id,
            "created_by": request.created_by,
            "created_at": created_at,
            "updated_at": created_at,
            "submitted_at": None,
            "started_at": None,
            "completed_at": None,
            "status": status,
            "configuration": request.configuration.model_dump(),
            "diagnostics": [],
            "artifacts": [],
            "checkpoints": [],
            "output_model_name": None,
            "summary": None,
            "progress": None,
            "provenance": {
                "execution_kind": request.execution_kind,
                "backend": request.backend,
                "truthfulness": "preparation-only" if request.execution_kind == "preparation-only" else "real-execution",
                "runtime": "python-runtime",
                "run_mode": request.execution_kind,
                "supports_gradient_training": request.execution_kind != "preparation-only",
                "is_preparation_only": request.execution_kind == "preparation-only",
                "provider": "python-runtime",
                "model_identity": request.base_model_name,
                "path": str(job_root),
                "fallback_reason": None,
                "diagnostics": [],
                "started_at": None,
                "completed_at": None,
                "detail": None,
            },
        }

    def _artifact(self, job_id: str, kind: str, label: str, path: Path, created_at: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        content_type = "application/json" if path.suffix == ".json" else "text/plain"
        return {
            "id": f"{job_id}:{kind}:{path.stem}",
            "kind": kind,
            "label": label,
            "location": str(path),
            "content_type": content_type,
            "created_at": created_at,
            "metadata": metadata,
        }

    def _append_log(self, path: Path, message: str) -> None:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(f"[{_now_iso()}] {message}\n")

    def _persist_artifact_if_missing(self, job_id: str, kind: str, label: str, path: Path, created_at: str) -> None:
        with self._lock:
            payload = self._jobs[job_id]
            if not any(artifact["kind"] == kind and artifact.get("location") == str(path) for artifact in payload["artifacts"]):
                payload["artifacts"].append(self._artifact(job_id, kind, label, path, created_at, {}))
                self._persist_job(payload)

    def _append_diagnostic(self, payload: Dict[str, Any], *, code: str, level: str, message: str, detail: str | None = None) -> None:
        if any(existing["code"] == code and existing.get("detail") == detail for existing in payload["diagnostics"]):
            return
        payload["diagnostics"].append(
            {
                "code": code,
                "level": level,
                "message": message,
                "detail": detail,
            }
        )

    def _persist_job(self, payload: Dict[str, Any]) -> None:
        payload["provenance"]["diagnostics"] = deepcopy(payload["diagnostics"])
        payload["provenance"]["started_at"] = payload.get("started_at")
        payload["provenance"]["completed_at"] = payload.get("completed_at")
        job_root = self._job_root(payload["job_id"])
        job_root.mkdir(parents=True, exist_ok=True)
        (job_root / "job-state.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _patch_job(self, job_id: str, updates: Dict[str, Any]) -> None:
        with self._lock:
            self._jobs[job_id].update(updates)
            self._persist_job(self._jobs[job_id])

    def _load_jobs(self) -> None:
        for state_file in self._workspace_root.glob("*/job-state.json"):
            try:
                payload = json.loads(state_file.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            self._jobs[payload["job_id"]] = payload

    def _reconcile_orphaned_jobs(self, job_ids: List[str] | None = None, force: bool = False) -> None:
        target_ids = set(job_ids or self._jobs.keys())
        for job_id in target_ids:
            payload = self._jobs.get(job_id)
            if not payload:
                continue
            if payload["status"] in {"completed", "failed", "cancelled", "partially-completed", "exported-without-training"} and not force:
                continue
            if payload["job_id"] in self._active_job_ids and not force:
                continue
            self._reconcile_job_payload(payload)

    def _reconcile_job_payload(self, payload: Dict[str, Any]) -> None:
        job_root = self._job_root(payload["job_id"])
        metrics_path = job_root / "training-metrics.json"
        trained_model_path = job_root / "trained-model.json"
        diagnostic_path = job_root / "failure-diagnostic.json"
        log_path = job_root / "training-log.txt"
        checkpoint_paths = sorted(job_root.glob("checkpoint-epoch-*.json"))
        now = _now_iso()

        if payload["status"] == "exported-without-training":
            self._persist_job(payload)
            return

        if trained_model_path.exists() and metrics_path.exists():
            payload["status"] = "completed"
            payload["completed_at"] = payload.get("completed_at") or now
            payload["updated_at"] = now
            self._append_diagnostic(
                payload,
                code="runtime_reconciled_completed_job",
                level="info",
                message="Reconciled a completed local training job from durable artifacts.",
                detail="The runtime reloaded trained-model and metrics artifacts from disk.",
            )
        elif diagnostic_path.exists():
            payload["status"] = "partially-completed" if checkpoint_paths else "failed"
            payload["completed_at"] = payload.get("completed_at") or now
            payload["updated_at"] = now
            self._append_diagnostic(
                payload,
                code="runtime_reconciled_failed_job",
                level="warning",
                message="Reconciled a stopped training job from durable diagnostic artifacts.",
                detail="The runtime found a persisted failure diagnostic while reloading job state.",
            )
        elif checkpoint_paths:
            payload["status"] = "reconciliation-needed"
            payload["updated_at"] = now
            self._append_diagnostic(
                payload,
                code="runtime_reconciliation_needed",
                level="warning",
                message="Training wrote checkpoints but the runtime could not confirm a clean completion.",
                detail="Refresh/reconcile after inspecting the checkpoint and log artifacts.",
            )
        elif payload["status"] in {"submitted", "queued", "running"}:
            payload["status"] = "reconciliation-needed"
            payload["updated_at"] = now
            self._append_diagnostic(
                payload,
                code="runtime_reconciliation_needed_no_terminal_artifact",
                level="warning",
                message="The Python runtime restarted before the local training thread reported a terminal state.",
                detail="No trained model or failure diagnostic artifact was found yet.",
            )

        existing_artifact_ids = {artifact["id"] for artifact in payload["artifacts"]}
        if log_path.exists() and not any(artifact["kind"] == "log" and artifact.get("location") == str(log_path) for artifact in payload["artifacts"]):
            payload["artifacts"].append(self._artifact(payload["job_id"], "log", "Training log", log_path, now, {}))
        if metrics_path.exists() and not any(artifact["kind"] == "metrics" and artifact.get("location") == str(metrics_path) for artifact in payload["artifacts"]):
            payload["artifacts"].append(self._artifact(payload["job_id"], "metrics", "Training metrics", metrics_path, now, {}))
        if trained_model_path.exists() and not any(artifact["kind"] == "trained-model" and artifact.get("location") == str(trained_model_path) for artifact in payload["artifacts"]):
            payload["artifacts"].append(self._artifact(payload["job_id"], "trained-model", "Trained local adapter", trained_model_path, now, {}))
        if diagnostic_path.exists() and not any(artifact["kind"] == "diagnostic" and artifact.get("location") == str(diagnostic_path) for artifact in payload["artifacts"]):
            payload["artifacts"].append(self._artifact(payload["job_id"], "diagnostic", "Failure diagnostic", diagnostic_path, now, {}))

        checkpoints: List[Dict[str, Any]] = []
        for checkpoint_path in checkpoint_paths:
            try:
                checkpoint_payload = json.loads(checkpoint_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            artifact = self._artifact(
                payload["job_id"],
                "checkpoint",
                f"Checkpoint epoch {checkpoint_payload.get('epoch', len(checkpoints) + 1)}",
                checkpoint_path,
                now,
                {"epoch": checkpoint_payload.get("epoch"), "loss": checkpoint_payload.get("loss")},
            )
            if artifact["id"] not in existing_artifact_ids:
                payload["artifacts"].append(artifact)
                existing_artifact_ids.add(artifact["id"])
            checkpoints.append(
                {
                    "id": f"{payload['job_id']}:checkpoint:{checkpoint_payload.get('epoch', len(checkpoints) + 1)}",
                    "label": f"Epoch {checkpoint_payload.get('epoch', len(checkpoints) + 1)}",
                    "epoch": checkpoint_payload.get("epoch", len(checkpoints) + 1),
                    "metric_name": "loss",
                    "metric_value": checkpoint_payload.get("loss"),
                    "created_at": now,
                    "artifact_id": artifact["id"],
                }
            )
        if checkpoints:
            payload["checkpoints"] = checkpoints
        self._persist_job(payload)

    def _job_root(self, job_id: str) -> Path:
        return self._workspace_root / job_id
