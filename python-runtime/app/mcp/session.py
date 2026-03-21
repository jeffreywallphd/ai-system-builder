from __future__ import annotations

from collections import defaultdict

from app.mcp.client import McpConnectionError, RuntimeMcpClient
from app.mcp.models import (
    McpServerDiagnosticsEntry,
    McpServerDiagnosticsSnapshot,
    McpServerSnapshot,
    McpToolInvocationTrace,
    utc_timestamp,
)
from app.mcp.registry import McpRegistry


class McpSessionManager:
    def __init__(self, registry: McpRegistry) -> None:
        self._registry = registry
        self._clients: dict[str, RuntimeMcpClient] = {}
        self._diagnostics: dict[str, list[McpServerDiagnosticsEntry]] = defaultdict(list)

    def prime_connections(self) -> None:
        for server in self._registry.list_servers():
            if not self._registry.config.should_connect_on_startup(server):
                continue
            try:
                self.connect_server(server.id)
            except McpConnectionError:
                continue

    def get_client(self, server_id: str) -> RuntimeMcpClient:
        normalized = server_id.strip()
        if normalized not in self._clients:
            server = self._registry.get_server(normalized)
            if server is None:
                raise ValueError(f"Unknown MCP server '{normalized}'.")
            self._clients[normalized] = RuntimeMcpClient(
                server,
                diagnostics_callback=lambda entry, server_id=normalized: self._append_diagnostic(server_id, entry),
                timeout_ms=self._registry.config.timeout_ms,
            )
        return self._clients[normalized]

    def list_servers(self) -> list:
        return [self.describe_server(server.id) for server in self._registry.list_servers()]

    def list_statuses(self) -> list:
        return [self.get_server_status(server.id) for server in self._registry.list_servers()]

    def describe_server(self, server_id: str):
        client = self.get_client(server_id)
        return client.describe()

    def get_server_status(self, server_id: str):
        client = self.get_client(server_id)
        return client.status()

    def connect_server(self, server_id: str, reconnect: bool = False):
        client = self.get_client(server_id)
        client.connect(force=reconnect)
        return client.describe()

    def disconnect_server(self, server_id: str):
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
        if connect:
            client.connect()
        if client.is_connected:
            client.sync_capabilities()
        return McpServerSnapshot(
            server=client.describe(),
            tools=client.list_tools(allow_disconnected=True),
            resources=client.list_resources() if client.is_connected else [],
            prompts=client.list_prompts() if client.is_connected else [],
        )

    def sync_server(self, server_id: str) -> McpServerSnapshot:
        client = self.get_client(server_id)
        client.connect()
        client.sync_capabilities()
        return self.snapshot_server(server_id, connect=False)

    def diagnostics(self, server_id: str) -> McpServerDiagnosticsSnapshot:
        status = self.get_server_status(server_id)
        entries = list(self._diagnostics.get(server_id.strip(), []))
        return McpServerDiagnosticsSnapshot(
            server_id=server_id.strip(),
            checked_at=utc_timestamp(),
            runtime_healthy=status.config_valid,
            session_state=status.session_state,
            entries=entries,
            retained_entry_count=len(entries),
            last_error=status.error_message,
        )

    def invocation_history(self, server_id: str | None = None) -> list[McpToolInvocationTrace]:
        traces: list[McpToolInvocationTrace] = []
        clients = self._clients.values() if server_id is None else [self.get_client(server_id)]
        for client in clients:
            traces.extend(client.invocation_history)
        return sorted(traces, key=lambda trace: trace.started_at, reverse=True)

    def _append_diagnostic(self, server_id: str, entry: McpServerDiagnosticsEntry) -> None:
        self._diagnostics[server_id] = [*self._diagnostics[server_id][-199:], entry]
