from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from typing import Any

from ..models import ExampleGenerationConfig, LocalModelConfig
from .markdown_chunking import MarkdownChunk


@dataclass
class GeneratedQaExample:
    artifact_id: str
    chunk_index: int
    question: str
    answer: str
    generation_mode: str = "qa"


@dataclass
class GenerationModelAvailability:
    provider: str
    model_id: str
    downloaded: bool
    from_cache: bool
    local_path: str | None = None


class QaTextGenerator:
    def generate_question(self, prompt: str) -> str:
        raise NotImplementedError


class TransformersQaTextGenerator(QaTextGenerator):
    def __init__(self, model_config: LocalModelConfig, generation_params: dict[str, Any]):
        self._model_config = model_config
        self._generation_params = generation_params
        self._pipeline = self._build_pipeline(model_config)

    @staticmethod
    def _build_pipeline(model_config: LocalModelConfig):
        try:
            from transformers import pipeline
        except ImportError as error:
            raise RuntimeError(
                "The 'transformers' package is required for recipe generation with provider='transformers'."
            ) from error

        model_kwargs: dict[str, Any] = {}
        if model_config.torchDtype and model_config.torchDtype != "auto":
            import torch

            dtype_mapping = {
                "float16": torch.float16,
                "bfloat16": torch.bfloat16,
                "float32": torch.float32,
            }
            model_kwargs["torch_dtype"] = dtype_mapping[model_config.torchDtype]

        if model_config.device and model_config.device not in {"auto"}:
            model_kwargs["device"] = model_config.device

        return pipeline(
            "text2text-generation",
            model=model_config.modelId,
            tokenizer=model_config.modelId,
            model_kwargs=model_kwargs or None,
        )

    def generate_question(self, prompt: str) -> str:
        generation = self._pipeline(prompt, **self._generation_params)
        if not generation:
            raise RuntimeError("Model returned no generated text.")

        first = generation[0]
        text = str(first.get("generated_text", "")).strip()
        if not text:
            raise RuntimeError("Model returned an empty generated question.")
        return text


def ensure_generation_model_downloaded(model_config: LocalModelConfig) -> GenerationModelAvailability:
    if model_config.provider != "transformers":
        raise ValueError(f"Unsupported generation model provider: {model_config.provider}")

    try:
        from huggingface_hub import snapshot_download
    except ImportError as error:
        raise RuntimeError(
            "The 'huggingface_hub' package is required to validate and download generation models."
        ) from error

    try:
        local_path = snapshot_download(
            repo_id=model_config.modelId,
            local_files_only=True,
        )
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
        local_path = snapshot_download(
            repo_id=model_config.modelId,
            local_files_only=False,
        )
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


_GENERATOR_CACHE: dict[tuple[str, str, str, str], QaTextGenerator] = {}
_GENERATOR_CACHE_LOCK = Lock()


def _generator_cache_key(model: LocalModelConfig) -> tuple[str, str, str, str]:
    return (
        model.provider,
        model.modelId,
        model.device or "auto",
        model.torchDtype or "auto",
    )


def _resolve_generation_params(config: ExampleGenerationConfig) -> dict[str, Any]:
    params: dict[str, Any] = {}
    if config.generationParams is None:
        return params

    if config.generationParams.maxNewTokens is not None:
        params["max_new_tokens"] = config.generationParams.maxNewTokens
    if config.generationParams.temperature is not None:
        params["temperature"] = config.generationParams.temperature
    if config.generationParams.topP is not None:
        params["top_p"] = config.generationParams.topP

    return params


def _get_or_create_generator(config: ExampleGenerationConfig) -> QaTextGenerator:
    key = _generator_cache_key(config.model)

    with _GENERATOR_CACHE_LOCK:
        existing = _GENERATOR_CACHE.get(key)
        if existing:
            return existing

        if config.model.provider != "transformers":
            raise ValueError(f"Unsupported generation model provider: {config.model.provider}")

        created = TransformersQaTextGenerator(config.model, _resolve_generation_params(config))
        _GENERATOR_CACHE[key] = created
        return created


def _build_question_prompt(chunk: MarkdownChunk, config: ExampleGenerationConfig) -> str:
    template = (
        config.promptTemplate
        or "Write one concise question answerable from the context below. Return only the question.\n\nContext:\n{context}"
    )
    return template.replace("{context}", chunk.text)


def generate_qa_examples_for_chunks(
    chunks: list[MarkdownChunk],
    config: ExampleGenerationConfig,
) -> list[GeneratedQaExample]:
    if config.mode != "qa":
        raise ValueError(f"Unsupported generation mode: {config.mode}")

    generator = _get_or_create_generator(config)

    examples: list[GeneratedQaExample] = []
    for chunk in chunks:
        question = generator.generate_question(_build_question_prompt(chunk, config))
        examples.append(
            GeneratedQaExample(
                artifact_id=chunk.artifact_id,
                chunk_index=chunk.chunk_index,
                question=question,
                answer=chunk.text,
            )
        )

    return examples
