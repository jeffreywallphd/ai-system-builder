import json
from pathlib import Path

from app.mcp.provisioning import (
    LocalMcpServerProvisioner,
    build_bootstrapped_mcp_runtime_config,
)


class RecordingInstallRunner:
    def __init__(self) -> None:
        self.calls: list[tuple[list[str], Path]] = []

    def __call__(self, command: list[str], cwd: Path) -> None:
        self.calls.append((command, cwd))


def test_local_mcp_server_provisioner_creates_default_calculator_server(tmp_path: Path) -> None:
    installer = RecordingInstallRunner()
    provisioner = LocalMcpServerProvisioner(
        workspace_root=tmp_path,
        python_executable="python-test",
        install_runner=installer,
    )

    servers = provisioner.provision_defaults()

    assert len(servers) == 1
    server = servers[0]
    server_root = tmp_path / server.id
    assert installer.calls == [(["python-test", "-m", "pip", "install", "mcp[cli]"], server_root)]
    assert server.command == "python-test"
    assert server.args == [str(server_root / "server.py")]
    assert server.connect_on_startup is True
    assert server.metadata["provisioningStatus"] == "created"
    assert server.mock_tools[0]["name"] == "calculate"
    assert server.mock_tools[0]["inputSchema"]["properties"]["operation"]["enum"] == [
        "add",
        "subtract",
        "multiply",
        "divide",
    ]
    assert (server_root / "server.py").exists() is True
    assert (server_root / "manifest.json").exists() is True
    state = json.loads((server_root / ".provisioned.json").read_text(encoding="utf-8"))
    assert state["serverId"] == "local-calculator"
    assert state["toolNames"] == ["calculate"]


def test_local_mcp_server_provisioner_is_idempotent_for_existing_server(tmp_path: Path) -> None:
    installer = RecordingInstallRunner()
    provisioner = LocalMcpServerProvisioner(
        workspace_root=tmp_path,
        python_executable="python-test",
        install_runner=installer,
    )

    first_servers = provisioner.provision_defaults()
    second_servers = provisioner.provision_defaults()

    assert len(installer.calls) == 1
    assert first_servers[0].id == second_servers[0].id
    assert second_servers[0].metadata["provisioningStatus"] == "existing"


def test_bootstrapped_runtime_config_merges_default_server_with_explicit_servers(tmp_path: Path) -> None:
    installer = RecordingInstallRunner()
    provisioner = LocalMcpServerProvisioner(
        workspace_root=tmp_path,
        python_executable="python-test",
        install_runner=installer,
    )
    provisioner.provision_defaults()

    config = build_bootstrapped_mcp_runtime_config(
        {
            "MCP_RUNTIME_ENABLED": "false",
            "MCP_RUNTIME_WORKSPACE_ROOT": str(tmp_path),
            "MCP_RUNTIME_PYTHON_EXECUTABLE": "python-test",
            "MCP_RUNTIME_SERVERS_JSON": json.dumps([
                {
                    "id": "remote-docs",
                    "name": "Remote Docs",
                    "transport": "http",
                    "url": "http://localhost:9100/mcp",
                }
            ]),
        }
    )

    server_ids = [server.id for server in config.servers]
    assert config.enabled is True
    assert server_ids == ["local-calculator", "remote-docs"]
