from __future__ import annotations

import platform
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from datetime import datetime, timezone
from os import getenv

from fastapi import FastAPI

from .models import (
    PrepareTrainingDatasetRequest,
    PythonRuntimeCapabilitiesResult,
    PythonRuntimeError,
    PythonRuntimeHealthCheckResult,
    PythonRuntimeHealthStatus,
    PythonRuntimeTaskRequest,
    PythonRuntimeTaskResult,
)
from .tasks.prepare_training_dataset import prepare_training_dataset

RUNTIME_ID = getenv("PYTHON_RUNTIME_ID", "python-sidecar")
WORKER_VERSION = getenv("PYTHON_RUNTIME_WORKER_VERSION", "0.1.0")
WORKER_STARTED_AT = datetime.now(timezone.utc).isoformat()
PYTHON_VERSION = platform.python_version()

app = FastAPI(title="ai-system-builder python runtime worker", version=WORKER_VERSION)
TASK_EXECUTOR = ThreadPoolExecutor(max_workers=1)


@app.get("/health", response_model=PythonRuntimeHealthCheckResult)
def health() -> PythonRuntimeHealthCheckResult:
    heartbeat = datetime.now(timezone.utc).isoformat()
    return PythonRuntimeHealthCheckResult(
        healthy=True,
        status=PythonRuntimeHealthStatus(
            runtimeId=RUNTIME_ID,
            status="ready",
            version=WORKER_VERSION,
            pythonVersion=PYTHON_VERSION,
            workerStartedAt=WORKER_STARTED_AT,
            lastHeartbeatAt=heartbeat,
        ),
    )


@app.get("/capabilities", response_model=PythonRuntimeCapabilitiesResult)
def capabilities() -> PythonRuntimeCapabilitiesResult:
    return PythonRuntimeCapabilitiesResult(
        runtimeId=RUNTIME_ID,
        capabilities=["prepare-training-dataset"],
    )


@app.post("/tasks/execute", response_model=PythonRuntimeTaskResult)
def execute_task(request: PythonRuntimeTaskRequest) -> PythonRuntimeTaskResult:
    try:
        if request.taskType == "prepare-training-dataset":
            payload = PrepareTrainingDatasetRequest.model_validate(request.payload)
            task_future = TASK_EXECUTOR.submit(prepare_training_dataset, payload)
            timeout_seconds = (request.timeoutMs / 1000) if request.timeoutMs else None
            try:
                result = task_future.result(timeout=timeout_seconds)
            except FutureTimeoutError:
                task_future.cancel()
                return PythonRuntimeTaskResult(
                    requestId=request.requestId,
                    taskType=request.taskType,
                    success=False,
                    error=PythonRuntimeError(
                        code="task_timeout",
                        errorCode="runtime_timeout",
                        stage="generation",
                        message=f"Dataset preparation timed out after {request.timeoutMs}ms.",
                        retryable=False,
                    ),
                    metadata={"runtimeId": RUNTIME_ID},
                )
            return PythonRuntimeTaskResult(
                requestId=request.requestId,
                taskType=request.taskType,
                success=True,
                data=result.model_dump(mode="json"),
                metadata={"runtimeId": RUNTIME_ID},
            )

        return PythonRuntimeTaskResult(
            requestId=request.requestId,
            taskType=request.taskType,
            success=False,
            error=PythonRuntimeError(
                code="not_implemented",
                message=f"Task type '{request.taskType}' is not implemented yet.",
                retryable=False,
            ),
            metadata={
                "runtimeId": RUNTIME_ID,
                "skeleton": True,
            },
        )
    except Exception as error:
        error_code = "task_failed"
        stage = None
        details = None
        message = str(error)
        if hasattr(error, "error_code"):
            error_code = str(getattr(error, "error_code"))
        if hasattr(error, "stage"):
            stage = str(getattr(error, "stage"))
        if hasattr(error, "details"):
            error_details = getattr(error, "details")
            if isinstance(error_details, dict):
                details = error_details
        return PythonRuntimeTaskResult(
            requestId=request.requestId,
            taskType=request.taskType,
            success=False,
            error=PythonRuntimeError(
                code="task_failed",
                errorCode=error_code,
                stage=stage,  # type: ignore[arg-type]
                message=message,
                details=details,
                retryable=False,
            ),
            metadata={"runtimeId": RUNTIME_ID},
        )
