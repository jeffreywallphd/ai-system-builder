from __future__ import annotations

import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..models import TrainModelTaskRequest, TrainModelTaskResult
from .model_serialization import DEFAULT_MAX_SHARD_SIZE, save_adapter_pretrained, save_full_model_pretrained, write_serialization_manifest
from .model_validation import validate_model_output

SUPPORTED_METHODS = {"lora", "qlora", "full-finetune"}
SUPPORTED_DATASET_FORMATS = {"jsonl", "json", "csv", "parquet"}


def _require_non_empty(value: str | None, field: str) -> str:
    if value is None or value.strip() == "":
        raise ValueError(f"{field} is required.")
    return value.strip()


def _to_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _parse_max_shard_size(payload: TrainModelTaskRequest) -> str:
    output = _to_dict(payload.output)
    raw = output.get("maxShardSize")
    return str(raw).strip() if isinstance(raw, str) and raw.strip() else DEFAULT_MAX_SHARD_SIZE


def _dataset_path(dataset: Any) -> Path:
    if dataset.path is None:
        raise ValueError(f"Dataset '{dataset.artifactId}' is missing path; runtime storage binding must provide a local dataset path.")
    return Path(dataset.path)


def _infer_dataset_format(dataset: Any, path: Path) -> str:
    if dataset.format and dataset.format.strip():
        fmt = dataset.format.strip().lower()
    else:
        ext = path.suffix.lower().lstrip(".")
        fmt = "jsonl" if ext == "jsonl" else ext
    if fmt not in SUPPORTED_DATASET_FORMATS:
        raise ValueError(f"Unsupported dataset format '{fmt}'. Supported formats: {', '.join(sorted(SUPPORTED_DATASET_FORMATS))}.")
    return fmt


def _load_dataset(payload: TrainModelTaskRequest) -> tuple[Any, Any]:
    try:
        from datasets import load_dataset
    except Exception as error:  # pragma: no cover - dependency failure
        raise RuntimeError("datasets is required for model training dataset loading.") from error

    train_files: list[str] = []
    validation_files: list[str] = []
    dataset_format: str | None = None

    for dataset in payload.datasets:
        _require_non_empty(dataset.artifactId, "datasets[].artifactId")
        path = _dataset_path(dataset)
        if not path.exists():
            raise ValueError(f"Dataset path does not exist: {path}")
        fmt = _infer_dataset_format(dataset, path)
        dataset_format = dataset_format or fmt
        if dataset_format != fmt:
            raise ValueError("All training dataset files must use the same format in this runtime implementation.")
        if dataset.splitRole == "validation":
            validation_files.append(str(path))
        else:
            train_files.append(str(path))

    if not train_files:
        raise ValueError("At least one train split dataset is required.")

    dataset_dict = {"train": train_files}
    if validation_files:
        dataset_dict["validation"] = validation_files

    loaded = load_dataset(dataset_format, data_files=dataset_dict)
    if len(loaded["train"]) == 0:
        raise ValueError("Training dataset is empty; refusing to train.")
    return loaded, loaded["validation"] if "validation" in loaded else None


def _resolve_base_model(payload: TrainModelTaskRequest) -> str:
    if payload.baseModel.localPath and payload.baseModel.localPath.strip():
        return payload.baseModel.localPath.strip()
    if payload.baseModel.modelId and payload.baseModel.modelId.strip():
        return payload.baseModel.modelId.strip()
    raise ValueError("baseModel must include modelId or localPath for Python-side training.")


