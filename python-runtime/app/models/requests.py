from typing import Any, Dict, List, Optional
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
