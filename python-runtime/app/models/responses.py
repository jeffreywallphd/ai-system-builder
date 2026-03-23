from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


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
    kind: Literal["training-manifest", "prepared-bundle", "checkpoint", "trained-model", "metrics", "log"]
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


class FineTuningJobProgress(BaseModel):
    percent: float
    current_epoch: Optional[int] = None
    total_epochs: Optional[int] = None
    current_step: Optional[int] = None
    total_steps: Optional[int] = None
    latest_metric_name: Optional[str] = None
    latest_metric_value: Optional[float] = None
    status_detail: Optional[str] = None


class FineTuningJobProvenance(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    execution_kind: Literal["preparation-only", "local-gradient-training"]
    backend: Literal["python-runtime-local", "python-runtime-manifest"]
    truthfulness: Literal["preparation-only", "local-training-job"]
    runtime: Literal["python-runtime"]
    supports_gradient_training: bool
    is_preparation_only: bool
    provider: Optional[str] = None
    model_identity: Optional[str] = None
    detail: Optional[str] = None


class FineTuningJobResponse(BaseModel):
    job_id: str
    job_name: str
    backend: Literal["python-runtime-local", "python-runtime-manifest"]
    execution_kind: Literal["preparation-only", "local-gradient-training"]
    base_model_id: str
    dataset_id: str
    dataset_version_id: str
    created_by: str
    created_at: str
    updated_at: str
    submitted_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    status: Literal["preparing", "prepared", "submitted", "running", "completed", "failed", "cancelled"]
    configuration: Dict[str, Any]
    diagnostics: List[FineTuningJobDiagnostic] = Field(default_factory=list)
    artifacts: List[FineTuningJobArtifact] = Field(default_factory=list)
    checkpoints: List[FineTuningJobCheckpoint] = Field(default_factory=list)
    output_model_name: Optional[str] = None
    summary: Optional[str] = None
    progress: Optional[FineTuningJobProgress] = None
    provenance: FineTuningJobProvenance


class DatasetGenerationProvenanceDiagnostic(BaseModel):
    code: str
    level: Literal["info", "warning", "error"]
    message: str


class DatasetGenerationFallbackResponse(BaseModel):
    from_mode: Optional[Literal["provider-model-backed", "runtime-local-deterministic", "heuristic-fallback"]] = None
    reason: str


class DatasetGenerationProvenanceResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    provider: str
    model_id: Optional[str] = None
    model_display_name: Optional[str] = None
    generator_id: str
    generator_version: str
    batch_id: str
    mode: Literal["provider-model-backed", "runtime-local-deterministic", "heuristic-fallback"]
    status: Literal["completed", "partial", "failed"]
    detail: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    started_at: str
    executed_at: str
    duration_ms: Optional[int] = None
    diagnostics: List[DatasetGenerationProvenanceDiagnostic] = Field(default_factory=list)
    fallback: Optional[DatasetGenerationFallbackResponse] = None


class DatasetGenerationResponse(BaseModel):
    batch_id: str
    generated_at: str
    generated_count: int
    skipped_count: int
    examples: List[Dict[str, Any]] = Field(default_factory=list)
    provenance: DatasetGenerationProvenanceResponse