def _load_transformers_objects(base_model_ref: str, method: str, quantization: dict[str, Any]) -> tuple[Any, Any]:
    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except Exception as error:  # pragma: no cover
        raise RuntimeError("transformers is required for model training.") from error

    model_kwargs: dict[str, Any] = {}
    if method == "qlora":
        try:
            import torch
            import bitsandbytes  # noqa: F401
            from transformers import BitsAndBytesConfig
        except Exception as error:
            raise RuntimeError("QLoRA requires bitsandbytes + torch CUDA support in the Python runtime.") from error

        if not torch.cuda.is_available():
            raise RuntimeError("QLoRA requires CUDA GPU support; torch.cuda.is_available() is false.")

        model_kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=bool(quantization.get("loadIn4Bit", True)),
            load_in_8bit=bool(quantization.get("loadIn8Bit", False)),
            bnb_4bit_quant_type=str(quantization.get("bnb4BitQuantType", "nf4")),
            bnb_4bit_compute_dtype=getattr(__import__("torch"), str(quantization.get("bnb4BitComputeDtype", "float16"))),
        )
        model_kwargs["device_map"] = "auto"

    tokenizer = AutoTokenizer.from_pretrained(base_model_ref, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(base_model_ref, **model_kwargs)
    return model, tokenizer


def _tokenize_dataset(dataset: Any, tokenizer: Any, max_sequence_length: int | None) -> Any:
    block_size = max_sequence_length or 512

    text_column = "text"
    if text_column not in dataset["train"].column_names:
        # fallback for common instruction datasets
        for candidate in ["prompt", "input", "completion", "output"]:
            if candidate in dataset["train"].column_names:
                text_column = candidate
                break

    def tokenize(batch: dict[str, list[Any]]) -> dict[str, Any]:
        texts = [str(item) for item in batch.get(text_column, [])]
        encoded = tokenizer(texts, truncation=True, padding="max_length", max_length=block_size)
        encoded["labels"] = list(encoded["input_ids"])
        return encoded

    return dataset.map(tokenize, batched=True, remove_columns=dataset["train"].column_names)


def _build_training_args(payload: TrainModelTaskRequest, output_dir: Path) -> Any:
    try:
        from transformers import TrainingArguments
    except Exception as error:  # pragma: no cover
        raise RuntimeError("transformers is required for TrainingArguments.") from error

    common = _to_dict(payload.commonParameters)
    advanced = _to_dict(payload.advancedParameters)
    return TrainingArguments(
        output_dir=str(output_dir / "checkpoints"),
        num_train_epochs=float(common.get("numEpochs", 1)),
        max_steps=int(common.get("maxSteps", -1)),
        per_device_train_batch_size=int(common.get("batchSize", 1)),
        per_device_eval_batch_size=int(common.get("batchSize", 1)),
        learning_rate=float(common.get("learningRate", 5e-5)),
        weight_decay=float(common.get("weightDecay", 0.0)),
        gradient_accumulation_steps=int(advanced.get("gradientAccumulationSteps", 1)),
        warmup_steps=int(advanced.get("warmupSteps", 0)),
        warmup_ratio=float(advanced.get("warmupRatio", 0.0)),
        save_steps=int(advanced.get("checkpointIntervalSteps", 50)),
        eval_steps=int(advanced.get("evalIntervalSteps", 0)) if int(advanced.get("evalIntervalSteps", 0)) > 0 else None,
        logging_steps=10,
        save_total_limit=int(advanced.get("saveTotalLimit", 2)),
        bf16=advanced.get("mixedPrecision") == "bf16",
        fp16=advanced.get("mixedPrecision") == "fp16",
        gradient_checkpointing=bool(advanced.get("gradientCheckpointing", False)),
        report_to=[],
        remove_unused_columns=False,
    )


def _apply_lora(model: Any, payload: TrainModelTaskRequest) -> Any:
    try:
        from peft import LoraConfig, TaskType, get_peft_model
    except Exception as error:  # pragma: no cover
        raise RuntimeError("peft is required for LoRA/QLoRA training.") from error

    advanced = _to_dict(payload.advancedParameters)
    lora = _to_dict(advanced.get("lora"))
    target_modules = lora.get("targetModules") if isinstance(lora.get("targetModules"), list) else ["q_proj", "v_proj"]

    lora_config = LoraConfig(
        r=int(lora.get("rank", 16)),
        lora_alpha=int(lora.get("alpha", 32)),
        lora_dropout=float(lora.get("dropout", 0.05)),
        target_modules=target_modules,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
    )
    return get_peft_model(model, lora_config)


def _run_trainer(model: Any, tokenizer: Any, dataset: Any, eval_dataset: Any | None, args: Any) -> tuple[dict[str, float], list[dict[str, Any]]]:
    try:
        from transformers import DataCollatorForLanguageModeling, Trainer
    except Exception as error:  # pragma: no cover
        raise RuntimeError("transformers Trainer is required for training.") from error

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=dataset["train"],
        eval_dataset=eval_dataset,
        tokenizer=tokenizer,
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
    )
    train_result = trainer.train()
    metrics: dict[str, float] = {k: float(v) for k, v in train_result.metrics.items() if isinstance(v, (int, float))}

    checkpoints = []
    for state in trainer.state.log_history:
        if "loss" in state and "step" in state:
            checkpoints.append({"path": str(args.output_dir), "step": int(state["step"]), "metric": "loss", "value": float(state["loss"])})
    return metrics, checkpoints


