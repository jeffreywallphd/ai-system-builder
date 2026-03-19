from app.mcp.client import BoundedMcpClient, McpConnectionError
from app.mcp.models import McpServerSnapshot
from app.mcp.registry import McpRegistry


class McpSessionManager:
    def __init__(self, registry: McpRegistry) -> None:
        self._registry = registry
        self._clients: dict[str, BoundedMcpClient] = {}

    def prime_connections(self) -> None:
        if not self._registry.config.connect_on_startup:
            return

        for server in self._registry.list_servers():
            try:
                self.get_client(server.id).connect()
            except McpConnectionError:
                continue

    def get_client(self, server_id: str) -> BoundedMcpClient:
        normalized = server_id.strip()
        if normalized not in self._clients:
            server = self._registry.get_server(normalized)
            if server is None:
                raise ValueError(f"Unknown MCP server '{normalized}'.")
            self._clients[normalized] = BoundedMcpClient(server)
        return self._clients[normalized]

    def snapshot_server(self, server_id: str) -> McpServerSnapshot:
        client = self.get_client(server_id)
        try:
            descriptor = client.connect()
            tools = client.list_tools(allow_disconnected=True)
            resources = client.list_resources()
        except McpConnectionError as error:
            descriptor = client.describe(status="error", error_message=str(error))
            tools = client.list_tools(allow_disconnected=True)
            resources = []
        return McpServerSnapshot(server=descriptor, tools=tools, resources=resources)
