from __future__ import annotations

import uuid
from app.execution.workflow_state import WorkflowState
from app.models.requests import ExecuteWorkflowRequest
from .node_dispatcher import NodeDispatcher


class WorkflowExecutor:
    def __init__(self, dispatcher: NodeDispatcher | None = None) -> None:
        self._dispatcher = dispatcher or NodeDispatcher()

    def execute(self, request: ExecuteWorkflowRequest) -> WorkflowState:
        execution_id = request.execution_id or f"wf-{uuid.uuid4().hex[:10]}"
        state = WorkflowState(
            execution_id=execution_id,
            workflow_id=request.workflow_id,
            workflow_inputs=request.workflow_inputs,
        )

        for node in request.nodes:
            inputs = {**request.workflow_inputs, **state.outputs.get(node.id, {})}
            output = self._dispatcher.dispatch(node.node_type, inputs=inputs, properties=node.properties)
            state.outputs[node.id] = output
            state.messages.append(f"Executed node {node.id} ({node.node_type})")

        return state
