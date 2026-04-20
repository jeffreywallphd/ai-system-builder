from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from modules.adapters.runtime.python.worker.app import capabilities, execute_task, health
from modules.adapters.runtime.python.worker.models import PythonRuntimeTaskRequest


class WorkerAppTests(unittest.TestCase):
    def test_health_reports_interpreter_version(self) -> None:
        result = health()
        self.assertTrue(result.healthy)
        self.assertRegex(result.status.pythonVersion or "", r"^\d+\.\d+\.\d+")

    def test_prepare_training_dataset_dispatch(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            input_path = Path(temp_dir) / "source.txt"
            input_path.write_text("alpha beta gamma", encoding="utf-8")

            request = PythonRuntimeTaskRequest(
                requestId="req-1",
                taskType="prepare-training-dataset",
                payload={
                    "sourceInputs": [
                        {
                            "artifactId": "artifact-1",
                            "localPath": str(input_path),
                            "mediaType": "text/plain",
                        }
                    ],
                    "recipe": {
                        "normalization": {
                            "targetFormat": "markdown",
                            "unsupportedDocumentPolicy": "fail",
                        },
                        "chunking": {
                            "strategy": "character",
                            "chunkSize": 128,
                            "chunkOverlap": 8,
                            "preserveDocumentBoundaries": True,
                        },
                        "generation": {
                            "mode": "qa",
                            "model": {"provider": "transformers", "modelId": "test-model"},
                        },
                    },
                    "split": {"trainRatio": 0.67, "testRatio": 0.33, "seed": 7, "shuffle": True},
                    "output": {"format": "jsonl", "naming": {"baseName": "test-dataset"}},
                },
            )

            with patch("modules.adapters.runtime.python.worker.app.prepare_training_dataset") as prepare_mock:
                prepare_mock.return_value = type("Result", (), {"model_dump": lambda self, mode: {
                    "outputs": [],
                    "summary": {
                        "sourceDocumentCount": 1,
                        "normalizedDocumentCount": 1,
                        "skippedDocumentCount": 0,
                        "chunkCount": 1,
                        "generatedExampleCount": 1,
                        "trainRowCount": 1,
                        "testRowCount": 0,
                    },
                }})()
                response = execute_task(request)

            self.assertTrue(response.success)
            self.assertIsNotNone(response.data)
            self.assertEqual(response.data["summary"]["generatedExampleCount"], 1)

    def test_unknown_task_preserves_generic_execution_path(self) -> None:
        request = PythonRuntimeTaskRequest(
            requestId="req-unknown",
            taskType="unknown-task",
            payload={},
        )
        response = execute_task(request)
        self.assertFalse(response.success)
        self.assertEqual(response.error.code, "not_implemented")

    def test_capabilities_endpoint_contains_dataset_task(self) -> None:
        result = capabilities()
        self.assertIn("prepare-training-dataset", result.capabilities)

    def test_timeout_returns_structured_error(self) -> None:
        request = PythonRuntimeTaskRequest(
            requestId="req-timeout",
            taskType="prepare-training-dataset",
            timeoutMs=5,
            payload={
                "sourceInputs": [],
                "recipe": {
                    "normalization": {"targetFormat": "markdown"},
                    "chunking": {"strategy": "character", "chunkSize": 128, "chunkOverlap": 8},
                    "generation": {"mode": "qa", "model": {"provider": "transformers", "modelId": "test-model"}},
                },
                "split": {"trainRatio": 0.5, "testRatio": 0.5},
                "output": {"format": "jsonl"},
            },
        )

        with patch("modules.adapters.runtime.python.worker.app.prepare_training_dataset") as prepare_mock:
            def _slow(*_args, **_kwargs):
                import time
                time.sleep(0.05)
                return None
            prepare_mock.side_effect = _slow
            response = execute_task(request)

        self.assertFalse(response.success)
        self.assertEqual(response.error.errorCode, "runtime_timeout")
        self.assertEqual(response.error.stage, "generation")


if __name__ == "__main__":
    unittest.main()
