import json
import pytest

from app.core.mcp_config import McpRuntimeConfig
from app.mcp.registry import McpRegistry
from app.mcp.service import McpService
from app.mcp.session import McpSessionManager
from app.mcp.models import McpServerConnectionRequest, McpServerSearchRequest, McpToolExecutionRequest, McpToolSearchRequest


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
            servers_json='[{"id": "local", "name": "Local MCP", "transport": "stdio", "command": "python", "args": ["server.py"], "mock_tools": [{"name": "echo", "description": "Echo text.", "inputSchema": {"type": "object", "required": ["message"], "properties": {"message": {"type": "string", "description": "Message"}}}, "metadata": {"category": "utility", "tags": ["text"]}}], "mock_resources": [{"uri": "memory://doc", "name": "Doc"}]}]'
        )
    )

    response = service.list_tools()

    assert response.status.state == "ready"
    assert len(response.tools) == 1
    assert response.tools[0].name == "echo"
    assert response.tools[0].id == "mcp:local:echo"
    assert response.tools[0].arguments[0].name == "message"
    assert response.tools[0].categories == ["utility"]
    assert response.tools[0].tags == ["text"]
    assert response.resources[0].uri == "memory://doc"
    assert response.resources[0].server_id == "local"


def test_mcp_service_searches_tools_with_filters() -> None:
    service = build_service(
        McpRuntimeConfig(
            enabled=True,
            servers_json='[{"id": "local", "name": "Local MCP", "transport": "stdio", "command": "python", "args": ["server.py"], "mock_tools": [{"name": "echo", "description": "Echo text.", "inputSchema": {"type": "object", "properties": {"message": {"type": "string"}}}, "metadata": {"category": "utility", "tags": ["text"]}}, {"name": "search_docs", "description": "Search docs.", "inputSchema": {"type": "object", "properties": {"query": {"type": "string"}}}, "metadata": {"category": "knowledge", "tags": ["docs", "search"]}}]}]'
        )
    )

    response = service.search_tools(
        McpToolSearchRequest(query="docs", server_ids=["local"], categories=["knowledge"], tags=["search"], limit=25)
    )

    assert response.query == "docs"
    assert response.limit == 25
    assert response.total_count == 1
    assert response.tools[0].name == "search_docs"


def test_mcp_service_gets_tool_descriptor_by_stable_id() -> None:
    service = build_service(
        McpRuntimeConfig(
            enabled=True,
            servers_json='[{"id": "local", "name": "Local MCP", "transport": "stdio", "command": "python", "args": ["server.py"], "mock_tools": [{"name": "echo", "inputSchema": {"type": "object"}}]}]'
        )
    )

    descriptor = service.get_tool_descriptor("mcp:local:echo")

    assert descriptor.server_id == "local"
    assert descriptor.name == "echo"


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


def test_mcp_service_executes_default_calculator_tool() -> None:
    service = build_service(
        McpRuntimeConfig(
            enabled=True,
            servers_json='[{"id": "local-calculator", "name": "Local Calculator", "transport": "stdio", "command": "python", "args": ["server.py"], "metadata": {"serverKind": "workspace-local"}, "mock_tools": [{"name": "calculate", "inputSchema": {"type": "object", "required": ["operation", "left", "right"], "properties": {"operation": {"type": "string"}, "left": {"type": "number"}, "right": {"type": "number"}}}}]}]'
        )
    )

    result = service.execute_tool(
        McpToolExecutionRequest(
            server_id="local-calculator",
            tool_name="calculate",
            arguments={"operation": "multiply", "left": 6, "right": 7},
        )
    )

    assert result.status == "completed"
    assert result.structured_content["result"] == 42
    assert result.metadata["serverKind"] == "workspace-local"


def test_mcp_service_executes_workspace_local_authored_tool(tmp_path) -> None:
    state_file = tmp_path / "workspace-helper" / ".provisioned.json"
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(
        json.dumps(
            {
                "serverId": "workspace-helper",
                "toolName": "summarize_notes",
                "code": 'return {"summary": payload.get("input", "").upper(), "length": len(payload.get("input", ""))}',
            }
        ),
        encoding="utf-8",
    )

    service = build_service(
        McpRuntimeConfig(
            enabled=True,
            servers_json=json.dumps(
                [
                    {
                        "id": "workspace-helper",
                        "name": "Workspace Helper",
                        "transport": "stdio",
                        "command": "python",
                        "args": ["server.py"],
                        "metadata": {
                            "serverKind": "workspace-local",
                            "provisioningStateFile": str(state_file),
                        },
                        "mock_tools": [{"name": "summarize_notes", "inputSchema": {"type": "object"}}],
                    }
                ]
            ),
        )
    )

    result = service.execute_tool(
        McpToolExecutionRequest(
            server_id="workspace-helper",
            tool_name="summarize_notes",
            arguments={"input": "release notes"},
        )
    )

    assert result.status == "completed"
    assert result.structured_content["summary"] == "RELEASE NOTES"
    assert result.structured_content["length"] == 13
    assert result.metadata["serverKind"] == "workspace-local"


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
