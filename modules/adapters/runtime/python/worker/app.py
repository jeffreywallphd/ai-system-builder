from __future__ import annotations

from datetime import datetime, timezone
from os import getenv
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

RUNTIME_ID = getenv("PYTHON_RUNTIME_ID", "python-sidecar")
WORKER_VERSION = getenv("PYTHON_RUNTIME_WORKER_VERSION", "0.1.0")
WORKER_STARTED_AT = datetime.now(timezone.utc).isoformat()


class PythonRuntimeError(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None
    retryable: bool | None = None


class PythonRuntimeHealthStatus(BaseModel):
    runtimeId: str
    status: str
    version: str | None = None
    pythonVersion: str | None = None
    workerStartedAt: str | None = None
    lastHeartbeatAt: str | None = None


class PythonRuntimeHealthCheckResult(BaseModel):
    healthy: bool
    status: PythonRuntimeHealthStatus
    error: PythonRuntimeError | None = None
    message: str | None = None


class PythonRuntimeCapabilitiesResult(BaseModel):
    runtimeId: str
    capabilities: list[str]


class PythonRuntimeTaskRequest(BaseModel):
    requestId: str
    taskType: str
    payload: Any
    timeoutMs: int | None = None
    metadata: dict[str, Any] | None = None


class PythonRuntimeTaskResult(BaseModel):
    requestId: str
    taskType: str
    success: bool
    data: Any | None = None
    error: PythonRuntimeError | None = None
    metadata: dict[str, Any] | None = None


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
            pythonVersion=getenv("PYTHON_VERSION"),
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
