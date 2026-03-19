from app.core.mcp_config import McpRuntimeConfig, McpServerConfig


class McpRegistry:
    def __init__(self, config: McpRuntimeConfig) -> None:
        self._config = config

    @property
    def config(self) -> McpRuntimeConfig:
        return self._config

    def is_enabled(self) -> bool:
        return self._config.enabled

    def list_servers(self) -> list[McpServerConfig]:
        return [server for server in self._config.servers if server.enabled]

    def get_server(self, server_id: str) -> McpServerConfig | None:
        normalized = server_id.strip()
        for server in self._config.servers:
            if server.id == normalized and server.enabled:
                return server
        return None

    def is_configured(self, server_id: str) -> bool:
        normalized = server_id.strip()
        return any(server.id == normalized for server in self._config.servers)
