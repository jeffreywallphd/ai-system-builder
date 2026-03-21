from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class McpServerConfig(BaseModel):
    id: str
    name: str
    enabled: bool = True
    source_type: Literal["builtin-local", "workspace-local", "external-remote", "imported"] = "external-remote"
    transport: Literal["stdio", "http", "sse", "inmemory"] = "stdio"
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    url: Optional[str] = None
    env: Dict[str, str] = Field(default_factory=dict)
    headers: Dict[str, str] = Field(default_factory=dict)
    timeout_ms: Optional[int] = None
    connect_on_startup: Optional[bool] = None
    mock_tools: List[Dict[str, Any]] = Field(default_factory=list)
    mock_resources: List[Dict[str, Any]] = Field(default_factory=list)
    mock_prompts: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    fail_connect: bool = False

    @field_validator("id", "name")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("MCP server id and name must be non-empty.")
        return normalized

    @field_validator("command", "url")
    @classmethod
    def trim_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("timeout_ms")
    @classmethod
    def validate_timeout(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value <= 0:
            raise ValueError("MCP server timeout_ms must be positive when provided.")
        return value

    @field_validator("env", "headers", mode="before")
    @classmethod
    def normalize_string_map(cls, value: Optional[Dict[str, Any]]) -> Dict[str, str]:
        if not value:
            return {}
        return {str(key): str(item) for key, item in value.items()}

    @model_validator(mode="after")
    def validate_transport_config(self) -> "McpServerConfig":
        if self.enabled and self.transport == "stdio" and not self.command:
            raise ValueError(f"Configured stdio MCP server '{self.id}' requires a command.")
        if self.enabled and self.transport in {"http", "sse"} and not self.url:
            raise ValueError(f"Configured {self.transport} MCP server '{self.id}' requires a url.")
        return self


class McpRuntimeConfig(BaseSettings):
    enabled: bool = False
    timeout_ms: int = 10000
    connect_on_startup: bool = False
    servers_json: str = "[]"
    workspace_root: str = ""
    dependency_package_spec: str = "mcp[cli]"

    model_config = SettingsConfigDict(env_prefix="MCP_RUNTIME_", extra="ignore")

    @property
    def servers(self) -> List[McpServerConfig]:
        raw = self.servers_json.strip() or "[]"
        payload = json.loads(raw)
        if not isinstance(payload, list):
            raise ValueError("MCP runtime servers JSON must decode to a list.")

        servers = [McpServerConfig.model_validate(item) for item in payload]
        ids: set[str] = set()
        for server in servers:
            if server.id in ids:
                raise ValueError(f"Duplicate MCP server id '{server.id}' is not allowed.")
            ids.add(server.id)
        return servers

    @property
    def resolved_workspace_root(self) -> Path:
        if self.workspace_root.strip():
            return Path(self.workspace_root.strip())
        return Path(__file__).resolve().parents[3] / "user" / "workflow-data" / "mcp"

    def should_connect_on_startup(self, server: McpServerConfig) -> bool:
        if not server.enabled:
            return False
        if server.connect_on_startup is not None:
            return server.connect_on_startup
        return self.connect_on_startup


def load_mcp_runtime_config(env: Optional[Dict[str, str]] = None) -> McpRuntimeConfig:
    if env is None:
        return McpRuntimeConfig()

    return McpRuntimeConfig(
        enabled=env.get("MCP_RUNTIME_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"},
        timeout_ms=int(env.get("MCP_RUNTIME_TIMEOUT_MS", 10000)),
        connect_on_startup=env.get("MCP_RUNTIME_CONNECT_ON_STARTUP", "false").strip().lower() in {"1", "true", "yes", "on"},
        servers_json=env.get("MCP_RUNTIME_SERVERS_JSON", "[]"),
        workspace_root=env.get("MCP_RUNTIME_WORKSPACE_ROOT", ""),
        dependency_package_spec=env.get("MCP_RUNTIME_DEPENDENCY_PACKAGE_SPEC", "mcp[cli]"),
    )
