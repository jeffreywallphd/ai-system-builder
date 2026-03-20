from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence

from app.core.mcp_config import McpRuntimeConfig, McpServerConfig, load_mcp_runtime_config

DEFAULT_MCP_PACKAGE_SPEC = "mcp[cli]"
DEFAULT_TEMPLATE_ID = "default-local-calculator"
DEFAULT_SERVER_ID = "local-calculator"
DEFAULT_SERVER_NAME = "Local Calculator"

InstallRunner = Callable[[Sequence[str], Path], None]


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

    def to_mock_tool(self) -> dict[str, Any]:
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
    entrypoint_file: str
    tools: tuple[ProvisionedMcpToolTemplate, ...]
    resource_files: dict[str, str] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    connect_on_startup: bool = True
    timeout_ms: int = 10000

    def render_entrypoint(self) -> str:
        return '''from __future__ import annotations

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("AI Loom Local Calculator")


@mcp.tool(name="calculate")
def calculate(operation: str, left: float, right: float) -> dict[str, float | str]:
    """Perform a lightweight arithmetic calculation for two operands."""
    normalized = operation.strip().lower()

    if normalized == "add":
        result = left + right
    elif normalized == "subtract":
        result = left - right
    elif normalized == "multiply":
        result = left * right
    elif normalized == "divide":
        if right == 0:
            raise ValueError("Division by zero is not supported.")
        result = left / right
    else:
        raise ValueError(f"Unsupported operation: {operation}")

    return {
        "operation": normalized,
        "left": left,
        "right": right,
        "result": result,
    }


if __name__ == "__main__":
    mcp.run()
'''


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
                    "operation": {
                        "type": "string",
                        "description": "Arithmetic operation to perform.",
                        "enum": ["add", "subtract", "multiply", "divide"],
                    },
                    "left": {
                        "type": "number",
                        "description": "The left-hand operand.",
                    },
                    "right": {
                        "type": "number",
                        "description": "The right-hand operand.",
                    },
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
            annotations={"stability": "workspace-default"},
            metadata={
                "toolKind": "calculator",
                "authoringMode": "system-default",
                "extensionReady": True,
            },
        )
        manifest = {
            "templateId": DEFAULT_TEMPLATE_ID,
            "serverId": DEFAULT_SERVER_ID,
            "name": DEFAULT_SERVER_NAME,
            "description": "Workspace-local MCP server provisioned automatically by AI Loom Studio.",
            "tools": [calculator_tool.to_mock_tool()],
            "futureExtensionPoints": {
                "customTools": True,
                "toolTemplates": True,
                "workspaceLocal": True,
            },
        }
        return [
            ProvisionedMcpServerTemplate(
                template_id=DEFAULT_TEMPLATE_ID,
                server_id=DEFAULT_SERVER_ID,
                name=DEFAULT_SERVER_NAME,
                description="Workspace-local calculator server created automatically for new installations.",
                package_spec=DEFAULT_MCP_PACKAGE_SPEC,
                entrypoint_file="server.py",
                tools=(calculator_tool,),
                resource_files={"manifest.json": json.dumps(manifest, indent=2) + "\n"},
                metadata={
                    "templateId": DEFAULT_TEMPLATE_ID,
                    "serverKind": "workspace-local",
                    "provisionedBy": "ai-loom-python-runtime",
                    "futureExtensionPoints": {
                        "customTools": True,
                        "toolTemplates": True,
                        "workspaceLocal": True,
                    },
                },
                connect_on_startup=True,
                timeout_ms=10000,
            )
        ]


class LocalMcpServerProvisioner:
    def __init__(
        self,
        workspace_root: Path,
        python_executable: str | None = None,
        install_runner: InstallRunner | None = None,
        template_registry: LocalMcpServerTemplateRegistry | None = None,
    ) -> None:
        self._workspace_root = workspace_root
        self._python_executable = (python_executable or sys.executable or "python").strip() or "python"
        self._install_runner = install_runner or self._run_install
        self._template_registry = template_registry or LocalMcpServerTemplateRegistry()

    def provision_defaults(self) -> list[McpServerConfig]:
        self._workspace_root.mkdir(parents=True, exist_ok=True)
        return [self._provision_template(template) for template in self._template_registry.list_templates()]

    def _provision_template(self, template: ProvisionedMcpServerTemplate) -> McpServerConfig:
        server_root = self._workspace_root / template.server_id
        state_file = server_root / ".provisioned.json"
        entrypoint = server_root / template.entrypoint_file
        created = not state_file.exists()

        server_root.mkdir(parents=True, exist_ok=True)
        if created:
            self._install_runner(
                [self._python_executable, "-m", "pip", "install", template.package_spec],
                server_root,
            )

        self._write_text(entrypoint, template.render_entrypoint())
        for relative_path, content in template.resource_files.items():
            self._write_text(server_root / relative_path, content)

        state = {
            "templateId": template.template_id,
            "serverId": template.server_id,
            "name": template.name,
            "packageSpec": template.package_spec,
            "pythonExecutable": self._python_executable,
            "entrypoint": str(entrypoint),
            "toolNames": [tool.name for tool in template.tools],
        }
        self._write_text(state_file, json.dumps(state, indent=2) + "\n")

        return McpServerConfig(
            id=template.server_id,
            name=template.name,
            enabled=True,
            transport="stdio",
            command=self._python_executable,
            args=[str(entrypoint)],
            timeout_ms=template.timeout_ms,
            connect_on_startup=template.connect_on_startup,
            mock_tools=[tool.to_mock_tool() for tool in template.tools],
            mock_resources=[
                {
                    "uri": f"file://{server_root / 'manifest.json'}",
                    "name": "manifest.json",
                    "title": f"{template.name} manifest",
                    "description": "Provisioned server manifest and extension metadata.",
                    "mimeType": "application/json",
                }
            ],
            metadata={
                **template.metadata,
                "workspaceRoot": str(server_root),
                "entrypoint": str(entrypoint),
                "provisioningStateFile": str(state_file),
                "provisioningStatus": "created" if created else "existing",
            },
        )

    def _write_text(self, path: Path, content: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and path.read_text(encoding="utf-8") == content:
            return
        path.write_text(content, encoding="utf-8")

    def _run_install(self, command: Sequence[str], cwd: Path) -> None:
        subprocess.run(command, cwd=str(cwd), check=True, capture_output=True, text=True)


def build_bootstrapped_mcp_runtime_config(env: dict[str, str] | None = None) -> McpRuntimeConfig:
    effective_env = dict(env) if env is not None else dict(os.environ)
    base_config = load_mcp_runtime_config(effective_env)
    if not _should_bootstrap_defaults(effective_env):
        return base_config

    provisioner = LocalMcpServerProvisioner(
        workspace_root=resolve_default_mcp_workspace_root(effective_env),
        python_executable=resolve_mcp_runtime_python_executable(effective_env),
    )
    default_servers = provisioner.provision_defaults()
    merged_servers = merge_mcp_servers(default_servers, base_config.servers)
    if not merged_servers:
        return base_config

    return McpRuntimeConfig(
        enabled=True,
        timeout_ms=base_config.timeout_ms,
        connect_on_startup=base_config.connect_on_startup,
        servers_json=json.dumps([server.model_dump(mode="json") for server in merged_servers]),
    )


def merge_mcp_servers(*server_groups: Iterable[McpServerConfig]) -> list[McpServerConfig]:
    merged: dict[str, McpServerConfig] = {}
    for group in server_groups:
        for server in group:
            merged[server.id] = server
    return list(merged.values())



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
