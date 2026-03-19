import pytest

from app.core.mcp_config import McpRuntimeConfig
from app.mcp.registry import McpRegistry
from app.mcp.service import McpService
from app.mcp.session import McpSessionManager
from app.mcp.models import McpServerConnectionRequest, McpServerSearchRequest, McpToolExecutionRequest


def build_service(config: McpRuntimeConfig) -> McpService:
    registry = McpRegistry(config)
    return McpService(registry=registry, sessions=McpSessionManager(registry))


def test_mcp_service_reports_disabled_status() -> None:
    service = build_service(McpRuntimeConfig())

    status = service.get_status()

    assert status.enabled is False
    assert status.state == "disabled"


def test_mcp_service_lists_configured_servers_without_forcing_connections() -> None:
    service = build_service(
        McpRuntimeConfig(
            enabled=True,
            servers_json='[{"id": "local", "name": "Local MCP", "transport": "stdio", "command": "python", "args": ["server.py"], "mock_tools": [{"name": "echo", "inputSchema": {"type": "object"}}], "mock_resources": [{"uri": "memory://doc", "name": "Doc"}]}]'
        )
    )

    response = service.list_servers()

    assert response.total_count == 1
    assert response.servers[0].status == "disconnected"
    assert response.servers[0].command == "python"
    assert response.servers[0].tool_count == 1


def test_mcp_service_searches_servers_with_bounded_filters() -> None:
    service = build_service(
        McpRuntimeConfig(
            enabled=True,
            servers_json='['
            '{"id": "local", "name": "Local MCP", "transport": "stdio", "command": "python", "metadata": {"scope": "workspace"}},'
            '{"id": "remote", "name": "Remote MCP", "transport": "http", "url": "http://localhost:9000/mcp", "metadata": {"scope": "cloud"}}'
            ']'
        )
    )

    response = service.search_servers(McpServerSearchRequest(query="local", transport=["stdio"], limit=99))

    assert response.total_count == 1
    assert response.limit == 50
    assert response.servers[0].id == "local"


def test_mcp_service_connects_disconnects_and_reconnects_server_lifecycle() -> None:
    service = build_service(
        McpRuntimeConfig(
            enabled=True,
            servers_json='[{"id": "local", "name": "Local MCP", "transport": "stdio", "command": "python", "args": ["server.py"], "mock_tools": [{"name": "echo", "inputSchema": {"type": "object"}}]}]'
        )
    )

    connected = service.connect_server(McpServerConnectionRequest(server_id="local"))
    disconnected = service.disconnect_server("local")
    reconnected = service.reconnect_server("local")

    assert connected.action == "connect"
    assert connected.server.status == "connected"
    assert connected.status.state == "connected"
    assert disconnected.action == "disconnect"
    assert disconnected.server.status == "disconnected"
    assert reconnected.action == "reconnect"
    assert reconnected.runtime.state == "ready"


def test_mcp_service_lists_tools_and_resources() -> None:
    service = build_service(
        McpRuntimeConfig(
            enabled=True,
            servers_json='[{"id": "local", "name": "Local MCP", "transport": "stdio", "command": "python", "args": ["server.py"], "mock_tools": [{"name": "echo", "inputSchema": {"type": "object"}}], "mock_resources": [{"uri": "memory://doc", "name": "Doc"}]}]'
        )
    )

    response = service.list_tools()

    assert response.status.state == "ready"
    assert len(response.tools) == 1
    assert response.tools[0].name == "echo"
    assert response.resources[0].uri == "memory://doc"
    assert response.resources[0].server_id == "local"


def test_mcp_service_executes_bounded_tool() -> None:
    service = build_service(
        McpRuntimeConfig(
            enabled=True,
            servers_json='[{"id": "local", "name": "Local MCP", "transport": "stdio", "command": "python", "args": ["server.py"], "mock_tools": [{"name": "sum_numbers", "inputSchema": {"type": "object"}}]}]'
        )
    )

    result = service.execute_tool(
        McpToolExecutionRequest(server_id="local", tool_name="sum_numbers", arguments={"numbers": [1, 2, 3]})
    )

    assert result.status == "completed"
    assert result.structured_content["total"] == 6


def test_mcp_service_degrades_when_a_server_cannot_connect() -> None:
    service = build_service(
        McpRuntimeConfig(
            enabled=True,
            servers_json='[{"id": "broken", "name": "Broken MCP", "transport": "stdio", "command": "python", "args": ["server.py"], "fail_connect": true, "mock_tools": [{"name": "echo"}]}]'
        )
    )

    with pytest.raises(RuntimeError):
        service.connect_server(McpServerConnectionRequest(server_id="broken", reconnect=True))

    status = service.get_status()

    assert status.state == "degraded"
    assert status.servers[0].state == "error"
