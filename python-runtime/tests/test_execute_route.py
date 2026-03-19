from fastapi.testclient import TestClient

from app.api.dependencies import get_runtime_service
from app.core.mcp_config import McpRuntimeConfig
from app.execution.node_dispatcher import NodeDispatcher
from app.execution.workflow_executor import WorkflowExecutor
from app.main import app
from app.mcp.registry import McpRegistry
from app.mcp.service import McpService
from app.mcp.session import McpSessionManager
from app.services.runtime_service import RuntimeService


def build_runtime_service() -> RuntimeService:
    config = McpRuntimeConfig(
        enabled=True,
        servers_json='[{"id": "local", "name": "Local MCP", "transport": "inmemory", "mock_tools": [{"name": "echo", "inputSchema": {"type": "object"}}, {"name": "sum_numbers", "inputSchema": {"type": "object"}}]}]',
    )
    registry = McpRegistry(config)
    mcp_service = McpService(registry=registry, sessions=McpSessionManager(registry))
    dispatcher = NodeDispatcher(mcp_service=mcp_service)
    return RuntimeService(dispatcher=dispatcher, workflow_executor=WorkflowExecutor(dispatcher))


def test_execute_node_route_prompt_template() -> None:
    client = TestClient(app)
    response = client.post('/execute/node', json={
        'node_id': 'n1',
        'node_type': 'langchain.prompt_template',
        'properties': {'template': 'Hello {name}'},
        'inputs': {'variables': {'name': 'Loom'}},
    })

    assert response.status_code == 200
    payload = response.json()
    assert payload['outputs']['formatted_prompt'] == 'Hello Loom'



def test_execute_node_route_context_merger() -> None:
    client = TestClient(app)
    response = client.post('/execute/node', json={
        'node_id': 'n2',
        'node_type': 'langchain.context_merger',
        'properties': {'separator': ' | '},
        'inputs': {'context_blocks': ['a', 'b', 'c']},
    })

    assert response.status_code == 200
    payload = response.json()
    assert payload['outputs']['merged_context'] == 'a | b | c'
    assert payload['outputs']['block_count'] == 3



def test_execute_node_route_retrieval_qa_returns_sources() -> None:
    client = TestClient(app)
    response = client.post('/execute/node', json={
        'node_id': 'n3',
        'node_type': 'langchain.retrieval_qa',
        'properties': {'strategy': 'stuff', 'topK': 2, 'includeSources': True},
        'inputs': {
            'query': 'What is retrieval QA?',
            'knowledgeBase': {
                'records': [
                    {'id': 'doc-1', 'text': 'Retrieval QA finds documents before answering.'},
                    {'id': 'doc-2', 'text': 'Sources can be returned with the answer.'},
                ],
            },
            'model': {'id': 'route-qa-model'},
        },
    })

    assert response.status_code == 200
    payload = response.json()
    assert payload['outputs']['answer'].startswith('[route-qa-model]')
    assert len(payload['outputs']['sources']) == 2



def test_execute_node_route_chat_prompt_builder_returns_prompt_object() -> None:
    client = TestClient(app)
    response = client.post('/execute/node', json={
        'node_id': 'n4',
        'node_type': 'langchain.chat_prompt_builder',
        'properties': {'includeContext': True, 'contextLabel': 'Context', 'userLabel': 'User'},
        'inputs': {
            'systemMessage': 'You are helpful.',
            'userMessage': 'Summarize the workflow.',
            'context': 'The workflow includes retriever and QA nodes.',
        },
    })

    assert response.status_code == 200
    payload = response.json()
    assert payload['outputs']['prompt']['type'] == 'chat_prompt_builder'
    assert payload['outputs']['messages'][0]['role'] == 'system'



def test_execute_node_route_mcp_server_select_returns_server_handle() -> None:
    app.dependency_overrides[get_runtime_service] = build_runtime_service
    client = TestClient(app)

    response = client.post('/execute/node', json={
        'node_id': 'mcp-server',
        'node_type': 'mcp.server_select',
        'properties': {'serverId': 'local'},
        'inputs': {},
    })

    app.dependency_overrides.clear()
    assert response.status_code == 200
    payload = response.json()
    assert payload['status'] == 'completed'
    assert payload['outputs']['serverHandle']['kind'] == 'mcp-server-handle'
    assert payload['outputs']['serverHandle']['serverId'] == 'local'
    assert payload['outputs']['connectionStatus']['enabled'] is True



def test_execute_node_route_mcp_tool_catalog_returns_capability_aligned_tools() -> None:
    app.dependency_overrides[get_runtime_service] = build_runtime_service
    client = TestClient(app)

    response = client.post('/execute/node', json={
        'node_id': 'mcp-catalog',
        'node_type': 'mcp.tool_catalog',
        'properties': {'searchQuery': 'sum'},
        'inputs': {
            'serverHandle': {'serverId': 'local'},
        },
    })

    app.dependency_overrides.clear()
    assert response.status_code == 200
    payload = response.json()
    assert payload['status'] == 'completed'
    assert len(payload['outputs']['tools']) == 1
    assert payload['outputs']['tools'][0]['provider']['kind'] == 'mcp'
    assert payload['outputs']['tools'][0]['source']['serverId'] == 'local'
    assert payload['outputs']['tools'][0]['source']['toolName'] == 'sum_numbers'



