import json
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class McpServerConfig(BaseModel):
    id: str
    name: str
    transport: Literal["stdio", "http", "sse", "inmemory"] = "inmemory"
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    url: Optional[str] = None
    enabled: bool = True
    mock_tools: List[Dict[str, Any]] = Field(default_factory=list)
    mock_resources: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    fail_connect: bool = False


class McpRuntimeConfig(BaseSettings):
    enabled: bool = False
    timeout_ms: int = 10000
    connect_on_startup: bool = False
    servers_json: str = "[]"

    model_config = SettingsConfigDict(env_prefix="MCP_RUNTIME_", extra="ignore")

    @property
    def servers(self) -> List[McpServerConfig]:
        raw = self.servers_json.strip() or "[]"
        payload = json.loads(raw)
        if not isinstance(payload, list):
            raise ValueError("MCP runtime servers JSON must decode to a list.")
        return [McpServerConfig.model_validate(item) for item in payload]


def load_mcp_runtime_config(env: Optional[Dict[str, str]] = None) -> McpRuntimeConfig:
    if env is None:
        return McpRuntimeConfig()

    return McpRuntimeConfig(
        enabled=env.get("MCP_RUNTIME_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"},
        timeout_ms=int(env.get("MCP_RUNTIME_TIMEOUT_MS", 10000)),
        connect_on_startup=env.get("MCP_RUNTIME_CONNECT_ON_STARTUP", "false").strip().lower()
        in {"1", "true", "yes", "on"},
        servers_json=env.get("MCP_RUNTIME_SERVERS_JSON", "[]"),
    )
