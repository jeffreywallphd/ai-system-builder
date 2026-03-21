from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from urllib.parse import quote, unquote

from pydantic import BaseModel, ConfigDict, Field


McpServerSourceType = Literal["builtin-local", "workspace-local", "external-remote", "imported"]
McpServerTransport = Literal["stdio", "http", "sse", "inmemory"]
McpServerLifecycleState = Literal["stopped", "starting", "running", "stopping", "error"]
McpServerSessionState = Literal["disconnected", "connecting", "connected", "stale", "error"]
McpCapabilityPublicationState = Literal["unpublished", "published-live", "published-stale", "disabled"]
McpRuntimeHealthState = Literal["disabled", "healthy", "degraded", "unavailable"]
McpValidationSeverity = Literal["info", "warning", "error"]
McpDiagnosticSeverity = Literal["debug", "info", "warning", "error"]


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class McpModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class McpValidationIssue(McpModel):
    code: str
    message: str
    severity: McpValidationSeverity = "error"
    field: Optional[str] = None


class McpServerValidationResult(McpModel):
    valid: bool
    checked_at: str
    issues: List[McpValidationIssue] = Field(default_factory=list)
    normalized_server: Optional[Dict[str, Any]] = None


class McpServerDiagnosticsEntry(McpModel):
    timestamp: str
    severity: McpDiagnosticSeverity
    event: str
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)


class McpServerDiagnosticsSnapshot(McpModel):
    server_id: str
    checked_at: str
    runtime_healthy: bool
    session_state: McpServerSessionState
    entries: List[McpServerDiagnosticsEntry] = Field(default_factory=list)
    retained_entry_count: int = 0
    last_error: Optional[str] = None


class McpDiscoverySnapshot(McpModel):
    server_id: str
    synced_at: Optional[str] = None
    tools: List[Dict[str, Any]] = Field(default_factory=list)
    resources: List[Dict[str, Any]] = Field(default_factory=list)
    prompts: List[Dict[str, Any]] = Field(default_factory=list)
    tool_count: int = 0
    resource_count: int = 0
    prompt_count: int = 0
    stale: bool = False
    published_capability_count: int = 0


class McpCapabilityPublicationRecord(McpModel):
    capability_id: str
    server_id: str
    tool_name: str
    state: McpCapabilityPublicationState
    published_at: Optional[str] = None
    last_live_at: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class McpServerStatus(McpModel):
    server_id: str
    name: str
    transport: McpServerTransport
    source_type: McpServerSourceType = "external-remote"
    configured: bool = True
    enabled: bool = True
    state: Literal["connected", "connecting", "disconnected", "error"]
    lifecycle_state: McpServerLifecycleState = "stopped"
    session_state: McpServerSessionState = "disconnected"
    connected: bool = False
    reachable: bool = False
    config_valid: bool = False
    checked_at: str
    connected_at: Optional[str] = None
    disconnected_at: Optional[str] = None
    last_sync_at: Optional[str] = None
    tool_count: int = 0
    resource_count: int = 0
    prompt_count: int = 0
    capabilities: Dict[str, bool] = Field(default_factory=dict)
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class McpServerDescriptor(McpModel):
    id: str
    name: str
    transport: McpServerTransport
    source_type: McpServerSourceType = "external-remote"
    enabled: bool = True
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    url: Optional[str] = None
    env: Dict[str, str] = Field(default_factory=dict)
    headers: Dict[str, str] = Field(default_factory=dict)
    timeout_ms: Optional[int] = None
    connect_on_startup: Optional[bool] = None
    status: Literal["connected", "connecting", "disconnected", "error"]
    lifecycle_state: McpServerLifecycleState = "stopped"
    session_state: McpServerSessionState = "disconnected"
    connected: bool = False
    reachable: bool = False
    config_valid: bool = False
    checked_at: Optional[str] = None
    connected_at: Optional[str] = None
    disconnected_at: Optional[str] = None
    last_sync_at: Optional[str] = None
    tool_count: int = 0
    resource_count: int = 0
    prompt_count: int = 0
    capabilities: Dict[str, bool] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    validation: Optional[McpServerValidationResult] = None
    error_message: Optional[str] = None


