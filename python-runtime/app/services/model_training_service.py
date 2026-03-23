from __future__ import annotations

import json
import re
import threading
import time
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import numpy as np

from app.models.requests import FineTuningJobRequest
from app.models.responses import FineTuningJobResponse


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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

        if request.execution_kind == "preparation-only":
            return self._prepare_job(request)
        return self._start_local_training_job(request)

    def list_jobs(self) -> List[FineTuningJobResponse]:
        with self._lock:
            self._reconcile_orphaned_jobs()
            ordered = sorted(self._jobs.values(), key=lambda job: job.get("submitted_at") or job["created_at"], reverse=True)
            return [FineTuningJobResponse.model_validate(deepcopy(job)) for job in ordered]

    def get_job(self, job_id: str) -> FineTuningJobResponse:
        normalized_job_id = job_id.strip()
        with self._lock:
            self._reconcile_orphaned_jobs()
            payload = self._jobs.get(normalized_job_id)
            if not payload:
                raise KeyError(normalized_job_id)
            return FineTuningJobResponse.model_validate(deepcopy(payload))

    def cancel_job(self, job_id: str) -> FineTuningJobResponse:
        normalized_job_id = job_id.strip()
        with self._lock:
            payload = self._jobs.get(normalized_job_id)
            if not payload:
                raise KeyError(normalized_job_id)
            if payload["status"] in {"completed", "failed", "cancelled", "prepared"}:
                return FineTuningJobResponse.model_validate(deepcopy(payload))
            self._cancel_requests.add(normalized_job_id)
            payload["diagnostics"].append({
                "code": "job_cancellation_requested",
                "level": "warning",
                "message": "Cancellation was requested for the running local training job.",
            })
            payload["updated_at"] = _now_iso()
            self._persist_job(payload)
            return FineTuningJobResponse.model_validate(deepcopy(payload))

    def _prepare_job(self, request: FineTuningJobRequest) -> FineTuningJobResponse:
        job_root = self._workspace_root / request.job_id
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
        bundle_path.write_text(json.dumps({
            "artifact": "prepared-bundle",
            "baseModelId": request.base_model_id,
            "datasetVersionId": request.dataset_version_id,
            "exampleCount": len(request.examples),
            "configuration": request.configuration.model_dump(),
        }, indent=2), encoding="utf-8")
        log_path.write_text(
            "Prepared manifest/export-only bundle. No training job was executed.\n",
            encoding="utf-8",
        )

        payload = self._base_job_payload(request, status="prepared", created_at=created_at)
        payload.update({
            "completed_at": created_at,
            "summary": manifest_payload["summary"],
            "output_model_name": None,
            "progress": {
                "percent": 100,
                "current_step": 1,
                "total_steps": 1,
                "status_detail": "Preparation bundle written.",
            },
            "diagnostics": [
                {
                    "code": "manifest_preparation_complete",
                    "level": "info",
                    "message": "Prepared manifest/export-only artifacts without starting a training job.",
                    "detail": "Use a local-gradient-training execution kind to run real training.",
                }
            ],
            "artifacts": [
                self._artifact(request.job_id, "training-manifest", "Training manifest", manifest_path, created_at, {"artifactRole": "input-manifest"}),
                self._artifact(request.job_id, "prepared-bundle", "Prepared bundle", bundle_path, created_at, {"artifactRole": "prepared-export"}),
                self._artifact(request.job_id, "log", "Preparation log", log_path, created_at, {}),
            ],
            "provenance": {
                "execution_kind": request.execution_kind,
                "backend": request.backend,
                "truthfulness": "preparation-only",
                "runtime": "python-runtime",
                "supports_gradient_training": False,
                "is_preparation_only": True,
                "provider": "python-runtime",
                "model_identity": request.base_model_name,
                "detail": "Prepared a manifest/export-only bundle; no gradient training was executed.",
            },
        })

        with self._lock:
            self._jobs[request.job_id] = payload
            self._persist_job(payload)
        return FineTuningJobResponse.model_validate(deepcopy(payload))

    def _start_local_training_job(self, request: FineTuningJobRequest) -> FineTuningJobResponse:
        created_at = _now_iso()
        payload = self._base_job_payload(request, status="submitted", created_at=created_at)
        payload.update({
            "submitted_at": created_at,
            "summary": "Submitted a real local NumPy training job. This backend trains a lightweight text adapter in-process; it is not provider fine-tuning.",
            "progress": {
                "percent": 0,
                "current_epoch": 0,
                "total_epochs": request.configuration.epochs,
                "current_step": 0,
                "total_steps": request.configuration.epochs,
                "status_detail": "Training job submitted to the local Python runtime backend.",
            },
            "diagnostics": [
                {
                    "code": "local_training_submitted",
                    "level": "info",
                    "message": "Submitted the local NumPy gradient-training backend.",
                    "detail": "This path runs real gradient updates against a lightweight text adapter; it does not call a remote provider fine-tuning API.",
                }
            ],
            "provenance": {
                "execution_kind": request.execution_kind,
                "backend": request.backend,
                "truthfulness": "local-training-job",
                "runtime": "python-runtime",
                "supports_gradient_training": True,
                "is_preparation_only": False,
                "provider": "python-runtime-local",
                "model_identity": request.base_model_name,
                "detail": "Running a real in-process local training job using NumPy gradient descent.",
            },
        })

        job_root = self._workspace_root / request.job_id
        job_root.mkdir(parents=True, exist_ok=True)
        manifest_path = job_root / "training-manifest.json"
        manifest_path.write_text(json.dumps({
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
        }, indent=2), encoding="utf-8")
        payload["artifacts"].append(self._artifact(request.job_id, "training-manifest", "Training manifest", manifest_path, created_at, {"artifactRole": "input-manifest"}))

        with self._lock:
            self._jobs[request.job_id] = payload
            self._active_job_ids.add(request.job_id)
            self._persist_job(payload)

        thread = threading.Thread(target=self._run_local_training_job, args=(request,), daemon=True, name=f"training-{request.job_id}")
        thread.start()
        return FineTuningJobResponse.model_validate(deepcopy(payload))

    def _run_local_training_job(self, request: FineTuningJobRequest) -> None:
        job_root = self._workspace_root / request.job_id
        job_root.mkdir(parents=True, exist_ok=True)
        log_path = job_root / "training-log.txt"
        metrics_path = job_root / "training-metrics.json"
        log_path.write_text("", encoding="utf-8")

        self._append_log(log_path, "Starting local training job.")
        self._patch_job(request.job_id, {
            "status": "running",
            "started_at": _now_iso(),
            "updated_at": _now_iso(),
            "progress": {
                "percent": 1,
                "current_epoch": 0,
                "total_epochs": request.configuration.epochs,
                "current_step": 0,
                "total_steps": request.configuration.epochs,
                "status_detail": "Loading examples and initializing weights.",
            },
        })

        try:
            examples = request.examples
            vocab = self._build_vocabulary(examples)
            x_matrix = np.vstack([self._vectorize(example.input_text, vocab) for example in examples])
            y_matrix = np.vstack([self._vectorize(example.target_text, vocab) for example in examples])
            weights = np.zeros((len(vocab), len(vocab)), dtype=np.float64)
            learning_rate = max(request.configuration.learning_rate, 1e-6)
            epochs = max(request.configuration.epochs, 1)
            checkpoints: List[Dict[str, Any]] = []
            metrics_history: List[Dict[str, Any]] = []

            for epoch in range(1, epochs + 1):
                if request.job_id in self._cancel_requests:
                    self._append_log(log_path, f"Cancellation detected before epoch {epoch}; stopping job.")
                    self._patch_job(request.job_id, {
                        "status": "cancelled",
                        "completed_at": _now_iso(),
                        "updated_at": _now_iso(),
                        "progress": {
                            "percent": max(int(((epoch - 1) / epochs) * 100), 1),
                            "current_epoch": epoch - 1,
                            "total_epochs": epochs,
                            "current_step": epoch - 1,
                            "total_steps": epochs,
                            "status_detail": "Training cancelled before the next epoch started.",
                        },
                    })
                    return

                predictions = x_matrix @ weights
                error = predictions - y_matrix
                loss = float(np.mean(error ** 2))
                gradient = (2.0 / max(len(examples), 1)) * (x_matrix.T @ error)
                weights -= learning_rate * gradient
                progress_percent = int((epoch / epochs) * 100)
                checkpoint_time = _now_iso()
                checkpoint_path = job_root / f"checkpoint-epoch-{epoch}.json"
                checkpoint_payload = {"epoch": epoch, "loss": loss, "vocabSize": len(vocab)}
                checkpoint_path.write_text(json.dumps(checkpoint_payload, indent=2), encoding="utf-8")
                checkpoint_artifact_id = f"{request.job_id}:checkpoint:{epoch}"
                checkpoints.append({
                    "id": checkpoint_artifact_id,
                    "label": f"Epoch {epoch}",
                    "epoch": epoch,
                    "metric_name": "loss",
                    "metric_value": loss,
                    "created_at": checkpoint_time,
                    "artifact_id": checkpoint_artifact_id,
                })
                metrics_history.append({"epoch": epoch, "loss": loss})
                self._append_log(log_path, f"Epoch {epoch}/{epochs} completed with loss={loss:.6f}.")
                self._patch_job(request.job_id, {
                    "checkpoints": checkpoints,
                    "updated_at": checkpoint_time,
                    "progress": {
                        "percent": progress_percent,
                        "current_epoch": epoch,
                        "total_epochs": epochs,
                        "current_step": epoch,
                        "total_steps": epochs,
                        "latest_metric_name": "loss",
                        "latest_metric_value": loss,
                        "status_detail": f"Completed epoch {epoch} of {epochs}.",
                    },
                    "artifacts": self._jobs[request.job_id]["artifacts"] + [
                        self._artifact(request.job_id, "checkpoint", f"Checkpoint epoch {epoch}", checkpoint_path, checkpoint_time, {"epoch": epoch, "loss": loss})
                    ],
                })
                time.sleep(0.05)

            completed_at = _now_iso()
            trained_model_path = job_root / "trained-model.json"
            trained_model_path.write_text(json.dumps({
                "backend": "python-runtime-local",
                "training": "lightweight-text-adapter",
                "vocabulary": vocab,
                "weights": np.round(weights, 6).tolist(),
                "metrics": metrics_history,
            }, indent=2), encoding="utf-8")
            metrics_path.write_text(json.dumps(metrics_history, indent=2), encoding="utf-8")
            self._append_log(log_path, "Local training completed successfully.")
            with self._lock:
                artifacts = list(self._jobs[request.job_id]["artifacts"])
                artifacts.append(self._artifact(request.job_id, "trained-model", "Trained local adapter", trained_model_path, completed_at, {"vocabSize": len(vocab)}))
                artifacts.append(self._artifact(request.job_id, "metrics", "Training metrics", metrics_path, completed_at, {"epochs": epochs}))
                artifacts.append(self._artifact(request.job_id, "log", "Training log", log_path, completed_at, {}))
                self._jobs[request.job_id].update({
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
                        "current_step": epochs,
                        "total_steps": epochs,
                        "latest_metric_name": "loss",
                        "latest_metric_value": metrics_history[-1]["loss"] if metrics_history else None,
                        "status_detail": "Training completed.",
                    },
                })
                self._jobs[request.job_id]["diagnostics"].append({
                    "code": "local_training_completed",
                    "level": "info",
                    "message": "Local gradient training completed successfully.",
                    "detail": "Artifacts include checkpoints, training metrics, and the final lightweight adapter model.",
                })
                self._persist_job(self._jobs[request.job_id])
        except Exception as error:  # noqa: BLE001
            self._append_log(log_path, f"Training failed: {error}")
            self._patch_job(request.job_id, {
                "status": "failed",
                "updated_at": _now_iso(),
                "completed_at": _now_iso(),
                "progress": {
                    "percent": self._jobs[request.job_id].get("progress", {}).get("percent", 0),
                    "current_epoch": self._jobs[request.job_id].get("progress", {}).get("current_epoch"),
                    "total_epochs": request.configuration.epochs,
                    "current_step": self._jobs[request.job_id].get("progress", {}).get("current_step"),
                    "total_steps": request.configuration.epochs,
                    "status_detail": "Training failed.",
                },
            })
            with self._lock:
                self._jobs[request.job_id]["diagnostics"].append({
                    "code": "local_training_failed",
                    "level": "error",
                    "message": "Local gradient training failed.",
                    "detail": str(error),
                })
                self._jobs[request.job_id]["artifacts"].append(self._artifact(request.job_id, "log", "Training log", log_path, _now_iso(), {}))
                self._persist_job(self._jobs[request.job_id])
        finally:
            self._cancel_requests.discard(request.job_id)
            self._active_job_ids.discard(request.job_id)

    def _build_vocabulary(self, examples: List[Any], limit: int = 96) -> List[str]:
        counts: Dict[str, int] = {}
        for example in examples:
            for token in self._tokenize(example.input_text):
                counts[token] = counts.get(token, 0) + 1
            for token in self._tokenize(example.target_text):
                counts[token] = counts.get(token, 0) + 1
        ordered = [token for token, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:limit]]
        return ordered or ["<empty>"]

    def _vectorize(self, text: str, vocab: List[str]) -> np.ndarray:
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
                "truthfulness": "preparation-only" if request.execution_kind == "preparation-only" else "local-training-job",
                "runtime": "python-runtime",
                "supports_gradient_training": request.execution_kind != "preparation-only",
                "is_preparation_only": request.execution_kind == "preparation-only",
                "provider": "python-runtime",
                "model_identity": request.base_model_name,
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

    def _persist_job(self, payload: Dict[str, Any]) -> None:
        job_root = self._workspace_root / payload["job_id"]
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

    def _reconcile_orphaned_jobs(self) -> None:
        for payload in self._jobs.values():
            if payload["status"] in {"submitted", "running"} and payload["job_id"] not in self._active_job_ids:
                payload["status"] = "failed"
                payload["updated_at"] = _now_iso()
                payload["completed_at"] = _now_iso()
                payload["diagnostics"].append({
                    "code": "runtime_reconciliation_failed_running_job",
                    "level": "warning",
                    "message": "Marked an orphaned running job as failed during reconciliation.",
                    "detail": "The Python runtime restarted before the local training thread could report completion.",
                })
                self._persist_job(payload)
