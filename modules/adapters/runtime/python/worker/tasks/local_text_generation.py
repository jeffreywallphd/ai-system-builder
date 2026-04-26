from __future__ import annotations

from dataclasses import dataclass
import gc
import inspect
from os import environ, getenv
from pathlib import Path
from threading import Lock
from typing import Any

from ..models import ExampleGenerationConfig, LocalModelConfig

DEFAULT_MAX_NEW_TOKENS = 256


def configure_huggingface_download_environment() -> None:
    environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")


@dataclass
class GenerationModelAvailability:
    provider: str
    model_id: str
    downloaded: bool
    from_cache: bool
    local_path: str | None = None


class LocalTextGenerator:
    def generate_text(self, prompt: str) -> str:
        raise NotImplementedError


class TransformersText2TextGenerator(LocalTextGenerator):
    def __init__(self, model_config: LocalModelConfig, generation_params: dict[str, Any]):
        self._generation_params = generation_params
        self._pipeline = self._build_pipeline(model_config)

    @staticmethod
    def _build_pipeline(model_config: LocalModelConfig):
        configure_huggingface_download_environment()
        try:
            from transformers import pipeline
        except ImportError as error:
            raise RuntimeError(
                "The 'transformers' package is required for recipe generation with provider='transformers'."
            ) from error

        resolved_model_reference = _RESOLVED_MODEL_REFERENCES.get(model_config.modelId, model_config.modelId)
        return pipeline(
            "text2text-generation",
            model=resolved_model_reference,
            tokenizer=resolved_model_reference,
            model_kwargs=_resolve_model_kwargs(model_config) or None,
        )

    def generate_text(self, prompt: str) -> str:
        generation = self._pipeline(prompt, **dict(self._generation_params))
        text = _extract_pipeline_text(generation)
        if not text:
            raise RuntimeError("Text2text generation returned no text.")
        return text


class TransformersCausalGenerator(LocalTextGenerator):
    def __init__(self, model_config: LocalModelConfig, generation_params: dict[str, Any]):
        self._generation_params = generation_params
        self._tokenizer, self._model = self._load_model(model_config)

    @staticmethod
    def _load_model(model_config: LocalModelConfig):
        configure_huggingface_download_environment()
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError as error:
            raise RuntimeError(
                "The 'transformers' package is required for recipe generation with provider='transformers'."
            ) from error

        resolved_model_reference = _RESOLVED_MODEL_REFERENCES.get(model_config.modelId, model_config.modelId)
        model_kwargs = _resolve_model_kwargs(model_config)
        tokenizer = AutoTokenizer.from_pretrained(resolved_model_reference)
        model = AutoModelForCausalLM.from_pretrained(resolved_model_reference, **model_kwargs)

        if getattr(tokenizer, "pad_token_id", None) is None:
            tokenizer.pad_token_id = getattr(tokenizer, "eos_token_id", None)

        if model_config.device in {"cpu", "cuda"} and _supports_manual_device_move(model):
            model = model.to(model_config.device)

        return tokenizer, model

    def _generate_new_tokens_text(self, input_ids: Any, generation_inputs: dict[str, Any]) -> str:
        generation_params = _resolve_runtime_generation_params(
            self._generation_params,
            self._tokenizer,
        )
        generation_params = _filter_supported_generation_params(generation_params, self._model.generate)
        generation_output = self._model.generate(**generation_inputs, **generation_params)

        first_output = generation_output[0]
        prompt_length = input_ids.shape[-1]
        generated_ids = first_output[prompt_length:]

        text = self._tokenizer.decode(generated_ids, skip_special_tokens=True).strip()
        if not text:
            raise RuntimeError("Causal generation returned no new tokens.")
        return text

    def generate_text(self, prompt: str) -> str:
        tokenized = self._tokenizer(prompt, return_tensors="pt")
        input_ids = tokenized["input_ids"]
        generation_inputs = _move_tokenized_inputs_to_model_device(tokenized, self._model)
        return self._generate_new_tokens_text(input_ids, generation_inputs)


class TransformersChatGenerator(TransformersCausalGenerator):
    def generate_text(self, prompt: str) -> str:
        apply_chat_template = getattr(self._tokenizer, "apply_chat_template", None)
        if not callable(apply_chat_template):
            raise RuntimeError(
                "Chat inference mode requires a tokenizer with apply_chat_template support."
            )

        messages = [{"role": "user", "content": prompt}]
        try:
            templated = apply_chat_template(
                messages,
                tokenize=True,
                add_generation_prompt=True,
                return_tensors="pt",
                return_dict=True,
            )
        except TypeError:
            templated = apply_chat_template(
                messages,
                tokenize=True,
                add_generation_prompt=True,
                return_tensors="pt",
            )

        if isinstance(templated, dict):
            input_ids = templated["input_ids"]
            generation_inputs = _move_tokenized_inputs_to_model_device(templated, self._model)
        else:
            input_ids = templated
            generation_inputs = {"input_ids": templated}
            generation_inputs = _move_tokenized_inputs_to_model_device(generation_inputs, self._model)

        return self._generate_new_tokens_text(input_ids, generation_inputs)


