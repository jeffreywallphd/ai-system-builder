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
            "MCP_RUNTIME_SERVERS_JSON": '[{"id": "local", "name": "Local MCP", "transport": "inmemory"}]',
        }
    )

    assert config.enabled is True
    assert config.timeout_ms == 2500
    assert config.connect_on_startup is True
    assert len(config.servers) == 1
    assert config.servers[0].id == "local"
