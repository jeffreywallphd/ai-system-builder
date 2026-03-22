from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
from .runtime import RuntimeConnection, RuntimeNode


class ExecuteNodeRequest(BaseModel):
    execution_id: Optional[str] = None
    workflow_id: Optional[str] = None
    node_id: str
    node_type: str
    inputs: Dict[str, Any] = Field(default_factory=dict)
    properties: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)


class ExecuteWorkflowRequest(BaseModel):
    execution_id: Optional[str] = None
    workflow_id: str
    nodes: List[RuntimeNode] = Field(default_factory=list)
    connections: List[RuntimeConnection] = Field(default_factory=list)
    workflow_inputs: Dict[str, Any] = Field(default_factory=dict)
    execution_context: Dict[str, Any] = Field(default_factory=dict)


class FineTuningJobConfiguration(BaseModel):
    epochs: int = 1
    learning_rate: float = 0.0001
    batch_size: int = 1
    notes: Optional[str] = None


class FineTuningJobRequest(BaseModel):
    job_id: str
    job_name: str
    backend: Literal["python-runtime-manifest"]
    base_model_id: str
    base_model_name: str
    dataset_id: str
    dataset_name: str
    dataset_version_id: str
    dataset_version_number: int
    created_by: str
    configuration: FineTuningJobConfiguration


class DatasetGenerationConfiguration(BaseModel):
    strategy: str = "provider-backed-default"
    max_examples_per_source: Optional[int] = None
    max_segments_per_source: Optional[int] = None


class DatasetGenerationSegment(BaseModel):
    id: str
    index: int
    kind: str
    text: str


class DatasetGenerationSourceDocument(BaseModel):
    id: str
    name: str
    content: str
    segments: List[DatasetGenerationSegment] = Field(default_factory=list)


class DatasetGenerationRequest(BaseModel):
    dataset_id: str
    version_id: str
    task_type: str
    created_by: str
    source_documents: List[DatasetGenerationSourceDocument] = Field(default_factory=list)
    existing_examples: List[Dict[str, Any]] = Field(default_factory=list)
    configuration: Optional[DatasetGenerationConfiguration] = None
