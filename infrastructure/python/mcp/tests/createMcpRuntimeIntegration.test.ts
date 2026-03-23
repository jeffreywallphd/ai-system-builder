import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../../application/runtime/RuntimeEventBuffer";
import { RuntimeDependencyIds } from "../../../../application/runtime/RuntimeDependencyOrchestrator";
import { NodeProcessRuntimeEventSink } from "../../runtime/NodeProcessRuntimeEventSink";
import { PythonRuntimeConfig } from "../../../config/PythonRuntimeConfig";
import { DefaultRuntimeDependencyOrchestrator } from "../../../runtime/DefaultRuntimeDependencyOrchestrator";
import { createMcpRuntimeIntegration } from "../createMcpRuntimeIntegration";

describe("createMcpRuntimeIntegration", () => {
  it("returns consistent disabled MCP abstractions", async () => {
    const integration = createMcpRuntimeIntegration(
      new PythonRuntimeConfig({ mode: "disabled" }),
      new NodeProcessRuntimeEventSink(new RuntimeEventBuffer()),
    );

    const localServer = await integration.serverManager.createLocalServer({
      serverId: "local-disabled",
      toolName: "local-disabled",
      description: "Disabled runtime fallback",
      language: "python",
      script: "print('noop')",
    });

    expect((await integration.runtimeClient.getConnectionStatus()).enabled).toBeFalse();
    expect((await integration.serverCatalog.listConfiguredServers())).toEqual([]);
    expect(localServer.created).toBeFalse();
    expect(localServer.server.id).toBe("local-disabled");
  });

  it("wires the enabled MCP abstractions to the shared runtime clients", () => {
    const integration = createMcpRuntimeIntegration(
      new PythonRuntimeConfig({ mode: "managed-local", baseUrl: "http://127.0.0.1:8100" }),
      new NodeProcessRuntimeEventSink(new RuntimeEventBuffer()),
    );

    expect(integration.configuredServerRepository).toBeDefined();
    expect(typeof integration.runtimeClient.executeTool).toBe("function");
    expect(typeof integration.serverManager.createLocalServer).toBe("function");
    expect(typeof integration.toolCatalog.listTools).toBe("function");
    expect(typeof integration.toolExecutor.executeTool).toBe("function");
  });
  it("short-circuits MCP operations when the Python dependency chain is unavailable", async () => {
    const integration = createMcpRuntimeIntegration(
      new PythonRuntimeConfig({ mode: "managed-local", baseUrl: "http://127.0.0.1:8100" }),
      new NodeProcessRuntimeEventSink(new RuntimeEventBuffer()),
      fetch,
      new DefaultRuntimeDependencyOrchestrator({
        registrations: [
          {
            dependencyId: RuntimeDependencyIds.pythonRuntime,
            providerId: "python-test",
            ensureAvailable: async () => ({
              available: false,
              detail: "Python runtime is unavailable.",
            }),
          },
          {
            dependencyId: RuntimeDependencyIds.mcpRuntime,
            providerId: "mcp-test",
            dependsOn: [RuntimeDependencyIds.pythonRuntime],
            ensureAvailable: async () => ({
              available: true,
            }),
          },
        ],
      }),
    );

    const status = await integration.runtimeClient.getConnectionStatus();
    const connectResult = await integration.serverManager.connectServer({ serverId: "demo" });

    expect(status.state).toBe("unavailable");
    expect(status.dependencyStatus).toBeDefined();
    expect(connectResult.runtime.state).toBe("unavailable");
    expect(connectResult.metadata?.reason).toBe("runtime-dependency-unavailable");
  });

});
