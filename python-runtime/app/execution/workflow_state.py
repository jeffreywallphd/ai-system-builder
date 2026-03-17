from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class WorkflowState:
    execution_id: str
    workflow_id: str
    workflow_inputs: Dict[str, Any]
    outputs: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    messages: List[str] = field(default_factory=list)
