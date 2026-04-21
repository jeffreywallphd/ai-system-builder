from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from modules.adapters.runtime.python.worker.models import ExampleGenerationConfig
from modules.adapters.runtime.python.worker.tasks.example_generation import (
    GeneratedQaExample,
    _GENERATOR_CACHE,
    ensure_generation_model_downloaded,
    generate_qa_examples_for_chunks,
)
from modules.adapters.runtime.python.worker.tasks.markdown_chunking import MarkdownChunk


class _FakeGenerator:
    def __init__(self, _config, _params):
        self.calls: list[str] = []

    def generate_question(self, prompt: str) -> str:
        self.calls.append(prompt)
        return "Generated question?"


class ExampleGenerationTests(unittest.TestCase):
    def setUp(self) -> None:
        _GENERATOR_CACHE.clear()

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
                    answer="chunk text",
                    generation_mode="qa",
                )
            ],
        )

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
