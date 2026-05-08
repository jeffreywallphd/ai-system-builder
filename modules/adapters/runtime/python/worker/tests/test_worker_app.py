from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.responses import JSONResponse

from modules.adapters.runtime.python.worker import app as worker_app
from modules.adapters.runtime.python.worker.app import _run_task, ensure_model_download
from modules.adapters.runtime.python.worker.models import EnsureModelDownloadRequest
from modules.adapters.runtime.python.worker.models import StartPythonRuntimeTaskRequest


class WorkerAppTests(unittest.TestCase):
    def setUp(self) -> None:
        with worker_app.TASK_REGISTRY_LOCK:
            worker_app.TASK_REGISTRY.clear()

    def test_model_download_success_emits_lifecycle_logs(self) -> None:
        request = EnsureModelDownloadRequest(
            provider="transformers",
            modelId="Qwen/Qwen3.5-4B",
        )

        with (
            patch(
                "modules.adapters.runtime.python.worker.app.ensure_generation_model_downloaded",
                return_value=SimpleNamespace(
                    downloaded=True,
                    from_cache=False,
                    local_path="/models/qwen",
                ),
            ),
            patch("builtins.print") as print_mock,
        ):
            response = ensure_model_download(request)

        self.assertEqual(response.modelId, "Qwen/Qwen3.5-4B")
        printed_events = [
            json.loads(call.args[0])["event"]
            for call in print_mock.call_args_list
            if call.args and isinstance(call.args[0], str) and call.args[0].startswith("{")
        ]
        self.assertIn("runtime.model_download.started", printed_events)
        self.assertIn("runtime.model_download.succeeded", printed_events)

    def test_model_download_failure_returns_structured_json_response(self) -> None:
        request = EnsureModelDownloadRequest(
            provider="transformers",
            modelId="Qwen/Qwen3.5-4B",
        )

        with (
            patch(
                "modules.adapters.runtime.python.worker.app.ensure_generation_model_downloaded",
                side_effect=RuntimeError("Automatic download failed."),
            ),
            patch("builtins.print") as print_mock,
        ):
            response = ensure_model_download(request)

        self.assertIsInstance(response, JSONResponse)
        self.assertEqual(response.status_code, 502)
        payload = json.loads(response.body.decode("utf-8"))
        self.assertEqual(payload["error"]["code"], "model_download_failed")
        self.assertEqual(payload["error"]["stage"], "generation")
        self.assertEqual(payload["error"]["details"]["modelId"], "Qwen/Qwen3.5-4B")
        self.assertNotIn("Traceback", payload["error"]["message"])
        printed_events = [
            json.loads(call.args[0])["event"]
            for call in print_mock.call_args_list
            if call.args and isinstance(call.args[0], str) and call.args[0].startswith("{")
        ]
        self.assertIn("runtime.model_download.started", printed_events)
        self.assertIn("runtime.model_download.failed", printed_events)

    def test_async_model_download_task_returns_download_result(self) -> None:
        request = StartPythonRuntimeTaskRequest(
            requestId="download-1",
            taskType="ensure-model-download",
            payload={
                "provider": "transformers",
                "modelId": "Qwen/Qwen3.5-4B",
            },
        )

        with patch(
            "modules.adapters.runtime.python.worker.app.ensure_generation_model_downloaded",
            return_value=SimpleNamespace(
                downloaded=True,
                from_cache=False,
                local_path="/models/qwen",
            ),
        ):
            result = _run_task(request)

        self.assertEqual(
            result,
            {
                "provider": "transformers",
                "modelId": "Qwen/Qwen3.5-4B",
                "downloaded": True,
                "fromCache": False,
                "localPath": "/models/qwen",
            },
        )

    def test_async_model_download_task_updates_progress(self) -> None:
        request = StartPythonRuntimeTaskRequest(
            requestId="download-progress-1",
            taskType="ensure-model-download",
            payload={
                "provider": "transformers",
                "modelId": "Qwen/Qwen3.5-4B",
            },
        )

        def fake_download(_model_config, on_progress=None, download_context=None):
            del download_context
            if on_progress is not None:
                on_progress(
                    {
                        "stage": "snapshot-download",
                        "message": "Downloading Hugging Face snapshot.",
                        "fileCount": 12,
                        "totalBytes": 3456,
                    }
                )
            return SimpleNamespace(
                downloaded=True,
                from_cache=False,
                local_path="/models/qwen",
            )

        with patch(
            "modules.adapters.runtime.python.worker.app.ensure_generation_model_downloaded",
            side_effect=fake_download,
        ):
            with worker_app.TASK_REGISTRY_LOCK:
                worker_app.TASK_REGISTRY[request.requestId] = worker_app._create_task_record(
                    request.requestId,
                    request.taskType,
                )
            _run_task(request)

        status = worker_app.read_task_status("download-progress-1")
        self.assertEqual(status.progress["stage"], "snapshot-download")
        self.assertEqual(status.progress["fileCount"], 12)


if __name__ == "__main__":
    unittest.main()
