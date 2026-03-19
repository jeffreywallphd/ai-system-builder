from app.mcp.client import McpConnectionError
from app.mcp.models import (
    ListMcpToolsResponse,
    McpConnectionStatus,
    McpServerConnectionRequest,
    McpServerConnectionResult,
    McpServerDescriptor,
    McpServerSearchRequest,
    McpServerSearchResponse,
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

        server_descriptors = self._sessions.list_servers()
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
        snapshots = [self._sessions.snapshot_server(server.id, connect=True) for server in self._registry.list_servers()] if self._registry.is_enabled() else []
        return McpSnapshot(status=self.get_status(), servers=snapshots)

    def list_servers(self) -> McpServerSearchResponse:
        status = self.get_status()
        return McpServerSearchResponse(
            query="",
            total_count=len(status.servers),
            limit=max(len(status.servers), 20),
            servers=status.servers,
            status=status,
        )

    def search_servers(self, request: McpServerSearchRequest) -> McpServerSearchResponse:
        status = self.get_status()
        query = request.query.strip().lower()
        statuses = {value for value in request.status}
        transports = {value for value in request.transport}
        bounded_limit = min(max(request.limit, 1), 50)

        def matches(server: McpServerDescriptor) -> bool:
            haystack = " ".join(
                [
                    server.id,
                    server.name,
                    server.transport,
                    server.status,
                    " ".join(f"{key}:{value}" for key, value in server.metadata.items()),
                ]
            ).lower()
            return (
                (not query or query in haystack)
                and (not statuses or server.status in statuses)
                and (not transports or server.transport in transports)
            )

        matches_list = [server for server in status.servers if matches(server)]
        return McpServerSearchResponse(
            query=request.query.strip(),
            total_count=len(matches_list),
            limit=bounded_limit,
            servers=matches_list[:bounded_limit],
            status=status,
        )

    def get_snapshot_for_server(self, server_id: str) -> McpServerDescriptor:
        normalized = server_id.strip()
        if not normalized:
            raise ValueError("MCP serverId is required.")
        return self._sessions.describe_server(normalized)

    def connect_server(self, request: McpServerConnectionRequest) -> McpServerConnectionResult:
        if not self._registry.is_enabled():
            raise RuntimeError("MCP runtime is disabled.")

        server = self._sessions.connect_server(request.server_id, reconnect=request.reconnect)
        return McpServerConnectionResult(
            action="reconnect" if request.reconnect else "connect",
            server=server,
            status=self.get_status(),
            checked_at=utc_timestamp(),
            metadata={"reconnect": request.reconnect},
        )

    def disconnect_server(self, server_id: str) -> McpServerConnectionResult:
        if not self._registry.is_enabled():
            raise RuntimeError("MCP runtime is disabled.")

        server = self._sessions.disconnect_server(server_id)
        return McpServerConnectionResult(
            action="disconnect",
            server=server,
            status=self.get_status(),
            checked_at=utc_timestamp(),
        )

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
