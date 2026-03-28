import os
import time

from fastapi.testclient import TestClient

from app.api.dependencies import get_dataset_generation_service, get_model_training_service
from app.main import app
from app.services.dataset_generation_service import DatasetGenerationService
from app.services import model_training_service
from app.services.model_training_service import ModelTrainingService, _now_iso


client = TestClient(app)


def create_training_payload(
    execution_kind: str = "local-gradient-training",
    backend: str = "python-runtime-local",
    dataset_task_type: str = "question_answering",
) -> dict:
    return {
        "job_id": "job-1",
        "job_name": "Support tune",
        "execution_kind": execution_kind,
        "backend": backend,
        "base_model_id": "base-1",
        "base_model_name": "Base One",
        "base_model_location": "/tmp/base-one.gguf",
        "dataset_id": "dataset-1",
        "dataset_name": "Support QA",
        "dataset_version_id": "version-1",
        "dataset_version_number": 1,
        "dataset_task_type": dataset_task_type,
        "created_by": "tester",
        "examples": [
            {
                "id": "example-1",
                "task_type": dataset_task_type,
                "input_text": "Question: What is AI Loom Studio? Context: AI Loom Studio keeps datasets durable.",
                "target_text": "It is a workflow studio with durable datasets.",
            }
        ],
        "configuration": {"epochs": 2, "learning_rate": 0.05, "batch_size": 1},
    }


def test_local_training_job_lifecycle(tmp_path) -> None:
    service = ModelTrainingService(workspace_root=tmp_path)
    app.dependency_overrides[get_model_training_service] = lambda: service
    response = client.post("/training/jobs", json=create_training_payload())

    assert response.status_code == 200
    submitted_payload = response.json()
    assert submitted_payload["status"] == "submitted"
    assert submitted_payload["provenance"]["truthfulness"] == "real-execution"

    observed_statuses = {submitted_payload["status"]}
    for _ in range(60):
        polled = client.post("/training/jobs/job-1/refresh")
        assert polled.status_code == 200
        payload = polled.json()
        observed_statuses.add(payload["status"])
        if payload["status"] == "completed":
            assert any(artifact["kind"] == "trained-model" for artifact in payload["artifacts"])
            assert any(artifact["kind"] == "metrics" for artifact in payload["artifacts"])
            assert any(artifact["kind"] == "log" for artifact in payload["artifacts"])
            assert payload["checkpoints"]
            assert payload["progress"]["current_step"] == payload["progress"]["total_steps"]
            break
        time.sleep(0.05)
    else:
        raise AssertionError("training job did not complete in time")

    assert "queued" in observed_statuses or "running" in observed_statuses
    app.dependency_overrides.clear()


def test_preparation_job_is_not_reported_as_completed_training(tmp_path) -> None:
    service = ModelTrainingService(workspace_root=tmp_path)
    app.dependency_overrides[get_model_training_service] = lambda: service
    response = client.post("/training/jobs", json=create_training_payload("preparation-only", "python-runtime-manifest"))

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "exported-without-training"
    assert payload["provenance"]["truthfulness"] == "exported-without-training"
    assert payload["provenance"]["supports_gradient_training"] is False
    assert any(artifact["kind"] == "prepared-bundle" for artifact in payload["artifacts"])

    app.dependency_overrides.clear()


def test_training_failure_persists_diagnostic_artifact(tmp_path) -> None:
    service = ModelTrainingService(workspace_root=tmp_path)
    original_vectorize = service._vectorize

    def broken_vectorize(text: str, vocab: list[str]):  # type: ignore[override]
        if "Question:" in text:
            raise RuntimeError("forced failure for test")
        return original_vectorize(text, vocab)

    service._vectorize = broken_vectorize  # type: ignore[assignment]
    app.dependency_overrides[get_model_training_service] = lambda: service
    response = client.post("/training/jobs", json=create_training_payload())
    assert response.status_code == 200

    for _ in range(60):
        polled = client.post("/training/jobs/job-1/refresh")
        payload = polled.json()
        if payload["status"] in {"failed", "partially-completed"}:
            assert any(artifact["kind"] == "diagnostic" for artifact in payload["artifacts"])
            assert any(diagnostic["code"] == "local_training_failed" for diagnostic in payload["diagnostics"])
            break
        time.sleep(0.05)
    else:
        raise AssertionError("training job did not reach failed state")

    app.dependency_overrides.clear()


