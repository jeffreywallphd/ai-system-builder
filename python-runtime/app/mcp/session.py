from app.mcp.client import BoundedMcpClient, McpConnectionError
from app.mcp.models import McpServerDescriptor, McpServerSnapshot
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

    def describe_server(self, server_id: str) -> McpServerDescriptor:
        client = self.get_client(server_id)
        return client.describe()

    def connect_server(self, server_id: str, reconnect: bool = False) -> McpServerDescriptor:
        client = self.get_client(server_id)
        if reconnect and client.is_connected:
            client.disconnect()
        return client.connect(force=reconnect)

    def disconnect_server(self, server_id: str) -> McpServerDescriptor:
        client = self.get_client(server_id)
        return client.disconnect()

    def snapshot_server(self, server_id: str, connect: bool = False) -> McpServerSnapshot:
        client = self.get_client(server_id)
        try:
            descriptor = client.connect() if connect else client.describe()
            tools = client.list_tools(allow_disconnected=not connect)
            resources = client.list_resources() if connect or client.is_connected else []
        except McpConnectionError as error:
            descriptor = client.describe(status="error", error_message=str(error))
            tools = client.list_tools(allow_disconnected=True)
            resources = []
        return McpServerSnapshot(server=descriptor, tools=tools, resources=resources)
