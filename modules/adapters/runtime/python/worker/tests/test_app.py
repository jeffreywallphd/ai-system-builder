from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from app import capabilities, execute_task, health
from models import PythonRuntimeTaskRequest


class WorkerAppTests(unittest.TestCase):
    def test_health_reports_interpreter_version(self) -> None:
        result = health()
        self.assertTrue(result.healthy)
        self.assertRegex(result.status.pythonVersion or "", r"^\d+\.\d+\.\d+")

    def test_prepare_templated_dataset_dispatch(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            input_path = Path(temp_dir) / "source.jsonl"
            input_path.write_text(
                "\n".join([
                    json.dumps({"text": "alpha"}),
                    json.dumps({"text": "beta"}),
                    json.dumps({"text": "gamma"}),
                ]),
                encoding="utf-8",
            )

            request = PythonRuntimeTaskRequest(
                requestId="req-1",
                taskType="prepare-templated-dataset",
                payload={
                    "sourceInputs": [{
                        "artifactId": "artifact-1",
                        "localPath": str(input_path),
                        "mediaType": "application/x-ndjson",
                    }],
                    "template": "Prompt: {{text}}",
                    "split": {"trainRatio": 0.67, "testRatio": 0.33, "seed": 7},
                    "outputFormat": "jsonl",
                    "shuffle": True,
                },
            )

            response = execute_task(request)
            self.assertTrue(response.success)
            self.assertIsNotNone(response.data)
            outputs = response.data["outputs"]
            self.assertEqual(len(outputs), 2)
            self.assertEqual({output["role"] for output in outputs}, {"train", "test"})

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
        self.assertIn("prepare-templated-dataset", result.capabilities)


if __name__ == "__main__":
    unittest.main()
