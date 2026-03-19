from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from urllib.parse import quote, unquote

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class McpModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class McpServerStatus(McpModel):
    server_id: str
    name: str
    transport: Literal["stdio", "http", "sse", "inmemory"]
    configured: bool = True
    enabled: bool = True
    state: Literal["connected", "connecting", "disconnected", "error"]
    connected: bool = False
    checked_at: str
    connected_at: Optional[str] = None
    disconnected_at: Optional[str] = None
    tool_count: int = 0
    resource_count: int = 0
    capabilities: Dict[str, bool] = Field(default_factory=dict)
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class McpServerDescriptor(McpModel):
    id: str
    name: str
    transport: Literal["stdio", "http", "sse", "inmemory"]
    enabled: bool = True
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    url: Optional[str] = None
    env: Dict[str, str] = Field(default_factory=dict)
    timeout_ms: Optional[int] = None
    connect_on_startup: Optional[bool] = None
    status: Literal["connected", "connecting", "disconnected", "error"]
    connected: bool = False
    checked_at: Optional[str] = None
    connected_at: Optional[str] = None
    disconnected_at: Optional[str] = None
    tool_count: int = 0
    resource_count: int = 0
    capabilities: Dict[str, bool] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
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


class McpResourceDescriptor(McpModel):
    server_id: str
    uri: str
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    mime_type: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class McpConnectionStatus(McpModel):
    enabled: bool
    state: Literal["disabled", "ready", "degraded", "unavailable"]
    checked_at: str
    servers: List[McpServerStatus] = Field(default_factory=list)
    capabilities: Dict[str, bool] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class McpServerSearchRequest(McpModel):
    query: str = ""
    status: List[Literal["connected", "connecting", "disconnected", "error"]] = Field(default_factory=list)
    transport: List[Literal["stdio", "http", "sse", "inmemory"]] = Field(default_factory=list)
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


class ListMcpToolsResponse(McpModel):
    status: McpConnectionStatus
    tools: List[McpToolDescriptor] = Field(default_factory=list)
    resources: List[McpResourceDescriptor] = Field(default_factory=list)
    capabilities: Dict[str, bool] = Field(default_factory=dict)


class McpToolExecutionRequest(McpModel):
    server_id: str
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    execution_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)


class McpToolExecutionResult(McpModel):
    execution_id: str
    server_id: str
    tool_name: str
    status: Literal["completed", "failed"]
    content: List[Dict[str, Any]] = Field(default_factory=list)
    structured_content: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None


class McpServerSnapshot(McpModel):
    server: McpServerDescriptor
    tools: List[McpToolDescriptor] = Field(default_factory=list)
    resources: List[McpResourceDescriptor] = Field(default_factory=list)


class McpSnapshot(McpModel):
    status: McpConnectionStatus
    servers: List[McpServerSnapshot] = Field(default_factory=list)


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
