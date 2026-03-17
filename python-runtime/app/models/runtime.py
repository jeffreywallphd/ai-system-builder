from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class RuntimeNode(BaseModel):
    id: str
    node_type: str
    properties: Dict[str, Any] = Field(default_factory=dict)


class RuntimeConnection(BaseModel):
    source_node_id: str
    source_port_id: str
    target_node_id: str
    target_port_id: str


class RuntimeExecutionState(BaseModel):
    execution_id: str
    workflow_id: Optional[str] = None
    node_outputs: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    messages: List[str] = Field(default_factory=list)
    status: Literal["completed", "failed"] = "completed"
