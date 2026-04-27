from __future__ import annotations

import pytest

from modules.adapters.runtime.python.worker.models import TrainModelTaskRequest
from modules.adapters.runtime.python.worker.tasks.train_model import train_model


def _request(method: str = "lora") -> TrainModelTaskRequest:
    return TrainModelTaskRequest.model_validate(
        {
            "baseModel": {"modelRecordId": "base-1", "modelId": "org/base"},
            "datasets": [{"artifactId": "dataset-1", "splitRole": "train"}],
            "method": method,
            "commonParameters": {"numEpochs": 1},
            "output": {"outputModelName": "demo-adapter"},
        }
    )


def test_train_model_validates_required_inputs() -> None:
    payload = _request()
    payload.datasets = []

    with pytest.raises(ValueError, match="at least one dataset"):
        train_model(payload)


def test_train_model_rejects_unsupported_method() -> None:
    payload = _request(method="qlora")

    with pytest.raises(ValueError, match="not supported"):
        train_model(payload)


def test_train_model_returns_structured_skeleton_result() -> None:
    result = train_model(_request())

    assert result.status == "succeeded"
    assert result.runId.startswith("train-")
    assert result.generatedModelCandidate is not None
    assert result.generatedModelCandidate["metadata"]["skeleton"] is True
