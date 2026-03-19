import pytest

from app.core.mcp_config import load_mcp_runtime_config


def test_mcp_runtime_config_defaults() -> None:
    config = load_mcp_runtime_config({})

    assert config.enabled is False
    assert config.timeout_ms == 10000
    assert config.connect_on_startup is False
    assert config.servers == []


def test_mcp_runtime_config_parses_servers_json() -> None:
    config = load_mcp_runtime_config(
        {
            "MCP_RUNTIME_ENABLED": "true",
            "MCP_RUNTIME_TIMEOUT_MS": "2500",
            "MCP_RUNTIME_CONNECT_ON_STARTUP": "yes",
            "MCP_RUNTIME_SERVERS_JSON": '[{"id": "local", "name": "Local MCP", "transport": "stdio", "command": "python", "args": ["server.py"], "env": {"MCP_MODE": "test"}, "timeout_ms": 5000, "connect_on_startup": false}, {"id": "remote", "name": "Remote MCP", "transport": "http", "url": "http://localhost:9000/mcp"}]',
        }
    )

    assert config.enabled is True
    assert config.timeout_ms == 2500
    assert config.connect_on_startup is True
    assert len(config.servers) == 2
    assert config.servers[0].command == "python"
    assert config.servers[0].env == {"MCP_MODE": "test"}
    assert config.servers[0].timeout_ms == 5000
    assert config.should_connect_on_startup(config.servers[0]) is False
    assert config.should_connect_on_startup(config.servers[1]) is True


def test_mcp_runtime_config_rejects_invalid_transport_specific_config() -> None:
    with pytest.raises(ValueError, match="requires a command"):
        load_mcp_runtime_config(
            {
                "MCP_RUNTIME_SERVERS_JSON": '[{"id": "local", "name": "Local MCP", "transport": "stdio"}]',
            }
        ).servers

    with pytest.raises(ValueError, match="requires a url"):
        load_mcp_runtime_config(
            {
                "MCP_RUNTIME_SERVERS_JSON": '[{"id": "remote", "name": "Remote MCP", "transport": "http"}]',
            }
        ).servers
