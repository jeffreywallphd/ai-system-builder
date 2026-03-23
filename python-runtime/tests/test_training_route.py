import os
import time

from fastapi.testclient import TestClient

from app.api.dependencies import get_dataset_generation_service, get_model_training_service
from app.main import app
from app.services.dataset_generation_service import DatasetGenerationService
from app.services.model_training_service import ModelTrainingService


client = TestClient(app)


def create_training_payload(execution_kind: str = "local-gradient-training", backend: str = "python-runtime-local") -> dict:
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
        "dataset_task_type": "question_answering",
        "created_by": "tester",
        "examples": [
            {
                "id": "example-1",
                "task_type": "question_answering",
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
    assert submitted_payload["provenance"]["truthfulness"] == "local-training-job"

    for _ in range(40):
        polled = client.get("/training/jobs/job-1")
        assert polled.status_code == 200
        payload = polled.json()
        if payload["status"] == "completed":
            assert payload["artifacts"]
            assert any(artifact["kind"] == "trained-model" for artifact in payload["artifacts"])
            assert payload["checkpoints"]
            break
        time.sleep(0.05)
    else:
        raise AssertionError("training job did not complete in time")

    app.dependency_overrides.clear()


def test_preparation_job_is_not_reported_as_completed_training(tmp_path) -> None:
    service = ModelTrainingService(workspace_root=tmp_path)
    app.dependency_overrides[get_model_training_service] = lambda: service
    response = client.post("/training/jobs", json=create_training_payload("preparation-only", "python-runtime-manifest"))

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "prepared"
    assert payload["provenance"]["truthfulness"] == "preparation-only"
    assert payload["provenance"]["supports_gradient_training"] is False

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

    app.dependency_overrides.clear()
    monkeypatch.delenv("AI_LOOM_OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("AI_LOOM_OPENAI_MODEL", raising=False)


def test_dataset_generation_route_falls_back_to_runtime_local_when_provider_missing() -> None:
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
    assert payload["provenance"]["mode"] == "runtime-local-deterministic"
    assert payload["provenance"]["fallback"]["from_mode"] == "provider-model-backed"
