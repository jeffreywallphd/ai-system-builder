from __future__ import annotations

import platform
from datetime import datetime, timezone
from os import getenv

from fastapi import FastAPI

from models import (
    PrepareTemplatedDatasetRequest,
    PythonRuntimeCapabilitiesResult,
    PythonRuntimeError,
    PythonRuntimeHealthCheckResult,
    PythonRuntimeHealthStatus,
    PythonRuntimeTaskRequest,
    PythonRuntimeTaskResult,
)
from tasks.prepare_templated_dataset import prepare_templated_dataset

RUNTIME_ID = getenv("PYTHON_RUNTIME_ID", "python-sidecar")
WORKER_VERSION = getenv("PYTHON_RUNTIME_WORKER_VERSION", "0.1.0")
WORKER_STARTED_AT = datetime.now(timezone.utc).isoformat()
PYTHON_VERSION = platform.python_version()

app = FastAPI(title="ai-system-builder python runtime worker", version=WORKER_VERSION)


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
        capabilities=["prepare-templated-dataset"],
    )


@app.post("/tasks/execute", response_model=PythonRuntimeTaskResult)
def execute_task(request: PythonRuntimeTaskRequest) -> PythonRuntimeTaskResult:
    try:
        if request.taskType == "prepare-templated-dataset":
            payload = PrepareTemplatedDatasetRequest.model_validate(request.payload)
            result = prepare_templated_dataset(payload)
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
        return PythonRuntimeTaskResult(
            requestId=request.requestId,
            taskType=request.taskType,
            success=False,
            error=PythonRuntimeError(
                code="task_failed",
                message=str(error),
                retryable=False,
            ),
            metadata={"runtimeId": RUNTIME_ID},
        )