def ensure_generation_model_downloaded(model_config: LocalModelConfig) -> GenerationModelAvailability:
    if model_config.provider != "transformers":
        raise ValueError(f"Unsupported generation model provider: {model_config.provider}")

    configure_huggingface_download_environment()

    try:
        from huggingface_hub import snapshot_download
    except ImportError as error:
        raise RuntimeError(
            "The 'huggingface_hub' package is required to validate and download generation models."
        ) from error

    cached_reference = _find_cached_model_reference(model_config.modelId)
    if cached_reference is not None:
        resolved_path = str(cached_reference)
        _RESOLVED_MODEL_REFERENCES[model_config.modelId] = resolved_path
        return GenerationModelAvailability(
            provider=model_config.provider,
            model_id=model_config.modelId,
            downloaded=False,
            from_cache=True,
            local_path=resolved_path,
        )

    try:
        print(
            f"Checking local Hugging Face cache for generation model {model_config.modelId}.",
            flush=True,
        )
        local_path = snapshot_download(
            repo_id=model_config.modelId,
            local_files_only=True,
        )
        _RESOLVED_MODEL_REFERENCES[model_config.modelId] = local_path
        return GenerationModelAvailability(
            provider=model_config.provider,
            model_id=model_config.modelId,
            downloaded=False,
            from_cache=True,
            local_path=local_path,
        )
    except Exception:
        pass

    try:
        print(
            f"Downloading generation model {model_config.modelId} from Hugging Face.",
            flush=True,
        )
        local_path = snapshot_download(
            repo_id=model_config.modelId,
            local_files_only=False,
        )
        print(
            f"Finished downloading generation model {model_config.modelId}.",
            flush=True,
        )
        _RESOLVED_MODEL_REFERENCES[model_config.modelId] = local_path
        return GenerationModelAvailability(
            provider=model_config.provider,
            model_id=model_config.modelId,
            downloaded=True,
            from_cache=False,
            local_path=local_path,
        )
    except Exception as error:
        raise RuntimeError(
            (
                f"Generation model '{model_config.modelId}' is not available in the local Hugging Face cache. "
                "Automatic download failed. Verify network access and Hugging Face authentication/token configuration."
            )
        ) from error


def ensure_generation_model_is_available(config: ExampleGenerationConfig) -> GenerationModelAvailability:
    return ensure_generation_model_downloaded(config.model)


_GENERATOR_CACHE: dict[tuple[str, str, str, str, str], LocalTextGenerator] = {}
_GENERATOR_CACHE_LOCK = Lock()
_RESOLVED_MODEL_REFERENCES: dict[str, str] = {}


def _candidate_huggingface_cache_roots() -> list[Path]:
    candidates: list[Path] = []
    for environment_variable in (
        "HF_HUB_CACHE",
        "HUGGINGFACE_HUB_CACHE",
        "TRANSFORMERS_CACHE",
    ):
        configured = getenv(environment_variable)
        if configured:
            candidates.append(Path(configured))

    hf_home = getenv("HF_HOME")
    if hf_home:
        hf_home_path = Path(hf_home)
        candidates.extend([hf_home_path / "hub", hf_home_path / "models"])

    home = Path.home()
    candidates.extend(
        [
            home / ".cache" / "huggingface" / "hub",
            home / ".cache" / "huggingface" / "models",
        ]
    )
    return candidates


def _find_cached_model_reference(model_id: str) -> Path | None:
    normalized_repo_id = model_id.replace("/", "--")
    repo_folder_name = f"models--{normalized_repo_id}"
    for cache_root in _candidate_huggingface_cache_roots():
        repo_root = cache_root / repo_folder_name
        if not repo_root.exists():
            continue

        snapshots_dir = repo_root / "snapshots"
        if snapshots_dir.exists():
            snapshot_directories = sorted(
                (path for path in snapshots_dir.iterdir() if path.is_dir()),
                key=lambda path: path.stat().st_mtime,
                reverse=True,
            )
            for snapshot_path in snapshot_directories:
                if any(snapshot_path.rglob("*.safetensors")):
                    return snapshot_path

        if any(repo_root.rglob("*.safetensors")):
            return repo_root

    return None


def _generator_cache_key(model: LocalModelConfig) -> tuple[str, str, str, str, str]:
    return (
        model.provider,
        model.modelId,
        model.inferenceMode,
        model.device or "auto",
        model.torchDtype or "auto",
    )


def _resolve_generation_params(config: ExampleGenerationConfig) -> dict[str, Any]:
    params: dict[str, Any] = {}
    if config.generationParams is None:
        params["max_new_tokens"] = DEFAULT_MAX_NEW_TOKENS
        return params

    if config.generationParams.maxNewTokens is not None:
        params["max_new_tokens"] = config.generationParams.maxNewTokens
    else:
        params["max_new_tokens"] = DEFAULT_MAX_NEW_TOKENS
    if config.generationParams.temperature is not None:
        params["temperature"] = config.generationParams.temperature
    if config.generationParams.topP is not None:
        params["top_p"] = config.generationParams.topP

    return params


