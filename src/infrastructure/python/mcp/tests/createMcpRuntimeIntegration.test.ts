import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../../application/runtime/RuntimeEventBuffer";
import {
  RuntimeDependencyIds,
  RuntimeDependencyOperationalStates,
  RuntimeDependencyUnavailableError,
} from "../../../../application/runtime/RuntimeDependencyOrchestrator";
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

  it("returns degraded MCP read responses while the dependency chain is still starting", async () => {
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
              state: RuntimeDependencyOperationalStates.starting,
              detail: "Python runtime is still starting.",
              remediationHints: ["Wait for startup to finish."],
            }),
          },
          {
            dependencyId: RuntimeDependencyIds.mcpRuntime,
            providerId: "mcp-test",
            dependsOn: [RuntimeDependencyIds.pythonRuntime],
            ensureAvailable: async () => ({
              state: RuntimeDependencyOperationalStates.healthy,
            }),
          },
        ],
      }),
    );

    const status = await integration.runtimeClient.getConnectionStatus();
    const connectResult = await integration.serverManager.connectServer({ serverId: "demo" });

    expect(status.state).toBe("degraded");
    expect(status.healthState).toBe("degraded");
    expect(status.dependencyStatus).toBeDefined();
    expect(connectResult.runtime.state).toBe("degraded");
    expect(connectResult.metadata?.state).toBe(RuntimeDependencyOperationalStates.starting);
  });

  it("throws for mutating repository operations when the runtime chain is unavailable", async () => {
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
              state: RuntimeDependencyOperationalStates.failed,
              detail: "Python runtime crashed.",
              remediationHints: ["Restart the Python runtime."],
            }),
          },
          {
            dependencyId: RuntimeDependencyIds.mcpRuntime,
            providerId: "mcp-test",
            dependsOn: [RuntimeDependencyIds.pythonRuntime],
            ensureAvailable: async () => ({
              state: RuntimeDependencyOperationalStates.healthy,
            }),
          },
        ],
      }),
    );

    await expect(
      integration.configuredServerRepository?.saveConfiguredServer({
        id: "demo",
        name: "Demo",
        transport: "http",
        enabled: true,
        status: "error",
        connected: false,
        toolCount: 0,
        resourceCount: 0,
        capabilities: { tools: false, resources: false, toolExecution: false },
      }),
    ).rejects.toBeInstanceOf(RuntimeDependencyUnavailableError);
  });
});
