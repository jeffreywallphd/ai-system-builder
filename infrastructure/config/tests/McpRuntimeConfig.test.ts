import { describe, expect, it } from "bun:test";
import { McpRuntimeConfig } from "../McpRuntimeConfig";

describe("McpRuntimeConfig", () => {
  it("defaults to a disabled MCP runtime", () => {
    const config = new McpRuntimeConfig();
    expect(config.enabled).toBe(false);
    expect(config.timeoutMs).toBe(10000);
    expect(config.connectOnStartup).toBe(false);
    expect(config.servers).toEqual([]);
  });

  it("loads aligned server configuration from env", () => {
    const config = McpRuntimeConfig.fromEnv({
      MCP_RUNTIME_ENABLED: "true",
      MCP_RUNTIME_TIMEOUT_MS: "2500",
      MCP_RUNTIME_CONNECT_ON_STARTUP: "yes",
      MCP_RUNTIME_SERVERS_JSON: JSON.stringify([
        {
          id: "local",
          name: "Local MCP",
          transport: "stdio",
          command: "python",
          args: ["server.py"],
          env: { MCP_MODE: "test" },
          timeoutMs: 9000,
          connectOnStartup: true,
        },
        {
          id: "remote",
          name: "Remote MCP",
          transport: "http",
          url: "http://localhost:9000/mcp",
          enabled: false,
        },
      ]),
    });

    expect(config.enabled).toBe(true);
    expect(config.timeoutMs).toBe(2500);
    expect(config.connectOnStartup).toBe(true);
    expect(config.servers[0]?.command).toBe("python");
    expect(config.servers[0]?.env).toEqual({ MCP_MODE: "test" });
    expect(config.servers[0]?.timeoutMs).toBe(9000);
    expect(config.servers[1]?.enabled).toBe(false);
  });

  it("rejects invalid transport-specific configuration", () => {
    expect(
      () =>
        new McpRuntimeConfig({
          enabled: true,
          servers: [{ id: "local", name: "Local MCP", transport: "stdio" }],
        }),
    ).toThrow("requires a command");

    expect(
      () =>
        new McpRuntimeConfig({
          enabled: true,
          servers: [{ id: "remote", name: "Remote MCP", transport: "http" }],
        }),
    ).toThrow("requires a url");
  });
});
