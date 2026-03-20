from app.mcp.client import BoundedMcpClient, McpConnectionError
from app.mcp.models import McpServerDescriptor, McpServerSnapshot, McpServerStatus
from app.mcp.registry import McpRegistry


class McpSessionManager:
    def __init__(self, registry: McpRegistry) -> None:
        self._registry = registry
        self._clients: dict[str, BoundedMcpClient] = {}

    def prime_connections(self) -> None:
        for server in self._registry.list_servers():
            if not self._registry.config.should_connect_on_startup(server):
                continue
            try:
                self.connect_server(server.id)
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

    def list_servers(self) -> list[McpServerDescriptor]:
        return [self.describe_server(server.id) for server in self._registry.list_servers()]

    def list_statuses(self) -> list[McpServerStatus]:
        return [self.get_server_status(server.id) for server in self._registry.list_servers()]

    def describe_server(self, server_id: str) -> McpServerDescriptor:
        client = self.get_client(server_id)
        return client.describe()

    def get_server_status(self, server_id: str) -> McpServerStatus:
        client = self.get_client(server_id)
        return client.status()

    def connect_server(self, server_id: str, reconnect: bool = False) -> McpServerDescriptor:
        client = self.get_client(server_id)
        client.connect(force=reconnect)
        return client.describe()

    def disconnect_server(self, server_id: str) -> McpServerDescriptor:
        client = self.get_client(server_id)
        client.disconnect()
        return client.describe()

    def reset_server(self, server_id: str) -> None:
        normalized = server_id.strip()
        client = self._clients.pop(normalized, None)
        if client is None:
            return
        try:
            client.disconnect()
        except McpConnectionError:
            return

    def snapshot_server(self, server_id: str, connect: bool = False) -> McpServerSnapshot:
        client = self.get_client(server_id)
        try:
            if connect:
                client.connect()
            descriptor = client.describe()
            tools = client.list_tools(allow_disconnected=not connect)
            resources = client.list_resources() if connect or client.is_connected else []
        except McpConnectionError:
            descriptor = client.describe()
            tools = client.list_tools(allow_disconnected=True)
            resources = []
        return McpServerSnapshot(server=descriptor, tools=tools, resources=resources)
