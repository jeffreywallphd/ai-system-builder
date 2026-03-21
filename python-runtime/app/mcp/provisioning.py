from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence

from app.core.mcp_config import McpRuntimeConfig, McpServerConfig, load_mcp_runtime_config
from app.mcp.models import LocalMcpToolDraft

DEFAULT_MCP_PACKAGE_SPEC = "mcp[cli]"
DEFAULT_TEMPLATE_ID = "default-local-calculator"
DEFAULT_SERVER_ID = "local-calculator"
DEFAULT_SERVER_NAME = "Local Calculator"

InstallRunner = Callable[[Sequence[str], Path], tuple[bool, str]]


@dataclass(frozen=True)
class ProvisionedMcpToolTemplate:
    name: str
    title: str
    description: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any] = field(default_factory=dict)
    categories: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()
    annotations: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_tool(self) -> dict[str, Any]:
        metadata = dict(self.metadata)
        if self.categories:
            metadata.setdefault("categories", list(self.categories))
        if self.tags:
            metadata.setdefault("tags", list(self.tags))
        return {
            "name": self.name,
            "title": self.title,
            "description": self.description,
            "inputSchema": self.input_schema,
            "outputSchema": self.output_schema,
            "annotations": dict(self.annotations),
            "metadata": metadata,
        }


@dataclass(frozen=True)
class ProvisionedMcpServerTemplate:
    template_id: str
    server_id: str
    name: str
    description: str
    package_spec: str
    tools: tuple[ProvisionedMcpToolTemplate, ...]
    metadata: dict[str, Any] = field(default_factory=dict)
    connect_on_startup: bool = True
    timeout_ms: int = 10000


class LocalMcpServerTemplateRegistry:
    def list_templates(self) -> list[ProvisionedMcpServerTemplate]:
        calculator_tool = ProvisionedMcpToolTemplate(
            name="calculate",
            title="Lightweight Calculator",
            description="Perform a lightweight arithmetic operation against two numeric operands.",
            input_schema={
                "type": "object",
                "required": ["operation", "left", "right"],
                "properties": {
                    "operation": {"type": "string", "enum": ["add", "subtract", "multiply", "divide"]},
                    "left": {"type": "number"},
                    "right": {"type": "number"},
                },
            },
            output_schema={
                "type": "object",
                "required": ["operation", "left", "right", "result"],
                "properties": {
                    "operation": {"type": "string"},
                    "left": {"type": "number"},
                    "right": {"type": "number"},
                    "result": {"type": "number"},
                },
            },
            categories=("calculator", "default"),
            tags=("local", "math", "starter-tool"),
            metadata={"toolKind": "calculator", "authoringMode": "system-default"},
        )
        return [
            ProvisionedMcpServerTemplate(
                template_id=DEFAULT_TEMPLATE_ID,
                server_id=DEFAULT_SERVER_ID,
                name=DEFAULT_SERVER_NAME,
                description="Workspace-local calculator server created automatically for new installations.",
                package_spec=DEFAULT_MCP_PACKAGE_SPEC,
                tools=(calculator_tool,),
                metadata={"templateId": DEFAULT_TEMPLATE_ID, "serverKind": "builtin-local"},
            )
        ]


