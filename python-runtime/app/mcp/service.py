from app.mcp.client import McpConnectionError
from app.mcp.models import (
    ListMcpToolsResponse,
    McpConnectionStatus,
    McpSnapshot,
    McpToolExecutionRequest,
    McpToolExecutionResult,
    utc_timestamp,
)
from app.mcp.registry import McpRegistry
from app.mcp.session import McpSessionManager


class McpService:
    def __init__(self, registry: McpRegistry, sessions: McpSessionManager | None = None) -> None:
        self._registry = registry
        self._sessions = sessions or McpSessionManager(registry)
        self._sessions.prime_connections()

    def get_status(self) -> McpConnectionStatus:
        if not self._registry.is_enabled():
            return McpConnectionStatus(
                enabled=False,
                state="disabled",
                checked_at=utc_timestamp(),
                servers=[],
                capabilities={"tools": False, "resources": False, "toolExecution": False},
                metadata={"configuredServerCount": 0},
            )

        snapshots = [self._sessions.snapshot_server(server.id) for server in self._registry.list_servers()]
        server_descriptors = [snapshot.server for snapshot in snapshots]
        has_error = any(server.status == "error" for server in server_descriptors)
        state = "degraded" if has_error and server_descriptors else "ready"
        if not server_descriptors:
            state = "unavailable"

        return McpConnectionStatus(
            enabled=True,
            state=state,
            checked_at=utc_timestamp(),
            servers=server_descriptors,
            capabilities={
                "tools": any(server.capabilities.get("tools", False) for server in server_descriptors),
                "resources": any(server.capabilities.get("resources", False) for server in server_descriptors),
                "toolExecution": any(server.capabilities.get("toolExecution", False) for server in server_descriptors),
            },
            metadata={"configuredServerCount": len(server_descriptors)},
        )

    def get_snapshot(self) -> McpSnapshot:
        snapshots = [self._sessions.snapshot_server(server.id) for server in self._registry.list_servers()] if self._registry.is_enabled() else []
        return McpSnapshot(status=self.get_status(), servers=snapshots)

    def list_tools(self) -> ListMcpToolsResponse:
        snapshot = self.get_snapshot()
        tools = [tool for server in snapshot.servers for tool in server.tools]
        resources = [resource for server in snapshot.servers for resource in server.resources]
        return ListMcpToolsResponse(
            status=snapshot.status,
            tools=tools,
            resources=resources,
            capabilities=snapshot.status.capabilities,
        )

    def execute_tool(self, request: McpToolExecutionRequest) -> McpToolExecutionResult:
        if not self._registry.is_enabled():
            return McpToolExecutionResult(
                execution_id=request.execution_id or "mcp-disabled",
                server_id=request.server_id,
                tool_name=request.tool_name,
                status="failed",
                content=[],
                structured_content={},
                error_message="MCP runtime is disabled.",
            )

        try:
            client = self._sessions.get_client(request.server_id)
            return client.execute_tool(request)
        except (ValueError, McpConnectionError) as error:
            return McpToolExecutionResult(
                execution_id=request.execution_id or "mcp-failed",
                server_id=request.server_id,
                tool_name=request.tool_name,
                status="failed",
                content=[],
                structured_content={},
                error_message=str(error),
            )
