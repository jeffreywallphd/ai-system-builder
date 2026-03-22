from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_fine_tune_route_returns_truthful_job_payload() -> None:
    response = client.post(
        "/training/fine-tune",
        json={
            "job_id": "job-1",
            "job_name": "Support tune",
            "backend": "python-runtime-manifest",
            "base_model_id": "base-1",
            "base_model_name": "Base One",
            "dataset_id": "dataset-1",
            "dataset_name": "Support QA",
            "dataset_version_id": "version-1",
            "dataset_version_number": 1,
            "created_by": "tester",
            "configuration": {"epochs": 2, "learning_rate": 0.0001, "batch_size": 1},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["artifacts"]
    assert payload["checkpoints"]


def test_dataset_generation_route_returns_provider_backed_provenance() -> None:
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
            "configuration": {"strategy": "provider-backed-default", "max_segments_per_source": 2},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["generated_count"] >= 1
    assert payload["provenance"]["mode"] == "provider-backed"
    assert payload["provenance"]["provider"] == "python-runtime"
