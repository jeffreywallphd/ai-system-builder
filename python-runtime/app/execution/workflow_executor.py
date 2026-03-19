from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Any, Dict, List

from app.execution.workflow_state import WorkflowState
from app.models.requests import ExecuteWorkflowRequest
from app.models.runtime import RuntimeConnection

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
        inbound_connections = self._index_inbound_connections(request.connections)

        for node in request.nodes:
            inputs = {**request.workflow_inputs, **self._resolve_node_inputs(node.id, inbound_connections, state.outputs)}
            output = self._dispatcher.dispatch(
                node.node_type,
                inputs=inputs,
                properties=node.properties,
                runtime_context=request.execution_context,
            )
            state.outputs[node.id] = output
            state.messages.append(f"Executed node {node.id} ({node.node_type})")

        return state

    def _index_inbound_connections(
        self,
        connections: List[RuntimeConnection],
    ) -> Dict[str, List[RuntimeConnection]]:
        inbound_connections: Dict[str, List[RuntimeConnection]] = defaultdict(list)
        for connection in connections:
            inbound_connections[connection.target_node_id].append(connection)
        return inbound_connections

    def _resolve_node_inputs(
        self,
        node_id: str,
        inbound_connections: Dict[str, List[RuntimeConnection]],
        outputs: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Any]:
        resolved: Dict[str, Any] = {}

        for connection in inbound_connections.get(node_id, []):
            source_output = outputs.get(connection.source_node_id, {})
            if connection.source_port_id not in source_output:
                continue

            value = source_output[connection.source_port_id]
            target_port_id = connection.target_port_id
            if target_port_id in resolved:
                existing = resolved[target_port_id]
                if isinstance(existing, list):
                    existing.append(value)
                else:
                    resolved[target_port_id] = [existing, value]
            else:
                resolved[target_port_id] = value

        return resolved
