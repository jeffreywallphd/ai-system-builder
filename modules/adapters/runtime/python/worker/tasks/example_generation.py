from __future__ import annotations

from dataclasses import dataclass
from os import getenv
from pathlib import Path
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
    def generate_text(self, prompt: str) -> str:
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

        resolved_model_reference = _RESOLVED_MODEL_REFERENCES.get(model_config.modelId, model_config.modelId)

        try:
            return pipeline(
                "text2text-generation",
                model=resolved_model_reference,
                tokenizer=resolved_model_reference,
                model_kwargs=model_kwargs or None,
            )
        except Exception:
            return pipeline(
                "text-generation",
                model=resolved_model_reference,
                tokenizer=resolved_model_reference,
                model_kwargs=model_kwargs or None,
            )

    def generate_text(self, prompt: str) -> str:
        generation_params = dict(self._generation_params)
        generation_params.setdefault("return_full_text", False)

        generation = self._pipeline(prompt, **generation_params)
        if not generation:
            raise RuntimeError("Model returned no generated text.")

        first = generation[0]
        text = str(first.get("generated_text", "")).strip()
        if not text:
            text = str(first.get("summary_text", "")).strip()
        if text.startswith(prompt):
            text = text[len(prompt) :].strip()
        if not text:
            raise RuntimeError("Model returned an empty generation.")
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
        local_path = snapshot_download(
            repo_id=model_config.modelId,
            local_files_only=False,
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


_GENERATOR_CACHE: dict[tuple[str, str, str, str], QaTextGenerator] = {}
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


def _build_question_prompt(chunk: MarkdownChunk) -> str:
    return (
        "You are creating supervised training data.\n"
        "Write exactly one clear user question answerable only from the context.\n"
        "The question should be specific, natural, and grounded in the context.\n"
        "Return only the question.\n\n"
        f"Context:\n{chunk.text}"
    )


def _build_answer_prompt(question: str, chunk: MarkdownChunk) -> str:
    return (
        "You are creating supervised training data.\n"
        "Answer the user question using only facts in the context.\n"
        "Write in a conversational tone while staying concise and faithful.\n"
        "Do not add details not present in the context.\n"
        "Return only the answer.\n\n"
        f"Question:\n{question}\n\n"
        f"Context:\n{chunk.text}"
    )


def _extract_single_question(text: str, chunk: MarkdownChunk) -> str:
    original = text.replace("\r", "\n").strip()
    lowered_original = original.lower()

    if "return only the question." in lowered_original and "context:" in lowered_original:
        prompt_prefix = lowered_original.split("context:", 1)[0]
        if "?" not in prompt_prefix:
            return f"What is the main idea of this passage about {chunk.artifact_id}?"

    normalized = " ".join(original.split())
    prefixes = (
        "you are creating supervised training data.",
        "question:",
        "q:",
        "write one concise question answerable from the context below. return only the question.",
        "write exactly one clear user question answerable only from the context.",
    )
    lowered = normalized.lower()
    for prefix in prefixes:
        if lowered.startswith(prefix):
            normalized = normalized[len(prefix) :].strip()
            lowered = normalized.lower()
            break

    context_marker = lowered.find("context:")
    if context_marker != -1:
        normalized = normalized[:context_marker].strip()

    for delimiter in ("?", "\n"):
        if delimiter in normalized:
            leading = normalized.split(delimiter, 1)[0].strip()
            if leading:
                return f"{leading}?"

    if normalized.endswith("?"):
        return normalized
    if normalized:
        if "return only the question" in normalized.lower():
            return f"What is the main idea of this passage about {chunk.artifact_id}?"
        return f"{normalized.rstrip('.')}?"
    return f"What is the main idea of this passage about {chunk.artifact_id}?"


def _extract_single_answer(text: str, question: str, chunk: MarkdownChunk) -> str:
    normalized = text.replace("\r", "\n").strip()
    lowered = normalized.lower()

    prefixes = (
        "answer:",
        "a:",
        "you are creating supervised training data.",
        "answer the user question using only facts in the context.",
        "write in a conversational tone while staying concise and faithful.",
        "do not add details not present in the context.",
        "return only the answer.",
    )
    for prefix in prefixes:
        if lowered.startswith(prefix):
            normalized = normalized[len(prefix) :].strip()
            lowered = normalized.lower()

    question_marker = lowered.find("question:")
    if question_marker != -1:
        normalized = normalized[question_marker + len("question:") :].strip()
        lowered = normalized.lower()
        context_after_question = lowered.find("context:")
        if context_after_question != -1:
            normalized = normalized[context_after_question + len("context:") :].strip()
            lowered = normalized.lower()

    context_marker = lowered.find("context:")
    if context_marker != -1:
        normalized = normalized[:context_marker].strip()
        lowered = normalized.lower()

    if not normalized:
        return chunk.text.splitlines()[0].strip() or f"The context discusses {chunk.artifact_id}."

    if normalized.strip().lower() == question.strip().lower():
        return chunk.text.splitlines()[0].strip() or f"The context discusses {chunk.artifact_id}."

    return normalized


def generate_qa_examples_for_chunks(
    chunks: list[MarkdownChunk],
    config: ExampleGenerationConfig,
) -> list[GeneratedQaExample]:
    if config.mode != "qa":
        raise ValueError(f"Unsupported generation mode: {config.mode}")

    generator = _get_or_create_generator(config)

    examples: list[GeneratedQaExample] = []
    for chunk in chunks:
        question = _extract_single_question(generator.generate_text(_build_question_prompt(chunk)).strip(), chunk)
        answer = _extract_single_answer(
            generator.generate_text(_build_answer_prompt(question, chunk)).strip(),
            question,
            chunk,
        )
        examples.append(
            GeneratedQaExample(
                artifact_id=chunk.artifact_id,
                chunk_index=chunk.chunk_index,
                question=question,
                answer=answer,
            )
        )

    return examples