class LocalMcpServerProvisioner:
    def __init__(
        self,
        workspace_root: Path,
        python_executable: str | None = None,
        install_runner: InstallRunner | None = None,
        template_registry: LocalMcpServerTemplateRegistry | None = None,
        runtime_package_spec: str | None = None,
    ) -> None:
        self._workspace_root = workspace_root
        self._python_executable = (python_executable or sys.executable or "python").strip() or "python"
        self._install_runner = install_runner or self._run_install
        self._template_registry = template_registry or LocalMcpServerTemplateRegistry()
        self._runtime_package_spec = runtime_package_spec.strip() if runtime_package_spec else DEFAULT_MCP_PACKAGE_SPEC

    def provision_defaults(self) -> list[McpServerConfig]:
        self._workspace_root.mkdir(parents=True, exist_ok=True)
        return [self._provision_template(template) for template in self._template_registry.list_templates()]

    def provision_local_server(self, draft: LocalMcpToolDraft) -> tuple[McpServerConfig, bool, dict[str, Any]]:
        server_root = self._workspace_root / draft.server_id
        state_file = server_root / ".provisioned.json"
        entrypoint = server_root / "server.py"
        manifest_path = server_root / "manifest.json"
        created = not state_file.exists()
        version = 1
        if state_file.exists():
            try:
                existing = json.loads(state_file.read_text(encoding="utf-8"))
                version = int(existing.get("version", 0)) + 1
            except Exception:
                version = 1

        server_root.mkdir(parents=True, exist_ok=True)
        install = self._install_runtime_package(server_root, created)

        manifest = {
            "serverId": draft.server_id,
            "name": draft.server_name,
            "description": draft.server_description or draft.tool_description or "",
            "tools": [{
                "name": draft.tool_name,
                "title": draft.tool_title or draft.tool_name,
                "description": draft.tool_description or draft.server_description or "",
                "inputSchema": dict(draft.input_schema),
                "outputSchema": dict(draft.output_schema),
                "metadata": {**dict(draft.metadata), "authoringMode": "workspace-local", "generatedBy": "ai-loom-studio"},
            }],
        }

        self._write_text(entrypoint, render_local_server_entrypoint(draft))
        self._write_text(manifest_path, json.dumps(manifest, indent=2) + "\n")
        state = {
            "serverId": draft.server_id,
            "name": draft.server_name,
            "entrypoint": str(entrypoint),
            "toolName": draft.tool_name,
            "toolTitle": draft.tool_title,
            "toolDescription": draft.tool_description,
            "serverDescription": draft.server_description,
            "code": draft.code,
            "inputSchema": dict(draft.input_schema),
            "outputSchema": dict(draft.output_schema),
            "metadata": dict(draft.metadata),
            "version": version,
            "createdBy": "ai-loom-studio",
            "dependencyInstall": install,
        }
        self._write_text(state_file, json.dumps(state, indent=2) + "\n")

        return (
            McpServerConfig(
                id=draft.server_id,
                name=draft.server_name,
                enabled=True,
                source_type="workspace-local",
                transport="stdio",
                command=self._python_executable,
                args=[str(entrypoint)],
                timeout_ms=draft.timeout_ms or 10000,
                connect_on_startup=draft.connect_on_startup,
                metadata={
                    **dict(draft.metadata),
                    "workspaceRoot": str(server_root),
                    "entrypoint": str(entrypoint),
                    "provisioningStateFile": str(state_file),
                    "provisioningStatus": "created" if created else "updated",
                    "serverKind": "workspace-local",
                    "version": version,
                    "dependencyInstall": install,
                },
            ),
            created,
            {"version": version, "dependencyInstall": install},
        )

    def _provision_template(self, template: ProvisionedMcpServerTemplate) -> McpServerConfig:
        server_root = self._workspace_root / template.server_id
        state_file = server_root / ".provisioned.json"
        manifest_path = server_root / "manifest.json"
        entrypoint = server_root / "server.py"
        created = not state_file.exists()
        server_root.mkdir(parents=True, exist_ok=True)
        install = self._install_runtime_package(server_root, created, template.package_spec)
        tool = template.tools[0]
        draft = LocalMcpToolDraft(
            server_id=template.server_id,
            server_name=template.name,
            server_description=template.description,
            tool_name=tool.name,
            tool_title=tool.title,
            tool_description=tool.description,
            input_schema=tool.input_schema,
            output_schema=tool.output_schema,
            code='operation = str(payload.get("operation", "")).strip().lower()\nleft = float(payload.get("left", 0))\nright = float(payload.get("right", 0))\nif operation == "add":\n    result = left + right\nelif operation == "subtract":\n    result = left - right\nelif operation == "multiply":\n    result = left * right\nelif operation == "divide":\n    if right == 0:\n        raise ValueError("Division by zero is not supported.")\n    result = left / right\nelse:\n    raise ValueError(f"Unsupported operation: {operation}")\nreturn {"operation": operation, "left": left, "right": right, "result": result}',
            connect_on_startup=template.connect_on_startup,
            timeout_ms=template.timeout_ms,
            metadata={**template.metadata, "authoringMode": "builtin-local"},
        )
        self._write_text(entrypoint, render_local_server_entrypoint(draft))
        self._write_text(manifest_path, json.dumps({"serverId": template.server_id, "name": template.name, "tools": [tool.to_tool()]}, indent=2) + "\n")
        self._write_text(state_file, json.dumps({"templateId": template.template_id, "serverId": template.server_id, "version": 1, "dependencyInstall": install}, indent=2) + "\n")
        return McpServerConfig(
            id=template.server_id,
            name=template.name,
            enabled=True,
            source_type="builtin-local",
            transport="stdio",
            command=self._python_executable,
            args=[str(entrypoint)],
            timeout_ms=template.timeout_ms,
            connect_on_startup=template.connect_on_startup,
            metadata={**template.metadata, "workspaceRoot": str(server_root), "entrypoint": str(entrypoint), "provisioningStateFile": str(state_file), "provisioningStatus": "created" if created else "existing", "dependencyInstall": install},
        )

    def _write_text(self, path: Path, content: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and path.read_text(encoding="utf-8") == content:
            return
        path.write_text(content, encoding="utf-8")

    def _install_runtime_package(self, cwd: Path, created: bool, package_spec: str | None = None) -> dict[str, Any]:
        effective_package_spec = self._runtime_package_spec or package_spec
        if not effective_package_spec:
            return {"attempted": False, "succeeded": False}
        if not created:
            return {"attempted": False, "succeeded": True, "reason": "already-provisioned"}
        success, output = self._install_runner([self._python_executable, "-m", "pip", "install", effective_package_spec], cwd)
        return {"attempted": True, "succeeded": success, "packageSpec": effective_package_spec, "output": output[-1000:]}

    def _run_install(self, command: Sequence[str], cwd: Path) -> tuple[bool, str]:
        try:
            completed = subprocess.run(command, cwd=str(cwd), check=True, capture_output=True, text=True)
            return True, (completed.stdout or "") + (completed.stderr or "")
        except Exception as error:
            return False, str(error)


def build_bootstrapped_mcp_runtime_config(env: dict[str, str] | None = None) -> McpRuntimeConfig:
    effective_env = dict(env) if env is not None else dict(os.environ)
    base_config = load_mcp_runtime_config(effective_env)
    if not _should_bootstrap_defaults(effective_env):
        return base_config
    provisioner = LocalMcpServerProvisioner(workspace_root=resolve_default_mcp_workspace_root(effective_env), python_executable=resolve_mcp_runtime_python_executable(effective_env))
    default_servers = provisioner.provision_defaults()
    merged_servers = merge_mcp_servers(default_servers, base_config.servers)
    return McpRuntimeConfig(
        enabled=True,
        timeout_ms=base_config.timeout_ms,
        connect_on_startup=base_config.connect_on_startup,
        servers_json=json.dumps([server.model_dump(mode="json") for server in merged_servers]),
        workspace_root=str(resolve_default_mcp_workspace_root(effective_env)),
        dependency_package_spec=base_config.dependency_package_spec,
    )


def merge_mcp_servers(*server_groups: Iterable[McpServerConfig]) -> list[McpServerConfig]:
    merged: dict[str, McpServerConfig] = {}
    for group in server_groups:
        for server in group:
            merged[server.id] = server
    return list(merged.values())


def render_local_server_entrypoint(draft: LocalMcpToolDraft) -> str:
    docstring = (draft.tool_description or draft.server_description or "Workspace-authored MCP tool.").replace('"""', "'")
    manifest = json.dumps({
        "server": {"name": draft.server_name, "version": "0.1.0"},
        "tool": {
            "name": draft.tool_name,
            "title": draft.tool_title or draft.tool_name,
            "description": draft.tool_description or draft.server_description or "",
            "inputSchema": draft.input_schema,
            "outputSchema": draft.output_schema,
            "metadata": {**dict(draft.metadata), "authoringMode": dict(draft.metadata).get("authoringMode", "workspace-local")},
        },
    }, indent=2)
    user_code = indent_user_code(draft.code)
    template = """from __future__ import annotations

import json
import sys
import traceback
from typing import Any

MANIFEST = json.loads({manifest!r})


def execute_tool(payload: dict[str, Any]) -> Any:
    \"\"\"{docstring}\"\"\"
    payload = payload if isinstance(payload, dict) else {{"input": payload}}
{user_code}


def send(message: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(message) + \"\\n\")
    sys.stdout.flush()


def handle_request(message: dict[str, Any]) -> None:
    request_id = message.get("id")
    method = message.get("method")
    params = message.get("params") or {{}}
    if method == "initialize":
        send({{"jsonrpc": "2.0", "id": request_id, "result": {{"protocolVersion": "2024-11-05", "serverInfo": MANIFEST["server"], "capabilities": {{"tools": {{}}, "resources": {{}}, "prompts": {{}}}}}}}})
        return
    if method == "notifications/initialized":
        return
    if method == "tools/list":
        send({{"jsonrpc": "2.0", "id": request_id, "result": {{"tools": [MANIFEST["tool"]]}}}})
        return
    if method == "resources/list":
        send({{"jsonrpc": "2.0", "id": request_id, "result": {{"resources": []}}}})
        return
    if method == "prompts/list":
        send({{"jsonrpc": "2.0", "id": request_id, "result": {{"prompts": []}}}})
        return
    if method == "tools/call":
        result = execute_tool(dict(params.get("arguments") or {{}}))
        send({{"jsonrpc": "2.0", "id": request_id, "result": {{"content": [{{"type": "json", "json": result}}], "structuredContent": result if isinstance(result, dict) else {{"result": result}}}}}})
        return
    send({{"jsonrpc": "2.0", "id": request_id, "error": {{"code": -32601, "message": f"Unknown method: {{method}}"}}}})


for raw in sys.stdin:
    raw = raw.strip()
    if not raw:
        continue
    try:
        handle_request(json.loads(raw))
    except Exception as error:
        request_id = None
        try:
            request_id = json.loads(raw).get("id")
        except Exception:
            request_id = None
        send({{"jsonrpc": "2.0", "id": request_id, "error": {{"code": -32000, "message": str(error), "data": traceback.format_exc()}}}})
"""
    return template.format(manifest=manifest, docstring=docstring, user_code=user_code)


def sanitize_python_identifier(value: str) -> str:
    normalized = "".join(character if character.isalnum() or character == "_" else "_" for character in value.strip().lower())
    normalized = normalized.strip("_")
    if not normalized:
        return "workspace_tool"
    if normalized[0].isdigit():
        normalized = f"tool_{{normalized}}"
    return normalized


def indent_user_code(code: str) -> str:
    lines = code.splitlines() or ["return {}"]
    return "\n".join(f"    {line}" if line.strip() else "" for line in lines)


def resolve_default_mcp_workspace_root(env: dict[str, str] | None = None) -> Path:
    source = env if env is not None else dict(os.environ)
    configured_root = source.get("MCP_RUNTIME_WORKSPACE_ROOT")
    if configured_root and configured_root.strip():
        return Path(configured_root.strip())
    return Path(__file__).resolve().parents[3] / "user" / "workflow-data" / "mcp"


def resolve_mcp_runtime_python_executable(env: dict[str, str] | None = None) -> str:
    source = env if env is not None else dict(os.environ)
    configured = source.get("MCP_RUNTIME_PYTHON_EXECUTABLE")
    if configured and configured.strip():
        return configured.strip()
    return sys.executable or "python"


def _should_bootstrap_defaults(env: dict[str, str] | None = None) -> bool:
    source = env if env is not None else dict(os.environ)
    configured = source.get("MCP_RUNTIME_BOOTSTRAP_DEFAULT_SERVER")
    if configured is None:
        return True
    return configured.strip().lower() in {"1", "true", "yes", "on"}
