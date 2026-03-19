from app.core.mcp_config import McpRuntimeConfig
from app.mcp.registry import McpRegistry
from app.mcp.service import McpService
from app.mcp.session import McpSessionManager
from app.mcp.models import McpToolExecutionRequest


def build_service(config: McpRuntimeConfig) -> McpService:
    registry = McpRegistry(config)
    return McpService(registry=registry, sessions=McpSessionManager(registry))


def test_mcp_service_reports_disabled_status() -> None:
    service = build_service(McpRuntimeConfig())

    status = service.get_status()

    assert status.enabled is False
    assert status.state == "disabled"


def test_mcp_service_lists_tools_and_resources() -> None:
    service = build_service(
        McpRuntimeConfig(
            enabled=True,
            servers_json='[{"id": "local", "name": "Local MCP", "transport": "inmemory", "mock_tools": [{"name": "echo", "inputSchema": {"type": "object"}}], "mock_resources": [{"uri": "memory://doc", "name": "Doc"}]}]'
        )
    )

    response = service.list_tools()

    assert response.status.state == "ready"
    assert len(response.tools) == 1
    assert response.tools[0].name == "echo"
    assert response.resources[0]["uri"] == "memory://doc"


def test_mcp_service_executes_bounded_tool() -> None:
    service = build_service(
        McpRuntimeConfig(
            enabled=True,
            servers_json='[{"id": "local", "name": "Local MCP", "transport": "inmemory", "mock_tools": [{"name": "sum_numbers", "inputSchema": {"type": "object"}}]}]'
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
            servers_json='[{"id": "broken", "name": "Broken MCP", "transport": "inmemory", "fail_connect": true, "mock_tools": [{"name": "echo"}]}]'
        )
    )

    status = service.get_status()

    assert status.state == "degraded"
    assert status.servers[0].status == "error"
