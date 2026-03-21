from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from app.core.mcp_config import McpServerConfig


class McpDefinitionRepository:
    def __init__(self, root: Path) -> None:
        self._root = root
        self._file = root / "configured-servers.json"
        self._root.mkdir(parents=True, exist_ok=True)

    def list(self) -> list[McpServerConfig]:
        if not self._file.exists():
            return []
        try:
            payload = json.loads(self._file.read_text(encoding="utf-8"))
        except Exception:
            return []
        if not isinstance(payload, list):
            return []
        servers: list[McpServerConfig] = []
        for item in payload:
            try:
                servers.append(McpServerConfig.model_validate(item))
            except Exception:
                continue
        return servers

    def save_all(self, servers: Iterable[McpServerConfig]) -> None:
        data = [server.model_dump(mode="json") for server in servers]
        self._file.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    def upsert(self, server: McpServerConfig) -> McpServerConfig:
        current = {item.id: item for item in self.list()}
        current[server.id] = server
        self.save_all(current.values())
        return server

    def delete(self, server_id: str) -> bool:
        normalized = server_id.strip()
        current = {item.id: item for item in self.list()}
        removed = current.pop(normalized, None)
        if removed is None:
            return False
        self.save_all(current.values())
        return True