class McpToolDescriptorSource(McpModel):
    kind: Literal["mcp-server"] = "mcp-server"
    server_id: str


class McpToolArgumentDescriptor(McpModel):
    name: str
    title: Optional[str] = None
    description: Optional[str] = None
    type: str = "unknown"
    required: bool = False
    default_value: Optional[Any] = None
    enum_values: List[Any] = Field(default_factory=list)
    format: Optional[str] = None
    schema_data: Dict[str, Any] = Field(default_factory=dict, alias="schema", serialization_alias="schema")


class McpToolDescriptor(McpModel):
    id: str
    server_id: str
    source: McpToolDescriptorSource
    name: str
    title: Optional[str] = None
    description: Optional[str] = None
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    output_schema: Dict[str, Any] = Field(default_factory=dict)
    arguments: List[McpToolArgumentDescriptor] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    annotations: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    publication_state: McpCapabilityPublicationState = "unpublished"
    live: bool = False
    stale: bool = False


class McpResourceDescriptor(McpModel):
    server_id: str
    uri: str
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    mime_type: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class McpPromptDescriptor(McpModel):
    server_id: str
    name: str
    title: Optional[str] = None
    description: Optional[str] = None
    arguments: List[McpToolArgumentDescriptor] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class McpConnectionStatus(McpModel):
    enabled: bool
    state: Literal["disabled", "ready", "degraded", "unavailable"]
    health_state: McpRuntimeHealthState = "unavailable"
    checked_at: str
    python_runtime_healthy: bool = True
    mcp_runtime_healthy: bool = False
    dependency_status: Dict[str, Any] = Field(default_factory=dict)
    servers: List[McpServerStatus] = Field(default_factory=list)
    capabilities: Dict[str, bool] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class McpServerSearchRequest(McpModel):
    query: str = ""
    status: List[Literal["connected", "connecting", "disconnected", "error"]] = Field(default_factory=list)
    transport: List[McpServerTransport] = Field(default_factory=list)
    source_type: List[McpServerSourceType] = Field(default_factory=list)
    limit: int = 20


class McpServerSearchResponse(McpModel):
    query: str = ""
    total_count: int = 0
    limit: int = 20
    servers: List[McpServerDescriptor] = Field(default_factory=list)
    status: McpConnectionStatus


class McpToolSearchRequest(McpModel):
    query: str = ""
    server_ids: List[str] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    limit: int = 20


class McpToolSearchResponse(McpModel):
    query: str = ""
    total_count: int = 0
    limit: int = 20
    tools: List[McpToolDescriptor] = Field(default_factory=list)


class McpServerConnectionRequest(McpModel):
    server_id: str
    reconnect: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class McpServerDisconnectRequest(McpModel):
    server_id: str


class McpServerConnectionResult(McpModel):
    action: Literal["connect", "reconnect", "disconnect"]
    server: McpServerDescriptor
    status: McpServerStatus
    runtime: McpConnectionStatus
    checked_at: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class McpServerTestConnectionResult(McpModel):
    server_id: str
    success: bool
    checked_at: str
    reachable: bool
    handshake_succeeded: bool
    latency_ms: Optional[int] = None
    tools: int = 0
    resources: int = 0
    prompts: int = 0
    error_message: Optional[str] = None
    diagnostics: List[McpServerDiagnosticsEntry] = Field(default_factory=list)


class LocalMcpToolDraft(McpModel):
    server_id: str
    server_name: str
    server_description: Optional[str] = None
    tool_name: str
    tool_title: Optional[str] = None
    tool_description: Optional[str] = None
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    output_schema: Dict[str, Any] = Field(default_factory=dict)
    code: str
    connect_on_startup: bool = True
    timeout_ms: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LocalMcpServerVersionMetadata(McpModel):
    server_id: str
    version: int
    updated_at: str
    authoring_mode: Literal["workspace-local", "builtin-local"] = "workspace-local"
    provisioning_state: Literal["created", "updated", "failed"] = "created"


