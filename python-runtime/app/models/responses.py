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
