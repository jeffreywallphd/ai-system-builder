from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "unavailable"]
    runtime: Literal["python"] = "python"
    version: str
    details: Dict[str, Any] = Field(default_factory=dict)


class ExecuteNodeResponse(BaseModel):
    execution_id: str
    node_id: str
    status: Literal["completed", "failed"]
    outputs: Dict[str, Any] = Field(default_factory=dict)
    messages: List[str] = Field(default_factory=list)
    error_message: Optional[str] = None


class ExecuteWorkflowResponse(BaseModel):
    execution_id: str
    workflow_id: str
    status: Literal["completed", "failed"]
    node_results: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    messages: List[str] = Field(default_factory=list)
    error_message: Optional[str] = None


class FineTuningJobDiagnostic(BaseModel):
    code: str
    level: Literal["info", "warning", "error"]
    message: str
    detail: Optional[str] = None


class FineTuningJobArtifact(BaseModel):
    id: str
    kind: Literal["training-manifest", "adapter-bundle", "checkpoint", "log"]
    label: str
    location: Optional[str] = None
    content_type: Optional[str] = None
    created_at: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class FineTuningJobCheckpoint(BaseModel):
    id: str
    label: str
    epoch: int
    metric_name: Optional[str] = None
    metric_value: Optional[float] = None
    created_at: str
    artifact_id: Optional[str] = None


class FineTuningJobResponse(BaseModel):
    job_id: str
    job_name: str
    backend: Literal["python-runtime-manifest"]
    base_model_id: str
    dataset_id: str
    dataset_version_id: str
    created_by: str
    created_at: str
    updated_at: str
    submitted_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    status: Literal["queued", "running", "completed", "failed", "unsupported"]
    configuration: Dict[str, Any]
    diagnostics: List[FineTuningJobDiagnostic] = Field(default_factory=list)
    artifacts: List[FineTuningJobArtifact] = Field(default_factory=list)
    checkpoints: List[FineTuningJobCheckpoint] = Field(default_factory=list)
    output_model_name: Optional[str] = None
    summary: Optional[str] = None


class DatasetGenerationProvenanceDiagnostic(BaseModel):
    code: str
    level: Literal["info", "warning", "error"]
    message: str


class DatasetGenerationProvenanceResponse(BaseModel):
    provider: str
    generator_id: str
    generator_version: str
    batch_id: str
    mode: Literal["provider-backed", "heuristic-fallback"]
    detail: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    executed_at: str
    diagnostics: List[DatasetGenerationProvenanceDiagnostic] = Field(default_factory=list)


class DatasetGenerationResponse(BaseModel):
    batch_id: str
    generated_at: str
    generated_count: int
    skipped_count: int
    examples: List[Dict[str, Any]] = Field(default_factory=list)
    provenance: DatasetGenerationProvenanceResponse
