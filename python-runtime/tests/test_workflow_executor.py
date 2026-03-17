from app.execution.workflow_executor import WorkflowExecutor
from app.models.requests import ExecuteWorkflowRequest
from app.models.runtime import RuntimeNode


def test_workflow_executor_runs_nodes() -> None:
    executor = WorkflowExecutor()
    request = ExecuteWorkflowRequest(
        workflow_id='wf-1',
        workflow_inputs={'variables': {'name': 'Studio'}},
        nodes=[
            RuntimeNode(
                id='n1',
                node_type='langchain.prompt_template',
                properties={'template': 'Hello {name}'},
            )
        ],
    )

    state = executor.execute(request)
    assert 'n1' in state.outputs
    assert state.outputs['n1']['formatted_prompt'] == 'Hello Studio'
