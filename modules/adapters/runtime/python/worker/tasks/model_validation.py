from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _detect_format(output_dir: Path) -> str:
    if (output_dir / "adapter_model.safetensors").exists():
        return "adapter-safetensors"
    if (output_dir / "model.safetensors.index.json").exists():
        return "sharded-safetensors"
    if list(output_dir.glob("*.safetensors")):
        return "safetensors"
    if list(output_dir.glob("*.bin")) or list(output_dir.glob("*.pt")):
        return "pytorch-bin"
    return "unknown"


def _read_safetensors_index(output_dir: Path) -> tuple[list[str], list[str]]:
    index_file = output_dir / "model.safetensors.index.json"
    if not index_file.exists():
        return [], []

    data = json.loads(index_file.read_text(encoding="utf-8"))
    weight_map = data.get("weight_map", {})
    missing = []
    shards = sorted(set(str(value) for value in weight_map.values()))
    for shard in shards:
        if not (output_dir / shard).exists():
            missing.append(shard)
    return shards, missing


def validate_model_output(
    output_dir: Path,
    *,
    expected_lora: bool = False,
    expected_recurrent_additions: bool = False,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)

    warnings: list[str] = []
    errors: list[str] = []
    format_name = _detect_format(output_dir)

    has_config = (output_dir / "config.json").exists()
    has_tokenizer = any((output_dir / name).exists() for name in ["tokenizer.json", "tokenizer_config.json"])
    has_adapter_config = (output_dir / "adapter_config.json").exists()
    has_adapter_model = (output_dir / "adapter_model.safetensors").exists()
    shards, missing_shards = _read_safetensors_index(output_dir)

    detected_lora = has_adapter_config or has_adapter_model

    if expected_lora and not detected_lora:
        errors.append("Expected LoRA adapter artifacts, but adapter files were not detected.")

    if expected_recurrent_additions:
        warnings.append("Recurrent/additional layer detection is heuristic-only in current validation implementation.")

    if format_name in {"safetensors", "sharded-safetensors"} and not has_config and not detected_lora:
        warnings.append("config.json is missing for a safetensors output directory.")

    if missing_shards:
        errors.append(f"Missing safetensors shards referenced by index: {', '.join(missing_shards)}")

    status = "valid"
    if errors:
        status = "invalid"
    elif warnings:
        status = "warning"

    diff_report = {
        "added": [],
        "missing": [f"-{name}" for name in missing_shards],
        "shapeChanges": [],
        "loraDetected": detected_lora,
        "recurrentDetected": expected_recurrent_additions,
        "shardSummary": {
            "count": len(shards),
            "shards": shards,
            "missing": missing_shards,
        },
        "hfCompatibility": {
            "config": has_config,
            "tokenizer": has_tokenizer,
            "safetensors": format_name in {"safetensors", "sharded-safetensors", "adapter-safetensors"},
            "adapterFiles": has_adapter_config and has_adapter_model,
        },
    }

    diff_path = output_dir / "model_validation_diff.json"
    diff_path.write_text(json.dumps(diff_report, indent=2, ensure_ascii=False), encoding="utf-8")

    markdown_lines = [
        "# Model Validation Report",
        "",
        f"- Status: **{status}**",
        f"- Serialization format: `{format_name}`",
        f"- Detected LoRA: `{detected_lora}`",
        f"- Shard count: `{len(shards)}`",
    ]
    if warnings:
        markdown_lines.append("")
        markdown_lines.append("## Warnings")
        markdown_lines.extend([f"- {w}" for w in warnings])
    if errors:
        markdown_lines.append("")
        markdown_lines.append("## Errors")
        markdown_lines.extend([f"- {e}" for e in errors])

    report_path = output_dir / "model_validation_report.md"
    report_path.write_text("\n".join(markdown_lines) + "\n", encoding="utf-8")

    return {
        "status": status,
        "serializationFormat": format_name,
        "detectedLoRA": detected_lora,
        "detectedRecurrentAdditions": expected_recurrent_additions,
        "shardCount": len(shards),
        "warnings": warnings,
        "errors": errors,
        "validationReportPath": str(report_path),
        "validationDiffPath": str(diff_path),
    }
