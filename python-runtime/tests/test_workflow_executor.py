from app.core.mcp_config import McpRuntimeConfig
from app.execution.node_dispatcher import NodeDispatcher
from app.execution.workflow_executor import WorkflowExecutor
from app.mcp.registry import McpRegistry
from app.mcp.service import McpService
from app.mcp.session import McpSessionManager
from app.models.requests import ExecuteWorkflowRequest
from app.models.runtime import RuntimeConnection, RuntimeNode


def build_mcp_dispatcher() -> NodeDispatcher:
    config = McpRuntimeConfig(
        enabled=True,
        servers_json='[{"id": "local", "name": "Local MCP", "transport": "inmemory", "mock_tools": [{"name": "echo", "inputSchema": {"type": "object"}}, {"name": "sum_numbers", "inputSchema": {"type": "object"}}]}]',
    )
    registry = McpRegistry(config)
    return NodeDispatcher(mcp_service=McpService(registry=registry, sessions=McpSessionManager(registry)))



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



def test_workflow_executor_routes_connected_outputs_into_mcp_nodes() -> None:
    executor = WorkflowExecutor(build_mcp_dispatcher())
    request = ExecuteWorkflowRequest(
        workflow_id='wf-mcp',
        nodes=[
            RuntimeNode(id='server', node_type='mcp.server_select', properties={'serverId': 'local'}),
            RuntimeNode(id='catalog', node_type='mcp.tool_catalog', properties={'searchQuery': 'echo'}),
            RuntimeNode(id='call', node_type='mcp.tool_call', properties={'stringifyResult': True}),
        ],
        connections=[
            RuntimeConnection(
                source_node_id='server',
                source_port_id='serverHandle',
                target_node_id='catalog',
                target_port_id='serverHandle',
            ),
            RuntimeConnection(
                source_node_id='server',
                source_port_id='serverHandle',
                target_node_id='call',
                target_port_id='serverHandle',
            ),
            RuntimeConnection(
                source_node_id='catalog',
                source_port_id='tools',
                target_node_id='call',
                target_port_id='tool',
            )
        ],
        workflow_inputs={'arguments': {'message': 'hello from workflow'}},
    )

    state = executor.execute(request)

    assert state.outputs['server']['serverHandle']['serverId'] == 'local'
    assert len(state.outputs['catalog']['tools']) == 1
    assert state.outputs['catalog']['tools'][0]['source']['toolName'] == 'echo'
    assert state.outputs['call']['toolResult']['status'] == 'completed'
    assert state.outputs['call']['toolResult']['toolName'] == 'echo'
    assert state.outputs['call']['resultText']


def test_workflow_executor_runs_simple_agent_with_mcp_tool_capabilities() -> None:
    executor = WorkflowExecutor(build_mcp_dispatcher())
    request = ExecuteWorkflowRequest(
        workflow_id='wf-agent-mcp',
        nodes=[
            RuntimeNode(id='server', node_type='mcp.server_select', properties={'serverId': 'local'}),
            RuntimeNode(id='catalog', node_type='mcp.tool_catalog', properties={'searchQuery': 'echo'}),
            RuntimeNode(id='agent', node_type='langchain.simple_agent', properties={'model': 'workflow-agent', 'maxIterations': 1, 'verbose': True}),
        ],
        connections=[
            RuntimeConnection(
                source_node_id='server',
                source_port_id='serverHandle',
                target_node_id='catalog',
                target_port_id='serverHandle',
            ),
            RuntimeConnection(
                source_node_id='catalog',
                source_port_id='tools',
                target_node_id='agent',
                target_port_id='tools',
            ),
        ],
        workflow_inputs={
            'input': 'Please echo this through the workflow agent.',
            'selectedTools': ['mcp:local:echo'],
        },
    )

    state = executor.execute(request)

    assert state.outputs['agent']['selectedTools'][0]['capabilityId'] == 'mcp:local:echo'
    assert state.outputs['agent']['toolResults'][0]['provider']['kind'] == 'mcp'
    assert state.outputs['agent']['toolResults'][0]['source']['serverId'] == 'local'
    assert state.outputs['agent']['stepResults'][0]['invocationArguments'] == {'input': 'Please echo this through the workflow agent.'}
    assert state.outputs['agent']['trace']['stoppedReason'] == 'max-iterations-reached'
