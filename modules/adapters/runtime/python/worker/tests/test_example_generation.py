from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from modules.adapters.runtime.python.worker.models import ExampleGenerationConfig
from modules.adapters.runtime.python.worker.tasks.example_generation import (
    GeneratedQaExample,
    _GENERATOR_CACHE,
    _RESOLVED_MODEL_REFERENCES,
    _extract_single_question,
    ensure_generation_model_downloaded,
    generate_qa_examples_for_chunks,
)
from modules.adapters.runtime.python.worker.tasks.markdown_chunking import MarkdownChunk


class _FakeGenerator:
    def __init__(self, _config, _params):
        self.calls: list[str] = []

    def generate_text(self, prompt: str) -> str:
        self.calls.append(prompt)
        if "Return only the question." in prompt:
            return "Generated question?"
        return "Generated answer."


class ExampleGenerationTests(unittest.TestCase):
    def setUp(self) -> None:
        _GENERATOR_CACHE.clear()
        _RESOLVED_MODEL_REFERENCES.clear()

    def test_generates_qa_examples_from_chunks(self) -> None:
        config = ExampleGenerationConfig.model_validate(
            {
                "mode": "qa",
                "model": {"provider": "transformers", "modelId": "test-model"},
                "generationParams": {"maxNewTokens": 24},
            }
        )

        with patch(
            "modules.adapters.runtime.python.worker.tasks.example_generation.TransformersQaTextGenerator",
            _FakeGenerator,
        ):
            examples = generate_qa_examples_for_chunks(
                [MarkdownChunk(artifact_id="artifact-1", chunk_index=0, text="chunk text")],
                config,
            )

        self.assertEqual(
            examples,
            [
                GeneratedQaExample(
                    artifact_id="artifact-1",
                    chunk_index=0,
                    question="Generated question?",
                    answer="Generated answer.",
                    generation_mode="qa",
                )
            ],
        )

    def test_extract_single_question_handles_prompt_echo_with_context_block(self) -> None:
        chunk = MarkdownChunk(artifact_id="artifact-1", chunk_index=0, text="Some context")
        generated_text = (
            "Write one concise question answerable from the context below. Return only the question.\n\n"
            "Context:\nSome context"
        )
        question = _extract_single_question(generated_text, chunk)
        self.assertEqual(question, "What is the main idea of this passage about artifact-1?")

    def test_reuses_cached_generator_for_same_model_config(self) -> None:
        config = ExampleGenerationConfig.model_validate(
            {
                "mode": "qa",
                "model": {"provider": "transformers", "modelId": "test-model", "device": "cpu"},
            }
        )

        instance_count = 0

        class _CountingGenerator(_FakeGenerator):
            def __init__(self, model_config, params):
                nonlocal instance_count
                instance_count += 1
                super().__init__(model_config, params)

        with patch(
            "modules.adapters.runtime.python.worker.tasks.example_generation.TransformersQaTextGenerator",
            _CountingGenerator,
        ):
            generate_qa_examples_for_chunks([MarkdownChunk("a", 0, "first")], config)
            generate_qa_examples_for_chunks([MarkdownChunk("a", 1, "second")], config)

        self.assertEqual(instance_count, 1)

    def test_ensure_generation_model_downloaded_returns_cached_when_present(self) -> None:
        snapshot_download = unittest.mock.Mock()
        with patch.dict("sys.modules", {"huggingface_hub": SimpleNamespace(snapshot_download=snapshot_download)}):
            snapshot_download.return_value = "/tmp/hf-cache/model"
            result = ensure_generation_model_downloaded(
                ExampleGenerationConfig.model_validate(
                    {
                        "mode": "qa",
                        "model": {"provider": "transformers", "modelId": "test-model"},
                    }
                ).model
            )

        self.assertFalse(result.downloaded)
        self.assertTrue(result.from_cache)
        self.assertEqual(result.local_path, "/tmp/hf-cache/model")
        snapshot_download.assert_called_once_with(repo_id="test-model", local_files_only=True)

    def test_ensure_generation_model_downloaded_uses_existing_safetensors_cache_before_download(self) -> None:
        with TemporaryDirectory() as temporary_directory:
            cache_root = Path(temporary_directory)
            snapshot_path = cache_root / "models--Qwen--Qwen3-8B" / "snapshots" / "abcdef"
            snapshot_path.mkdir(parents=True, exist_ok=True)
            (snapshot_path / "model-00001-of-00002.safetensors").write_bytes(b"weights")

            snapshot_download = unittest.mock.Mock(side_effect=RuntimeError("should-not-download"))
            with patch.dict(
                "sys.modules",
                {"huggingface_hub": SimpleNamespace(snapshot_download=snapshot_download)},
            ):
                with patch.dict("os.environ", {"HF_HUB_CACHE": temporary_directory}, clear=False):
                    result = ensure_generation_model_downloaded(
                        ExampleGenerationConfig.model_validate(
                            {
                                "mode": "qa",
                                "model": {"provider": "transformers", "modelId": "Qwen/Qwen3-8B"},
                            }
                        ).model
                    )

        self.assertFalse(result.downloaded)
        self.assertTrue(result.from_cache)
        self.assertEqual(result.local_path, str(snapshot_path))
        snapshot_download.assert_not_called()

    def test_ensure_generation_model_downloaded_auto_downloads_when_missing_from_cache(self) -> None:
        snapshot_download = unittest.mock.Mock()
        with patch.dict("sys.modules", {"huggingface_hub": SimpleNamespace(snapshot_download=snapshot_download)}):
            snapshot_download.side_effect = [RuntimeError("cache-miss"), "/tmp/hf-cache/model"]
            result = ensure_generation_model_downloaded(
                ExampleGenerationConfig.model_validate(
                    {
                        "mode": "qa",
                        "model": {"provider": "transformers", "modelId": "test-model"},
                    }
                ).model
            )

        self.assertTrue(result.downloaded)
        self.assertFalse(result.from_cache)
        self.assertEqual(result.local_path, "/tmp/hf-cache/model")
        self.assertEqual(snapshot_download.call_count, 2)

    def test_ensure_generation_model_downloaded_raises_when_download_fails(self) -> None:
        snapshot_download = unittest.mock.Mock(side_effect=RuntimeError("cannot-download"))
        with patch.dict("sys.modules", {"huggingface_hub": SimpleNamespace(snapshot_download=snapshot_download)}):
            with self.assertRaisesRegex(RuntimeError, "Automatic download failed"):
                ensure_generation_model_downloaded(
                    ExampleGenerationConfig.model_validate(
                        {
                            "mode": "qa",
                            "model": {"provider": "transformers", "modelId": "test-model"},
                        }
                    ).model
                )


if __name__ == "__main__":
    unittest.main()