def _resolve_runtime_generation_params(params: dict[str, Any], tokenizer: Any) -> dict[str, Any]:
    resolved = dict(params)
    if "pad_token_id" not in resolved:
        pad_token_id = getattr(tokenizer, "pad_token_id", None)
        eos_token_id = getattr(tokenizer, "eos_token_id", None)
        if pad_token_id is not None:
            resolved["pad_token_id"] = pad_token_id
        elif eos_token_id is not None:
            resolved["pad_token_id"] = eos_token_id
    return resolved


def _filter_supported_generation_params(params: dict[str, Any], generate_callable: Any) -> dict[str, Any]:
    try:
        signature = inspect.signature(generate_callable)
    except (TypeError, ValueError):
        return params

    if any(parameter.kind == inspect.Parameter.VAR_KEYWORD for parameter in signature.parameters.values()):
        return params

    supported = set(signature.parameters.keys())
    return {key: value for key, value in params.items() if key in supported}


def _resolve_model_kwargs(model_config: LocalModelConfig) -> dict[str, Any]:
    model_kwargs: dict[str, Any] = {}
    if model_config.device == "auto":
        model_kwargs["device_map"] = "auto"

    if model_config.torchDtype and model_config.torchDtype != "auto":
        import torch

        dtype_mapping = {
            "float16": torch.float16,
            "bfloat16": torch.bfloat16,
            "float32": torch.float32,
        }
        model_kwargs["torch_dtype"] = dtype_mapping[model_config.torchDtype]

    return model_kwargs


def _supports_manual_device_move(model: Any) -> bool:
    if getattr(model, "hf_device_map", None) is not None:
        return False
    if getattr(model, "quantization_config", None) is not None:
        return False
    return True


def _extract_pipeline_text(generation: Any) -> str:
    if not generation:
        raise RuntimeError("Model returned no generated text.")

    first = generation[0] if isinstance(generation, list) else generation
    if isinstance(first, dict):
        generated_text = str(first.get("generated_text", "")).strip()
        summary_text = str(first.get("summary_text", "")).strip()
        if generated_text:
            return generated_text
        if summary_text:
            return summary_text
    raise RuntimeError("Model returned an empty generation.")


def _move_tokenized_inputs_to_model_device(tokenized: dict[str, Any], model: Any) -> dict[str, Any]:
    model_device = getattr(model, "device", None)
    if model_device is None:
        return tokenized

    moved: dict[str, Any] = {}
    for key, value in tokenized.items():
        moved[key] = value.to(model_device) if hasattr(value, "to") else value
    return moved


def get_or_create_local_text_generator(config: ExampleGenerationConfig) -> LocalTextGenerator:
    key = _generator_cache_key(config.model)

    with _GENERATOR_CACHE_LOCK:
        existing = _GENERATOR_CACHE.get(key)
        if existing:
            return existing

        if config.model.provider != "transformers":
            raise ValueError(f"Unsupported generation model provider: {config.model.provider}")

        generation_params = _resolve_generation_params(config)
        resolved_model_reference = _RESOLVED_MODEL_REFERENCES.get(config.model.modelId, config.model.modelId)
        print(
            f"Loading generation model {config.model.modelId} from {resolved_model_reference}.",
            flush=True,
        )
        if config.model.inferenceMode == "text2text":
            created: LocalTextGenerator = TransformersText2TextGenerator(config.model, generation_params)
        elif config.model.inferenceMode == "causal":
            created = TransformersCausalGenerator(config.model, generation_params)
        elif config.model.inferenceMode == "chat":
            created = TransformersChatGenerator(config.model, generation_params)
        else:
            raise ValueError(f"Unsupported inference mode: {config.model.inferenceMode}")

        _GENERATOR_CACHE[key] = created
        return created


def _describe_loaded_generation_models_unlocked() -> list[dict[str, str | None]]:
    return [
        {
            "provider": provider,
            "modelId": model_id,
            "inferenceMode": inference_mode,
            "device": device,
            "torchDtype": torch_dtype,
            "localPath": _RESOLVED_MODEL_REFERENCES.get(model_id),
        }
        for provider, model_id, inference_mode, device, torch_dtype in _GENERATOR_CACHE.keys()
    ]


def describe_loaded_generation_models() -> list[dict[str, str | None]]:
    with _GENERATOR_CACHE_LOCK:
        return _describe_loaded_generation_models_unlocked()


def unload_generation_models() -> list[dict[str, str | None]]:
    with _GENERATOR_CACHE_LOCK:
        unloaded = _describe_loaded_generation_models_unlocked()
        _GENERATOR_CACHE.clear()
    gc.collect()
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass
    return unloaded
