from __future__ import annotations

from app.core.mcp_config import McpServerConfig
from app.mcp.client import McpConnectionError
from app.mcp.models import (
    LocalMcpServerCreateResult,
    LocalMcpServerVersionMetadata,
    LocalMcpToolDraft,
    ListMcpToolsResponse,
    McpConnectionStatus,
    McpDeleteServerResult,
    McpDuplicateServerRequest,
    McpExportResult,
    McpImportRequest,
    McpImportResult,
    McpInvocationHistoryResponse,
    McpServerConnectionRequest,
    McpServerConnectionResult,
    McpServerDescriptor,
    McpServerSearchRequest,
    McpServerSearchResponse,
    McpServerTestConnectionResult,
    McpServerUpsertRequest,
    McpSnapshot,
    McpSyncResult,
    McpToolDescriptor,
    McpToolExecutionRequest,
    McpToolExecutionResult,
    McpToolSearchRequest,
    McpToolSearchResponse,
    parse_mcp_tool_id,
    utc_timestamp,
)
from app.mcp.persistence import McpDefinitionRepository
from app.mcp.provisioning import LocalMcpServerProvisioner
from app.mcp.registry import McpRegistry
from app.mcp.session import McpSessionManager


class McpService:
    def __init__(
        self,
        registry: McpRegistry,
        repository: McpDefinitionRepository | None = None,
        sessions: McpSessionManager | None = None,
        provisioner: LocalMcpServerProvisioner | None = None,
    ) -> None:
        self._registry = registry
        self._repository = repository
        self._sessions = sessions or McpSessionManager(registry)
        self._provisioner = provisioner
        self._sessions.prime_connections()

    def get_status(self) -> McpConnectionStatus:
        if not self._registry.is_enabled():
            return McpConnectionStatus(
                enabled=False,
                state="disabled",
                health_state="disabled",
                checked_at=utc_timestamp(),
                python_runtime_healthy=True,
                mcp_runtime_healthy=False,
                servers=[],
                capabilities={"tools": False, "resources": False, "prompts": False, "toolExecution": False},
                dependency_status={"configuredPackage": self._registry.config.dependency_package_spec},
                metadata={"configuredServerCount": 0},
            )

        statuses = self._sessions.list_statuses()
        if not statuses:
            state = "unavailable"
            health_state = "unavailable"
        elif any(server.state == "error" for server in statuses):
            state = "degraded"
            health_state = "degraded"
        else:
            state = "ready"
            health_state = "healthy"

        return McpConnectionStatus(
            enabled=True,
            state=state,
            health_state=health_state,
            checked_at=utc_timestamp(),
            python_runtime_healthy=True,
            mcp_runtime_healthy=state == "ready",
            dependency_status={"configuredPackage": self._registry.config.dependency_package_spec},
            servers=statuses,
            capabilities={
                "tools": any(server.capabilities.get("tools", False) for server in statuses),
                "resources": any(server.capabilities.get("resources", False) for server in statuses),
                "prompts": any(server.capabilities.get("prompts", False) for server in statuses),
                "toolExecution": any(server.capabilities.get("toolExecution", False) for server in statuses),
            },
            metadata={"configuredServerCount": len(statuses)},
        )

    def get_snapshot(self) -> McpSnapshot:
        snapshots = [self._sessions.snapshot_server(server.id, connect=False) for server in self._registry.list_servers()] if self._registry.is_enabled() else []
        return McpSnapshot(status=self.get_status(), servers=snapshots)

    def list_servers(self) -> McpServerSearchResponse:
        servers = self._sessions.list_servers() if self._registry.is_enabled() else []
        status = self.get_status()
        return McpServerSearchResponse(query="", total_count=len(servers), limit=max(len(servers), 20), servers=servers, status=status)

    def search_servers(self, request: McpServerSearchRequest) -> McpServerSearchResponse:
        status = self.get_status()
        query = request.query.strip().lower()
        statuses = {value for value in request.status}
        transports = {value for value in request.transport}
        source_types = {value for value in request.source_type}
        bounded_limit = min(max(request.limit, 1), 50)

        def matches(server: McpServerDescriptor) -> bool:
            haystack = " ".join([
                server.id,
                server.name,
                server.transport,
                server.status,
                server.source_type,
                " ".join(f"{key}:{value}" for key, value in server.metadata.items()),
            ]).lower()
            return ((not query or query in haystack) and (not statuses or server.status in statuses) and (not transports or server.transport in transports) and (not source_types or server.source_type in source_types))

        matches_list = [server for server in self._sessions.list_servers() if matches(server)] if self._registry.is_enabled() else []
        return McpServerSearchResponse(query=request.query.strip(), total_count=len(matches_list), limit=bounded_limit, servers=matches_list[:bounded_limit], status=status)

    def get_server_status(self, server_id: str):
        normalized = server_id.strip()
        if not normalized:
            raise ValueError("MCP serverId is required.")
        return self._sessions.get_server_status(normalized)

    def upsert_server(self, request: McpServerUpsertRequest) -> McpServerDescriptor:
        config = McpServerConfig.model_validate(request.model_dump(mode="python"))
        self._registry.upsert_server(config)
        self._sessions.reset_server(config.id)
        return self._sessions.describe_server(config.id)

    def delete_server(self, server_id: str) -> McpDeleteServerResult:
        self._sessions.reset_server(server_id)
        deleted = self._registry.delete_server(server_id)
        return McpDeleteServerResult(server_id=server_id.strip(), deleted=deleted, checked_at=utc_timestamp())

    def duplicate_server(self, request: McpDuplicateServerRequest) -> McpServerDescriptor:
        original = self._registry.get_server(request.server_id)
        if original is None:
            raise ValueError(f"Unknown MCP server '{request.server_id.strip()}'.")
        new_id = (request.new_server_id or f"{original.id}-copy").strip()
        duplicate = original.model_copy(update={"id": new_id, "name": request.new_name or f"{original.name} Copy", "source_type": "imported"})
        self._registry.upsert_server(duplicate)
        return self._sessions.describe_server(new_id)

    def import_servers(self, request: McpImportRequest) -> McpImportResult:
        imported = []
        for item in request.servers:
            config = McpServerConfig.model_validate(item.model_dump(mode="python"))
            self._registry.upsert_server(config.model_copy(update={"source_type": "imported"}))
            imported.append(self._sessions.describe_server(config.id))
        return McpImportResult(imported=imported, checked_at=utc_timestamp())

    def export_servers(self) -> McpExportResult:
        records = [
            server.model_dump(mode="json", include={"id", "name", "transport", "source_type", "command", "args", "url", "env", "headers", "timeout_ms", "connect_on_startup", "metadata"})
            for server in self._registry.list_servers()
        ]
        return McpExportResult(servers=records, checked_at=utc_timestamp())

    def validate_server(self, request: McpServerUpsertRequest):
        descriptor = self.upsert_server(request)
        return descriptor.validation

    def test_connection(self, request: McpServerUpsertRequest) -> McpServerTestConnectionResult:
        start = utc_timestamp()
        descriptor = self.upsert_server(request)
        diagnostics_before = self._sessions.diagnostics(descriptor.id).entries
        try:
            snapshot = self._sessions.sync_server(descriptor.id)
            return McpServerTestConnectionResult(
                server_id=descriptor.id,
                success=True,
                checked_at=utc_timestamp(),
                reachable=True,
                handshake_succeeded=True,
                tools=len(snapshot.tools),
                resources=len(snapshot.resources),
                prompts=len(snapshot.prompts),
                diagnostics=self._sessions.diagnostics(descriptor.id).entries,
            )
        except Exception as error:
            return McpServerTestConnectionResult(
                server_id=descriptor.id,
                success=False,
                checked_at=utc_timestamp(),
                reachable=False,
                handshake_succeeded=False,
                error_message=str(error),
                diagnostics=self._sessions.diagnostics(descriptor.id).entries or diagnostics_before,
            )

    def connect_server(self, request: McpServerConnectionRequest) -> McpServerConnectionResult:
        if request.reconnect:
            return self.reconnect_server(request.server_id)
        if not self._registry.is_enabled():
            raise RuntimeError("MCP runtime is disabled.")
        server = self._sessions.connect_server(request.server_id, reconnect=False)
        return McpServerConnectionResult(action="connect", server=server, status=self._sessions.get_server_status(request.server_id), runtime=self.get_status(), checked_at=utc_timestamp(), metadata={"reconnect": False})

    def reconnect_server(self, server_id: str) -> McpServerConnectionResult:
        if not self._registry.is_enabled():
            raise RuntimeError("MCP runtime is disabled.")
        server = self._sessions.connect_server(server_id, reconnect=True)
        return McpServerConnectionResult(action="reconnect", server=server, status=self._sessions.get_server_status(server_id), runtime=self.get_status(), checked_at=utc_timestamp(), metadata={"reconnect": True})

    def disconnect_server(self, server_id: str) -> McpServerConnectionResult:
        if not self._registry.is_enabled():
            raise RuntimeError("MCP runtime is disabled.")
        server = self._sessions.disconnect_server(server_id)
        return McpServerConnectionResult(action="disconnect", server=server, status=self._sessions.get_server_status(server_id), runtime=self.get_status(), checked_at=utc_timestamp())

    def create_local_server(self, draft: LocalMcpToolDraft) -> LocalMcpServerCreateResult:
        if not self._registry.is_enabled():
            raise RuntimeError("MCP runtime is disabled.")
        if self._provisioner is None:
            raise RuntimeError("Local MCP server provisioning is unavailable.")
        server_config, created, version_metadata = self._provisioner.provision_local_server(draft)
        self._registry.upsert_server(server_config)
        self._sessions.reset_server(server_config.id)
        if server_config.connect_on_startup:
            try:
                self._sessions.connect_server(server_config.id, reconnect=True)
            except McpConnectionError:
                pass
        return LocalMcpServerCreateResult(
            server=self._sessions.describe_server(server_config.id),
            status=self._sessions.get_server_status(server_config.id),
            runtime=self.get_status(),
            checked_at=utc_timestamp(),
            created=created,
            version=LocalMcpServerVersionMetadata(server_id=server_config.id, version=int(version_metadata.get("version", 1)), updated_at=utc_timestamp(), authoring_mode="workspace-local", provisioning_state="created" if created else "updated"),
            metadata={"serverKind": "workspace-local", "toolName": draft.tool_name, **version_metadata},
        )

    def list_tools(self) -> ListMcpToolsResponse:
        snapshot = self.get_snapshot()
        tools = [tool for server in snapshot.servers for tool in server.tools]
        resources = [resource for server in snapshot.servers for resource in server.resources]
        prompts = [prompt for server in snapshot.servers for prompt in server.prompts]
        return ListMcpToolsResponse(status=snapshot.status, tools=tools, resources=resources, prompts=prompts, capabilities=snapshot.status.capabilities)

    def sync_server(self, server_id: str) -> McpSyncResult:
        try:
            snapshot = self._sessions.sync_server(server_id)
            return McpSyncResult(server_id=server_id.strip(), success=True, checked_at=utc_timestamp(), snapshot=snapshot)
        except Exception as error:
            return McpSyncResult(server_id=server_id.strip(), success=False, checked_at=utc_timestamp(), error_message=str(error))

    def search_tools(self, request: McpToolSearchRequest) -> McpToolSearchResponse:
        bounded_limit = min(max(request.limit, 1), 50)
        server_ids = {value.strip() for value in request.server_ids if value.strip()}
        categories = {value.strip() for value in request.categories if value.strip()}
        tags = {value.strip() for value in request.tags if value.strip()}
        normalized_query = request.query.strip().lower()
        matches = [tool for tool in self.list_tools().tools if self._matches_tool(tool, normalized_query, server_ids, categories, tags)]
        return McpToolSearchResponse(query=request.query.strip(), total_count=len(matches), limit=bounded_limit, tools=matches[:bounded_limit])

    def get_tool_descriptor(self, tool_id: str) -> McpToolDescriptor:
        server_id, tool_name = parse_mcp_tool_id(tool_id)
        for tool in self.list_tools().tools:
            if tool.server_id == server_id and tool.name == tool_name:
                return tool
        raise ValueError(f"Unknown MCP tool '{tool_id.strip()}'.")

    def execute_tool(self, request: McpToolExecutionRequest) -> McpToolExecutionResult:
        if not self._registry.is_enabled():
            return McpToolExecutionResult(execution_id=request.execution_id or "mcp-disabled", server_id=request.server_id, tool_name=request.tool_name, status="failed", error_message="MCP runtime is disabled.")
        try:
            client = self._sessions.get_client(request.server_id)
            return client.execute_tool(request)
        except (ValueError, McpConnectionError) as error:
            return McpToolExecutionResult(execution_id=request.execution_id or "mcp-failed", server_id=request.server_id, tool_name=request.tool_name, status="failed", error_message=str(error))

    def get_server_diagnostics(self, server_id: str):
        return self._sessions.diagnostics(server_id)

    def get_invocation_history(self, server_id: str | None = None) -> McpInvocationHistoryResponse:
        return McpInvocationHistoryResponse(traces=self._sessions.invocation_history(server_id), checked_at=utc_timestamp())

    def _matches_tool(self, tool: McpToolDescriptor, query: str, server_ids: set[str], categories: set[str], tags: set[str]) -> bool:
        if server_ids and tool.server_id not in server_ids:
            return False
        if categories and not any(category in categories for category in tool.categories):
            return False
        if tags and not any(tag in tags for tag in tool.tags):
            return False
        if not query:
            return True
        haystack_parts = [tool.id, tool.server_id, tool.name, tool.title or "", tool.description or "", *tool.categories, *tool.tags, *(argument.name for argument in tool.arguments), *(argument.description or "" for argument in tool.arguments)]
        haystack = " ".join(part for part in haystack_parts if part).lower()
        return query in haystack
