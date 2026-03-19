import uuid

from app.execution.node_dispatcher import NodeDispatcher
from app.execution.workflow_executor import WorkflowExecutor
from app.models.requests import ExecuteNodeRequest, ExecuteWorkflowRequest
from app.models.responses import ExecuteNodeResponse, ExecuteWorkflowResponse


class RuntimeService:
    def __init__(self, dispatcher: NodeDispatcher | None = None, workflow_executor: WorkflowExecutor | None = None) -> None:
        self._dispatcher = dispatcher or NodeDispatcher()
        self._workflow_executor = workflow_executor or WorkflowExecutor(self._dispatcher)

    def execute_node(self, request: ExecuteNodeRequest) -> ExecuteNodeResponse:
        execution_id = request.execution_id or f"node-{uuid.uuid4().hex[:10]}"

        try:
            outputs = self._dispatcher.dispatch(request.node_type, inputs=request.inputs, properties=request.properties)
            return ExecuteNodeResponse(
                execution_id=execution_id,
                node_id=request.node_id,
                status="completed",
                outputs=outputs,
                messages=[f"Executed node {request.node_id}"],
            )
        except Exception as error:
            return ExecuteNodeResponse(
                execution_id=execution_id,
                node_id=request.node_id,
                status="failed",
                outputs={},
                messages=[f"Failed node {request.node_id}"],
                error_message=str(error),
            )

    def execute_workflow(self, request: ExecuteWorkflowRequest) -> ExecuteWorkflowResponse:
        try:
            state = self._workflow_executor.execute(request)
            return ExecuteWorkflowResponse(
                execution_id=state.execution_id,
                workflow_id=state.workflow_id,
                status="completed",
                node_results=state.outputs,
                messages=state.messages,
            )
        except Exception as error:
            return ExecuteWorkflowResponse(
                execution_id=request.execution_id or f"wf-{uuid.uuid4().hex[:10]}",
                workflow_id=request.workflow_id,
                status="failed",
                node_results={},
                messages=[f"Failed workflow {request.workflow_id}"],
                error_message=str(error),
            )
