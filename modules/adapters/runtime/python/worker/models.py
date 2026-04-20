from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


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


class PrepareTemplatedDatasetInputDescriptor(BaseModel):
    artifactId: str
    localPath: str
    mediaType: str
    role: str | None = None
    name: str | None = None


class PrepareTemplatedDatasetRequest(BaseModel):
    sourceInputs: list[PrepareTemplatedDatasetInputDescriptor]
    template: str
    split: dict[str, float | int]
    outputFormat: Literal["jsonl", "json", "csv"]
    shuffle: bool | None = None
    validationPolicy: Literal["strict", "best-effort"] | None = None
    outputNaming: dict[str, str] | None = None


class PythonRuntimeOutputDescriptor(BaseModel):
    name: str
    role: Literal["train", "test", "metrics", "report", "artifact"] | None = None
    tempPath: str
    mediaType: str
    sizeBytes: int | None = None
    metadata: dict[str, Any] | None = None


class PrepareTemplatedDatasetResult(BaseModel):
    outputs: list[PythonRuntimeOutputDescriptor]
    trainRowCount: int
    testRowCount: int
    warnings: list[str] | None = None