def test_local_training_reports_numpy_import_incompatibility_without_crashing_runtime(tmp_path, monkeypatch) -> None:
    service = ModelTrainingService(workspace_root=tmp_path)
    app.dependency_overrides[get_model_training_service] = lambda: service

    def fail_numpy_import():
        raise ValueError("Local gradient training is unavailable because NumPy could not be initialized on this host.")

    monkeypatch.setattr(model_training_service, "_require_numpy", fail_numpy_import)

    response = client.post("/training/jobs", json=create_training_payload())
    assert response.status_code == 200

    terminal = None
    for _ in range(60):
        polled = client.post("/training/jobs/job-1/refresh")
        payload = polled.json()
        if payload["status"] in {"failed", "partially-completed"}:
            terminal = payload
            break
        time.sleep(0.05)

    assert terminal is not None
    assert any(diagnostic["code"] == "local_training_failed" for diagnostic in terminal["diagnostics"])
    assert any("NumPy" in (diagnostic.get("detail") or "") for diagnostic in terminal["diagnostics"])
    health = client.get("/health")
    assert health.status_code == 200

    app.dependency_overrides.clear()


def test_refresh_reconcile_marks_orphaned_job_truthfully(tmp_path) -> None:
    service = ModelTrainingService(workspace_root=tmp_path)
    request = service._base_job_payload(  # type: ignore[attr-defined]
        type(
            "Request",
            (),
            {
                "job_id": "orphan-job",
                "job_name": "Orphan job",
                "backend": "python-runtime-local",
                "execution_kind": "local-gradient-training",
                "base_model_id": "base-1",
                "base_model_name": "Base One",
                "dataset_id": "dataset-1",
                "dataset_version_id": "version-1",
                "created_by": "tester",
                "configuration": type("Config", (), {"model_dump": lambda self: {"epochs": 1, "learning_rate": 0.1, "batch_size": 1}})(),
            },
        )(),
        status="running",
        created_at=_now_iso(),
    )
    request["submitted_at"] = _now_iso()
    request["started_at"] = _now_iso()
    service._jobs["orphan-job"] = request  # type: ignore[attr-defined]
    service._persist_job(request)  # type: ignore[attr-defined]

    app.dependency_overrides[get_model_training_service] = lambda: service
    response = client.post("/training/jobs/orphan-job/reconcile")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "reconciliation-needed"
    assert any(diagnostic["code"].startswith("runtime_reconciliation_needed") for diagnostic in payload["diagnostics"])
    app.dependency_overrides.clear()


def test_dataset_generation_route_returns_provider_model_backed_provenance(monkeypatch) -> None:
    os.environ["AI_LOOM_OPENAI_API_KEY"] = "test-key"
    os.environ["AI_LOOM_OPENAI_MODEL"] = "test-model"

    class ProviderService(DatasetGenerationService):
        def _call_openai_compatible(self, **_: str):  # type: ignore[override]
            return {
                "question": "What keeps AI Loom Studio truthful?",
                "answer": "It records durable provenance and truthful runtime state.",
                "context": "AI Loom Studio keeps workflows and datasets durable for auditability.",
            }

    app.dependency_overrides[get_dataset_generation_service] = lambda: ProviderService()

    response = client.post(
        "/datasets/generate",
        json={
            "dataset_id": "dataset-1",
            "version_id": "version-1",
            "task_type": "question_answering",
            "created_by": "tester",
            "source_documents": [
                {
                    "id": "doc-1",
                    "name": "Doc",
                    "content": "AI Loom Studio keeps workflows and datasets durable for auditability.",
                    "segments": [],
                }
            ],
            "existing_examples": [],
            "configuration": {"strategy": "provider-preferred", "max_segments_per_source": 2},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["generated_count"] >= 1
    assert payload["provenance"]["mode"] == "provider-model-backed"
    assert payload["provenance"]["provider"] == "openai-compatible"
    assert payload["provenance"]["model_id"] == "test-model"
    assert payload["provenance"]["is_fallback"] is False

    app.dependency_overrides.clear()
    monkeypatch.delenv("AI_LOOM_OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("AI_LOOM_OPENAI_MODEL", raising=False)


def test_dataset_generation_route_falls_back_to_python_runtime_local_when_provider_missing() -> None:
    response = client.post(
        "/datasets/generate",
        json={
            "dataset_id": "dataset-1",
            "version_id": "version-1",
            "task_type": "question_answering",
            "created_by": "tester",
            "source_documents": [
                {
                    "id": "doc-1",
                    "name": "Doc",
                    "content": "AI Loom Studio keeps workflows and datasets durable for auditability.",
                    "segments": [],
                }
            ],
            "existing_examples": [],
            "configuration": {"strategy": "provider-preferred", "max_segments_per_source": 2},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["generated_count"] >= 1
    assert payload["provenance"]["mode"] == "python-runtime-local"
    assert payload["provenance"]["status"] == "degraded"
    assert payload["provenance"]["fallback"]["from_mode"] == "provider-model-backed"
    assert payload["provenance"]["is_fallback"] is True
