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
    McpToolDescriptor,
    McpToolExecutionRequest,
    McpToolExecutionResult,
    McpToolSearchRequest,
    McpToolSearchResponse,
    parse_mcp_tool_id,
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

        statuses = self._sessions.list_statuses()
        if not statuses:
            state = "unavailable"
        elif any(server.state == "error" for server in statuses):
            state = "degraded"
        else:
            state = "ready"

        return McpConnectionStatus(
            enabled=True,
            state=state,
            checked_at=utc_timestamp(),
            servers=statuses,
            capabilities={
                "tools": any(server.capabilities.get("tools", False) for server in statuses),
                "resources": any(server.capabilities.get("resources", False) for server in statuses),
                "toolExecution": any(server.capabilities.get("toolExecution", False) for server in statuses),
            },
            metadata={"configuredServerCount": len(statuses)},
        )

    def get_snapshot(self) -> McpSnapshot:
        snapshots = [self._sessions.snapshot_server(server.id, connect=True) for server in self._registry.list_servers()] if self._registry.is_enabled() else []
        return McpSnapshot(status=self.get_status(), servers=snapshots)

    def list_servers(self) -> McpServerSearchResponse:
        servers = self._sessions.list_servers() if self._registry.is_enabled() else []
        status = self.get_status()
        return McpServerSearchResponse(
            query="",
            total_count=len(servers),
            limit=max(len(servers), 20),
            servers=servers,
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

        matches_list = [server for server in self._sessions.list_servers() if matches(server)] if self._registry.is_enabled() else []
        return McpServerSearchResponse(
            query=request.query.strip(),
            total_count=len(matches_list),
            limit=bounded_limit,
            servers=matches_list[:bounded_limit],
            status=status,
        )

    def get_server_status(self, server_id: str):
        normalized = server_id.strip()
        if not normalized:
            raise ValueError("MCP serverId is required.")
        return self._sessions.get_server_status(normalized)

    def connect_server(self, request: McpServerConnectionRequest) -> McpServerConnectionResult:
        if request.reconnect:
            return self.reconnect_server(request.server_id)

        if not self._registry.is_enabled():
            raise RuntimeError("MCP runtime is disabled.")

        server = self._sessions.connect_server(request.server_id, reconnect=False)
        return McpServerConnectionResult(
            action="connect",
            server=server,
            status=self._sessions.get_server_status(request.server_id),
            runtime=self.get_status(),
            checked_at=utc_timestamp(),
            metadata={"reconnect": False},
        )

    def reconnect_server(self, server_id: str) -> McpServerConnectionResult:
        if not self._registry.is_enabled():
            raise RuntimeError("MCP runtime is disabled.")

        server = self._sessions.connect_server(server_id, reconnect=True)
        return McpServerConnectionResult(
            action="reconnect",
            server=server,
            status=self._sessions.get_server_status(server_id),
            runtime=self.get_status(),
            checked_at=utc_timestamp(),
            metadata={"reconnect": True},
        )

    def disconnect_server(self, server_id: str) -> McpServerConnectionResult:
        if not self._registry.is_enabled():
            raise RuntimeError("MCP runtime is disabled.")

        server = self._sessions.disconnect_server(server_id)
        return McpServerConnectionResult(
            action="disconnect",
            server=server,
            status=self._sessions.get_server_status(server_id),
            runtime=self.get_status(),
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

    def search_tools(self, request: McpToolSearchRequest) -> McpToolSearchResponse:
        bounded_limit = min(max(request.limit, 1), 50)
        server_ids = {value.strip() for value in request.server_ids if value.strip()}
        categories = {value.strip() for value in request.categories if value.strip()}
        tags = {value.strip() for value in request.tags if value.strip()}
        normalized_query = request.query.strip().lower()
        matches = [
            tool
            for tool in self.list_tools().tools
            if self._matches_tool(tool, normalized_query, server_ids, categories, tags)
        ]

        return McpToolSearchResponse(
            query=request.query.strip(),
            total_count=len(matches),
            limit=bounded_limit,
            tools=matches[:bounded_limit],
        )

    def get_tool_descriptor(self, tool_id: str) -> McpToolDescriptor:
        server_id, tool_name = parse_mcp_tool_id(tool_id)
        for tool in self.list_tools().tools:
            if tool.server_id == server_id and tool.name == tool_name:
                return tool
        raise ValueError(f"Unknown MCP tool '{tool_id.strip()}'.")

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

    def _matches_tool(
        self,
        tool: McpToolDescriptor,
        query: str,
        server_ids: set[str],
        categories: set[str],
        tags: set[str],
    ) -> bool:
        if server_ids and tool.server_id not in server_ids:
            return False
        if categories and not any(category in categories for category in tool.categories):
            return False
        if tags and not any(tag in tags for tag in tool.tags):
            return False
        if not query:
            return True

        haystack_parts = [
            tool.id,
            tool.server_id,
            tool.name,
            tool.title or "",
            tool.description or "",
            *tool.categories,
            *tool.tags,
            *(argument.name for argument in tool.arguments),
            *(argument.description or "" for argument in tool.arguments),
        ]
        haystack = " ".join(part for part in haystack_parts if part).lower()
        return query in haystack
