from __future__ import annotations

import json
from pathlib import Path

from modules.adapters.runtime.python.worker.tasks.model_validation import validate_model_output


def test_validate_sharded_safetensors_detects_missing_shard(tmp_path: Path) -> None:
    (tmp_path / "model.safetensors.index.json").write_text(
        json.dumps({"weight_map": {"layer.0": "model-00001-of-00002.safetensors", "layer.1": "model-00002-of-00002.safetensors"}}),
        encoding="utf-8",
    )
    (tmp_path / "model-00001-of-00002.safetensors").write_bytes(b"x")

    result = validate_model_output(tmp_path)

    assert result["status"] == "invalid"
    assert result["shardCount"] == 2
    assert (tmp_path / "model_validation_report.md").exists()
    assert (tmp_path / "model_validation_diff.json").exists()


def test_validate_adapter_detects_lora(tmp_path: Path) -> None:
    (tmp_path / "adapter_model.safetensors").write_bytes(b"x")
    (tmp_path / "adapter_config.json").write_text("{}", encoding="utf-8")

    result = validate_model_output(tmp_path, expected_lora=True)

    assert result["detectedLoRA"] is True
    assert result["status"] in {"valid", "warning"}