def test_execute_node_route_mcp_tool_call_executes_selected_tool() -> None:
    app.dependency_overrides[get_runtime_service] = build_runtime_service
    client = TestClient(app)

    response = client.post('/execute/node', json={
        'node_id': 'mcp-call',
        'node_type': 'mcp.tool_call',
        'properties': {'stringifyResult': True, 'failOnMissingArgs': True},
        'inputs': {
            'serverHandle': {'serverId': 'local'},
            'tool': {
                'id': 'mcp:local:sum_numbers',
                'routingName': 'sum_numbers',
                'provider': {'kind': 'mcp', 'id': 'python-mcp-runtime', 'label': 'MCP Tools'},
                'source': {'serverId': 'local', 'toolName': 'sum_numbers'},
                'inputSchema': {'type': 'object', 'required': ['numbers']},
            },
            'arguments': {'numbers': [5, 7]},
        },
    })

    app.dependency_overrides.clear()
    assert response.status_code == 200
    payload = response.json()
    assert payload['status'] == 'completed'
    assert payload['outputs']['toolResult']['structuredContent']['total'] == 12
    assert payload['outputs']['toolResult']['toolName'] == 'sum_numbers'
    assert payload['outputs']['resultText'] == '{"total": 12}'


def test_execute_node_route_mcp_tool_call_uses_schema_materialized_property_arguments() -> None:
    app.dependency_overrides[get_runtime_service] = build_runtime_service
    client = TestClient(app)

    response = client.post('/execute/node', json={
        'node_id': 'mcp-call-properties',
        'node_type': 'mcp.tool_call',
        'properties': {
            'serverId': 'local',
            'toolName': 'sum_numbers',
            'toolDescriptor': {
                'id': 'mcp:local:sum_numbers',
                'serverId': 'local',
                'source': {'serverId': 'local', 'toolName': 'sum_numbers'},
                'inputSchema': {'type': 'object', 'required': ['numbers']},
            },
            'arg.numbers': [2, 3, 7],
            'stringifyResult': True,
            'failOnMissingArgs': True,
        },
        'inputs': {},
    })

    app.dependency_overrides.clear()
    assert response.status_code == 200
    payload = response.json()
    assert payload['status'] == 'completed'
    assert payload['outputs']['toolResult']['structuredContent']['total'] == 12
    assert payload['outputs']['toolResult']['toolName'] == 'sum_numbers'
    assert payload['outputs']['resultText'] == '{"total": 12}'



def test_execute_node_route_mcp_tool_call_validates_required_args() -> None:
    app.dependency_overrides[get_runtime_service] = build_runtime_service
    client = TestClient(app)

    response = client.post('/execute/node', json={
        'node_id': 'mcp-call-missing',
        'node_type': 'mcp.tool_call',
        'properties': {'stringifyResult': True, 'failOnMissingArgs': True},
        'inputs': {
            'serverHandle': {'serverId': 'local'},
            'tool': {
                'id': 'mcp:local:sum_numbers',
                'source': {'serverId': 'local', 'toolName': 'sum_numbers'},
                'inputSchema': {'type': 'object', 'required': ['numbers']},
            },
            'arguments': {},
        },
    })

    app.dependency_overrides.clear()
    assert response.status_code == 200
    payload = response.json()
    assert payload['status'] == 'failed'
    assert 'missing required arguments' in payload['error_message']


def test_execute_node_route_simple_agent_returns_bounded_step_results() -> None:
    app.dependency_overrides[get_runtime_service] = build_runtime_service
    client = TestClient(app)

    response = client.post('/execute/node', json={
        'node_id': 'agent-1',
        'node_type': 'langchain.simple_agent',
        'properties': {'model': 'route-agent', 'maxIterations': 1, 'verbose': True},
        'inputs': {
            'input': 'Please echo this through MCP.',
            'tools': [
                {
                    'id': 'mcp:local:echo',
                    'displayName': 'Local Echo',
                    'description': 'Echo text through MCP.',
                    'provider': {'kind': 'mcp', 'id': 'python-mcp-runtime', 'label': 'MCP Tools'},
                    'source': {'serverId': 'local', 'toolName': 'echo'},
                },
            ],
            'selectedTools': ['mcp:local:echo'],
        },
    })

    app.dependency_overrides.clear()
    assert response.status_code == 200
    payload = response.json()
    assert payload['outputs']['stepResults'][0]['provider']['kind'] == 'mcp'
    assert payload['outputs']['toolResults'][0]['source']['serverId'] == 'local'
    assert payload['outputs']['trace']['iterationCount'] == 1
