from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher

from ..models import ExampleGenerationConfig
from .local_text_generation import (
    _GENERATOR_CACHE,
    _RESOLVED_MODEL_REFERENCES,
    ensure_generation_model_downloaded,
    ensure_generation_model_is_available,
    get_or_create_local_text_generator,
)
from .markdown_chunking import MarkdownChunk


@dataclass
class GeneratedQaExample:
    artifact_id: str
    chunk_index: int
    question: str
    answer: str
    generation_mode: str = "qa"


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


def _normalize_text(value: str) -> str:
    return " ".join(value.replace("\r", "\n").split()).strip().lower()


def _is_substantial_prompt_echo(generated: str, prompt: str) -> bool:
    normalized_generated = _normalize_text(generated)
    normalized_prompt = _normalize_text(prompt)
    if not normalized_generated:
        return True
    if normalized_generated in normalized_prompt:
        return True
    if len(normalized_generated) > 20 and SequenceMatcher(None, normalized_generated, normalized_prompt).ratio() > 0.8:
        return True
    return False


def _extract_single_question(text: str, prompt: str) -> str:
    candidate = text.replace("\r", "\n").strip()
    lowered = candidate.lower()

    if "context:" in lowered or "return only the question" in lowered:
        raise ValueError("Question generation echoed prompt instructions or context.")
    if _is_substantial_prompt_echo(candidate, prompt):
        raise ValueError("Question generation substantially echoed the prompt.")

    question_line = next((line.strip() for line in candidate.splitlines() if line.strip()), "")
    if not question_line or "?" not in question_line:
        raise ValueError("Question generation did not produce a usable question.")

    return question_line.split("?", 1)[0].strip() + "?"


def _extract_single_answer(text: str, question: str) -> str:
    candidate = text.replace("\r", "\n").strip()
    lowered = candidate.lower()
    if "context:" in lowered:
        raise ValueError("Answer generation echoed context block instead of returning an answer.")
    if not candidate:
        raise ValueError("Answer generation returned an empty value.")
    if candidate.strip().lower() == question.strip().lower():
        raise ValueError("Answer generation repeated the question instead of answering it.")
    return candidate


def generate_qa_examples_for_chunks(
    chunks: list[MarkdownChunk],
    config: ExampleGenerationConfig,
) -> list[GeneratedQaExample]:
    if config.mode != "qa":
        raise ValueError(f"Unsupported generation mode: {config.mode}")

    generator = get_or_create_local_text_generator(config)

    examples: list[GeneratedQaExample] = []
    for chunk in chunks:
        question_prompt = _build_question_prompt(chunk)
        try:
            question = _extract_single_question(generator.generate_text(question_prompt).strip(), question_prompt)
            answer = _extract_single_answer(
                generator.generate_text(_build_answer_prompt(question, chunk)).strip(),
                question,
            )
        except ValueError:
            if config.failurePolicy == "skip":
                continue
            raise

        examples.append(
            GeneratedQaExample(
                artifact_id=chunk.artifact_id,
                chunk_index=chunk.chunk_index,
                question=question,
                answer=answer,
            )
        )

    return examples
