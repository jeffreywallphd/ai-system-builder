from __future__ import annotations

import json
from pathlib import Path

from modules.adapters.runtime.python.worker.tasks import model_validation as validation_module
from modules.adapters.runtime.python.worker.tasks.model_validation import validate_model_output


class _FakeSafeTensorReader:
    def __init__(self, tensor_shapes: dict[str, list[int]]):
        self._tensor_shapes = tensor_shapes

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def keys(self):
        return list(self._tensor_shapes.keys())

    def get_tensor(self, key: str):
        class _FakeTensor:
            def __init__(self, shape: list[int]):
                self.shape = shape

        return _FakeTensor(self._tensor_shapes[key])


def _mock_safe_open(monkeypatch, by_file: dict[str, dict[str, list[int]]]) -> None:
    def _safe_open(path: str, framework: str = "pt", device: str = "cpu"):
        return _FakeSafeTensorReader(by_file.get(Path(path).name, {}))

    monkeypatch.setattr(validation_module, "_safe_open_module", lambda: _safe_open)


def test_validate_sharded_safetensors_detects_missing_shard(tmp_path: Path) -> None:
    (tmp_path / "model.safetensors.index.json").write_text(
        json.dumps({"weight_map": {"layer.0": "model-00001-of-00002.safetensors", "layer.1": "model-00002-of-00002.safetensors"}}),
        encoding="utf-8",
    )
    (tmp_path / "model-00001-of-00002.safetensors").write_bytes(b"x")

    result = validate_model_output(tmp_path)

    assert result["status"] == "invalid"
    assert result["shardCount"] == 2


def test_validate_sharded_safetensors_detects_missing_tensor_key(monkeypatch, tmp_path: Path) -> None:
    (tmp_path / "model.safetensors.index.json").write_text(
        json.dumps({"weight_map": {"layer.0": "model-00001-of-00001.safetensors", "layer.1": "model-00001-of-00001.safetensors"}}),
        encoding="utf-8",
    )
    (tmp_path / "model-00001-of-00001.safetensors").write_bytes(b"x")
    (tmp_path / "config.json").write_text("{}", encoding="utf-8")
    _mock_safe_open(monkeypatch, {"model-00001-of-00001.safetensors": {"layer.0": [2, 2]}})

    result = validate_model_output(tmp_path)
    diff = json.loads((tmp_path / "model_validation_diff.json").read_text(encoding="utf-8"))

    assert result["status"] == "invalid"
    assert diff["missingTensorKeys"] == ["model-00001-of-00001.safetensors:layer.1"]


def test_validate_single_safetensors_reads_keys(monkeypatch, tmp_path: Path) -> None:
    (tmp_path / "model.safetensors").write_bytes(b"x")
    (tmp_path / "config.json").write_text("{}", encoding="utf-8")
    _mock_safe_open(monkeypatch, {"model.safetensors": {"decoder.layer.0": [4, 8]}})

    result = validate_model_output(tmp_path)
    diff = json.loads((tmp_path / "model_validation_diff.json").read_text(encoding="utf-8"))

    assert result["status"] in {"valid", "warning"}
    assert diff["tensorCount"] == 1
    assert diff["tensorShapeSummary"]["decoder.layer.0"] == [4, 8]


def test_validate_adapter_partial_output_is_invalid(tmp_path: Path) -> None:
    (tmp_path / "adapter_model.safetensors").write_bytes(b"x")

    result = validate_model_output(tmp_path, expected_lora=True)

    assert result["status"] == "invalid"
    assert any("partial" in error.lower() for error in result["errors"])


def test_validate_detects_recurrent_keys(monkeypatch, tmp_path: Path) -> None:
    (tmp_path / "model.safetensors").write_bytes(b"x")
    (tmp_path / "config.json").write_text("{}", encoding="utf-8")
    _mock_safe_open(monkeypatch, {"model.safetensors": {"decoder.recurrent.weight": [8, 8]}})

    result = validate_model_output(tmp_path, expected_recurrent_additions=True)
    diff = json.loads((tmp_path / "model_validation_diff.json").read_text(encoding="utf-8"))

    assert result["detectedRecurrentAdditions"] is True
    assert diff["detectedRecurrentKeys"] == ["decoder.recurrent.weight"]


def test_validate_detects_lora_tensor_keys(monkeypatch, tmp_path: Path) -> None:
    (tmp_path / "model.safetensors").write_bytes(b"x")
    (tmp_path / "config.json").write_text("{}", encoding="utf-8")
    _mock_safe_open(monkeypatch, {"model.safetensors": {"layers.0.attn.q_proj.lora_A.weight": [8, 4]}})

    result = validate_model_output(tmp_path, expected_lora=True)
    diff = json.loads((tmp_path / "model_validation_diff.json").read_text(encoding="utf-8"))

    assert result["detectedLoRA"] is True
    assert diff["detectedLoRAKeys"] == ["layers.0.attn.q_proj.lora_A.weight"]