def _write_run_metadata(output_path: Path, metadata: dict[str, Any]) -> str:
    run_metadata_path = output_path / "training-run.json"
    run_metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(run_metadata_path)


def train_model(payload: TrainModelTaskRequest) -> TrainModelTaskResult:
    _require_non_empty(payload.output.get("outputModelName"), "output.outputModelName")

    if payload.method not in SUPPORTED_METHODS:
        raise ValueError(f"Training method '{payload.method}' is not supported. Supported methods: {', '.join(sorted(SUPPORTED_METHODS))}")

    run_id = f"train-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    output_model_name = payload.output.get("outputModelName")
    output_directory = payload.output.get("outputDirectory") or tempfile.mkdtemp(prefix=f"{output_model_name}-")

    output_path = Path(output_directory)
    output_path.mkdir(parents=True, exist_ok=True)

    warnings: list[str] = []
    logs: list[str] = []

    try:
        dataset, eval_dataset = _load_dataset(payload)
        base_model_ref = _resolve_base_model(payload)

        advanced = _to_dict(payload.advancedParameters)
        quantization = _to_dict(advanced.get("quantization"))
        model, tokenizer = _load_transformers_objects(base_model_ref, payload.method, quantization)

        tokenized = _tokenize_dataset(dataset, tokenizer, _to_dict(payload.commonParameters).get("maxSequenceLength"))
        tokenized_eval = tokenized["validation"] if "validation" in tokenized else None

        if payload.method in {"lora", "qlora"}:
            model = _apply_lora(model, payload)
            logs.append(f"Applied {payload.method.upper()} adapter config.")

        train_args = _build_training_args(payload, output_path)
        metrics, checkpoints = _run_trainer(model, tokenizer, tokenized, tokenized_eval, train_args)

        max_shard_size = _parse_max_shard_size(payload)
        if payload.method in {"lora", "qlora"}:
            serialization = save_adapter_pretrained(model, tokenizer, output_path)
            artifact_form = "adapter"
        else:
            serialization = save_full_model_pretrained(model, tokenizer, output_path, max_shard_size=max_shard_size)
            artifact_form = "full-model"

        validation_config = _to_dict(payload.validation)
        validation = validate_model_output(
            output_path,
            expected_lora=bool(validation_config.get("expectedLoRA", payload.method in {"lora", "qlora"})),
            expected_recurrent_additions=bool(validation_config.get("expectedRecurrentAdditions", False)),
        )

        manifest_path = write_serialization_manifest(output_path, {
            "runId": run_id,
            "method": payload.method,
            "serialization": serialization,
            "validation": validation,
        })

        run_metadata_path = _write_run_metadata(
            output_path,
            {
                "runId": run_id,
                "method": payload.method,
                "baseModel": payload.baseModel.model_dump(mode="json"),
                "datasets": [dataset_entry.model_dump(mode="json") for dataset_entry in payload.datasets],
                "startedAt": datetime.now(timezone.utc).isoformat(),
                "status": "succeeded",
                "serializationManifestPath": manifest_path,
            },
        )

        generated_model_path = str(output_path)
        model_id = payload.baseModel.modelId

        if validation["status"] == "invalid":
            warnings.append("Training completed, but output validation failed.")

        metadata = {
            "runtimeTask": "train-model",
            "runMetadataPath": run_metadata_path,
            "validation": validation,
            "serialization": serialization,
        }

        return TrainModelTaskResult(
            runId=run_id,
            status="succeeded",
            outputDirectory=str(output_path),
            outputModelName=output_model_name,
            logs=logs,
            warnings=warnings + validation.get("warnings", []),
            checkpoints=checkpoints,
            metrics=metrics,
            validationReportPath=validation.get("validationReportPath"),
            generatedModelCandidate={
                "displayName": output_model_name,
                "provider": "unknown",
                "modelId": None,
                "localPath": generated_model_path,
                "artifactForm": artifact_form,
                "inferenceMode": payload.baseModel.inferenceMode,
                "baseModelId": model_id,
                "adapterOfModelId": model_id if artifact_form == "adapter" else None,
                "generatedFromRunId": run_id,
                "serializationFormat": validation.get("serializationFormat") or serialization.get("serializationFormat"),
                "metadata": metadata,
            },
        )
    except Exception as error:
        return TrainModelTaskResult(
            runId=run_id,
            status="failed",
            outputDirectory=str(output_path),
            outputModelName=output_model_name,
            logs=logs,
            warnings=warnings,
            error={
                "code": "training_failed",
                "message": str(error),
                "details": {
                    "method": payload.method,
                },
            },
        )
