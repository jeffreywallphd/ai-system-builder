from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class McpModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class McpServerDescriptor(McpModel):
    id: str
    name: str
    transport: Literal["stdio", "http", "sse", "inmemory"]
    status: Literal["connected", "connecting", "disconnected", "error"]
    tool_count: int = 0
    resource_count: int = 0
    capabilities: Dict[str, bool] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None


class McpToolDescriptor(McpModel):
    server_id: str
    name: str
    title: Optional[str] = None
    description: Optional[str] = None
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    output_schema: Dict[str, Any] = Field(default_factory=dict)
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
    servers: List[McpServerDescriptor] = Field(default_factory=list)
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


class McpServerConnectionRequest(McpModel):
    server_id: str
    reconnect: bool = False


class McpServerDisconnectRequest(McpModel):
    server_id: str


class McpServerConnectionResult(McpModel):
    action: Literal["connect", "reconnect", "disconnect"]
    server: McpServerDescriptor
    status: McpConnectionStatus
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


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
