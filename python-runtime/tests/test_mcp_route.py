from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.api.dependencies import get_mcp_service
from app.core.mcp_config import McpRuntimeConfig
from app.mcp.provisioning import LocalMcpServerProvisioner
from app.mcp.registry import McpRegistry
from app.mcp.service import McpService
from app.mcp.session import McpSessionManager


class RecordingInstallRunner:
    def __init__(self) -> None:
        self.calls: list[tuple[list[str], Path]] = []

    def __call__(self, command: list[str], cwd: Path) -> None:
        self.calls.append((command, cwd))


def override_service() -> McpService:
    config = McpRuntimeConfig(
        enabled=True,
        servers_json='['
        '{"id": "local", "name": "Local MCP", "transport": "stdio", "command": "python", "args": ["server.py"], "mock_tools": [{"name": "echo", "description": "Echo text.", "inputSchema": {"type": "object", "required": ["message"], "properties": {"message": {"type": "string", "description": "Message"}}}, "metadata": {"category": "utility", "tags": ["text"]}}, {"name": "sum_numbers", "inputSchema": {"type": "object"}}], "mock_resources": [{"uri": "memory://resource/1", "name": "Example Resource"}], "metadata": {"scope": "workspace"}},'
        '{"id": "remote", "name": "Remote MCP", "transport": "http", "url": "http://localhost:9000/mcp", "metadata": {"scope": "cloud"}}'
        ']'
    )
    registry = McpRegistry(config)
    provisioner = LocalMcpServerProvisioner(
        workspace_root=Path('/tmp/ai-loom-mcp-tests'),
        python_executable='python',
        install_runner=RecordingInstallRunner(),
    )
    return McpService(registry=registry, sessions=McpSessionManager(registry), provisioner=provisioner)


def test_mcp_status_route() -> None:
    app.dependency_overrides[get_mcp_service] = override_service
    client = TestClient(app)

    response = client.get('/mcp/status')

    app.dependency_overrides.clear()
    assert response.status_code == 200
    payload = response.json()
    assert payload['enabled'] is True
    assert payload['state'] == 'ready'
    assert payload['servers'][0]['serverId'] == 'local'
    assert payload['servers'][0]['state'] == 'disconnected'


def test_mcp_servers_route_lists_configured_servers() -> None:
    app.dependency_overrides[get_mcp_service] = override_service
    client = TestClient(app)

    response = client.get('/mcp/servers')

    app.dependency_overrides.clear()
    assert response.status_code == 200
    payload = response.json()
    assert payload['totalCount'] == 2
    assert payload['servers'][0]['id'] == 'local'
    assert payload['servers'][0]['command'] == 'python'


def test_mcp_connect_disconnect_and_reconnect_routes_manage_lifecycle() -> None:
    app.dependency_overrides[get_mcp_service] = override_service
    client = TestClient(app)

    connect_response = client.post('/mcp/servers/connect', json={'serverId': 'local'})
    disconnect_response = client.post('/mcp/servers/disconnect', json={'serverId': 'local'})
    reconnect_response = client.post('/mcp/servers/reconnect', json={'serverId': 'local'})

    app.dependency_overrides.clear()
    assert connect_response.status_code == 200
    assert disconnect_response.status_code == 200
    assert reconnect_response.status_code == 200
    assert connect_response.json()['server']['status'] == 'connected'
    assert disconnect_response.json()['status']['state'] == 'disconnected'
    assert reconnect_response.json()['action'] == 'reconnect'


def test_mcp_local_server_route_provisions_a_workspace_server() -> None:
    app.dependency_overrides[get_mcp_service] = override_service
    client = TestClient(app)

    response = client.post(
        '/mcp/servers/local',
        json={
            'serverId': 'workspace-helper',
            'serverName': 'Workspace Helper',
            'serverDescription': 'Local helper.',
            'toolName': 'summarize_notes',
            'toolTitle': 'Summarize Notes',
            'toolDescription': 'Summarize notes.',
            'inputSchema': {'type': 'object'},
            'outputSchema': {'type': 'object'},
            'code': 'return {"summary": payload.get("input", "")}',
            'connectOnStartup': False,
        },
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    payload = response.json()
    assert payload['server']['id'] == 'workspace-helper'
    assert payload['created'] is True
    assert payload['metadata']['serverKind'] == 'workspace-local'


def test_mcp_tools_route_lists_tools_and_resources() -> None:
    app.dependency_overrides[get_mcp_service] = override_service
    client = TestClient(app)

    response = client.get('/mcp/tools')

    app.dependency_overrides.clear()
    assert response.status_code == 200
    payload = response.json()
    assert payload['tools'][0]['id'] == 'mcp:local:echo'
    assert payload['tools'][0]['arguments'][0]['name'] == 'message'
    assert payload['resources'][0]['uri'] == 'memory://resource/1'
    assert payload['resources'][0]['serverId'] == 'local'
