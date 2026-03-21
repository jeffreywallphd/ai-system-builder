from __future__ import annotations

from app.core.mcp_config import McpRuntimeConfig, McpServerConfig
from app.mcp.persistence import McpDefinitionRepository


class McpRegistry:
    def __init__(self, config: McpRuntimeConfig, repository: McpDefinitionRepository | None = None) -> None:
        self._config = config
        self._repository = repository
        self._dynamic_servers: dict[str, McpServerConfig] = {}

    @property
    def config(self) -> McpRuntimeConfig:
        return self._config

    def is_enabled(self) -> bool:
        return self._config.enabled

    def list_servers(self) -> list[McpServerConfig]:
        return [server for server in self._merged_servers() if server.enabled]

    def get_server(self, server_id: str) -> McpServerConfig | None:
        normalized = server_id.strip()
        for server in self._merged_servers():
            if server.id == normalized and server.enabled:
                return server
        return None

    def is_configured(self, server_id: str) -> bool:
        normalized = server_id.strip()
        return any(server.id == normalized for server in self._merged_servers())

    def upsert_server(self, server: McpServerConfig, persist: bool = True) -> McpServerConfig:
        self._dynamic_servers[server.id] = server
        if persist and self._repository is not None and server.source_type != "builtin-local":
            self._repository.upsert(server)
        return server

    def delete_server(self, server_id: str) -> bool:
        normalized = server_id.strip()
        self._dynamic_servers.pop(normalized, None)
        deleted = False
        if self._repository is not None:
            deleted = self._repository.delete(normalized)
        return deleted

    def _merged_servers(self) -> list[McpServerConfig]:
        merged = {server.id: server for server in self._config.servers}
        if self._repository is not None:
            for server in self._repository.list():
                merged[server.id] = server
        merged.update(self._dynamic_servers)
        return list(merged.values())