class LocalMcpServerCreateResult(McpModel):
    server: McpServerDescriptor
    status: McpServerStatus
    runtime: McpConnectionStatus
    checked_at: str
    created: bool
    version: Optional[LocalMcpServerVersionMetadata] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ListMcpToolsResponse(McpModel):
    status: McpConnectionStatus
    tools: List[McpToolDescriptor] = Field(default_factory=list)
    resources: List[McpResourceDescriptor] = Field(default_factory=list)
    prompts: List[McpPromptDescriptor] = Field(default_factory=list)
    capabilities: Dict[str, bool] = Field(default_factory=dict)


class McpToolExecutionRequest(McpModel):
    server_id: str
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    execution_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)


class McpToolInvocationTrace(McpModel):
    execution_id: str
    server_id: str
    tool_name: str
    started_at: str
    finished_at: Optional[str] = None
    status: Literal["running", "completed", "failed"] = "running"
    request_arguments: Dict[str, Any] = Field(default_factory=dict)
    raw_result: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    diagnostics: List[McpServerDiagnosticsEntry] = Field(default_factory=list)


class McpToolExecutionResult(McpModel):
    execution_id: str
    server_id: str
    tool_name: str
    status: Literal["completed", "failed"]
    content: List[Dict[str, Any]] = Field(default_factory=list)
    structured_content: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    trace: Optional[McpToolInvocationTrace] = None
    error_message: Optional[str] = None


class McpServerSnapshot(McpModel):
    server: McpServerDescriptor
    tools: List[McpToolDescriptor] = Field(default_factory=list)
    resources: List[McpResourceDescriptor] = Field(default_factory=list)
    prompts: List[McpPromptDescriptor] = Field(default_factory=list)


class McpSnapshot(McpModel):
    status: McpConnectionStatus
    servers: List[McpServerSnapshot] = Field(default_factory=list)


class McpSyncResult(McpModel):
    server_id: str
    success: bool
    checked_at: str
    snapshot: Optional[McpServerSnapshot] = None
    error_message: Optional[str] = None


class McpServerImportExportRecord(McpModel):
    id: str
    name: str
    transport: McpServerTransport
    source_type: McpServerSourceType
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    url: Optional[str] = None
    env: Dict[str, str] = Field(default_factory=dict)
    headers: Dict[str, str] = Field(default_factory=dict)
    timeout_ms: Optional[int] = None
    connect_on_startup: Optional[bool] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class McpImportRequest(McpModel):
    servers: List[McpServerImportExportRecord] = Field(default_factory=list)


class McpImportResult(McpModel):
    imported: List[McpServerDescriptor] = Field(default_factory=list)
    checked_at: str


class McpExportResult(McpModel):
    servers: List[McpServerImportExportRecord] = Field(default_factory=list)
    checked_at: str


class McpServerUpsertRequest(McpModel):
    id: str
    name: str
    transport: McpServerTransport
    source_type: McpServerSourceType = "external-remote"
    enabled: bool = True
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    url: Optional[str] = None
    env: Dict[str, str] = Field(default_factory=dict)
    headers: Dict[str, str] = Field(default_factory=dict)
    timeout_ms: Optional[int] = None
    connect_on_startup: Optional[bool] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class McpDeleteServerResult(McpModel):
    server_id: str
    deleted: bool
    checked_at: str


class McpDuplicateServerRequest(McpModel):
    server_id: str
    new_server_id: Optional[str] = None
    new_name: Optional[str] = None


class McpInvocationHistoryResponse(McpModel):
    traces: List[McpToolInvocationTrace] = Field(default_factory=list)
    checked_at: str



def build_mcp_tool_id(server_id: str, tool_name: str) -> str:
    return f"mcp:{quote(server_id.strip(), safe='')}:{quote(tool_name.strip(), safe='')}"



def parse_mcp_tool_id(tool_id: str) -> tuple[str, str]:
    normalized = tool_id.strip()
    if not normalized.startswith("mcp:"):
        raise ValueError("MCP toolId must start with 'mcp:'.")

    parts = normalized.split(":", 2)
    if len(parts) != 3 or not parts[1] or not parts[2]:
        raise ValueError("MCP toolId must include encoded serverId and toolName segments.")

    return unquote(parts[1]), unquote(parts[2])



def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
