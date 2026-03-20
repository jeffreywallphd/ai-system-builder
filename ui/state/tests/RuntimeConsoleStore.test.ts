import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../application/runtime/RuntimeEventBuffer";
import { createRuntimeEvent, RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import { RuntimeConsoleStore } from "../RuntimeConsoleStore";

describe("RuntimeConsoleStore", () => {
  it("subscribes to runtime events and supports clear/toggle", () => {
    const eventStore = new RuntimeEventBuffer();
    const store = new RuntimeConsoleStore({
      runtimeEventStore: eventStore,
      pythonRuntimeManager: {
        checkAvailability: async () => true,
        ensureRuntimeAvailability: async () => ({
          status: "healthy",
          isAvailable: true,
          owner: "external",
          lastUpdatedAt: new Date().toISOString(),
        }),
        getStatus: () => ({
          status: "healthy",
          isAvailable: true,
          owner: "external",
          lastUpdatedAt: new Date().toISOString(),
        }),
        stopManagedRuntime: async () => undefined,
      },
    });

    eventStore.append(createRuntimeEvent({ source: RuntimeEventSources.app, severity: "info", message: "boot" }));
    expect(store.getState().events).toHaveLength(1);

    store.toggleExpanded();
    expect(store.getState().isExpanded).toBeTrue();

    store.clearEvents();
    expect(store.getState().events).toHaveLength(0);
  });

  it("initializes runtime once", async () => {
    let calls = 0;
    const store = new RuntimeConsoleStore({
      runtimeEventStore: new RuntimeEventBuffer(),
      pythonRuntimeManager: {
        checkAvailability: async () => true,
        ensureRuntimeAvailability: async () => {
          calls += 1;
          return {
            status: "healthy" as const,
            isAvailable: true,
            owner: "external" as const,
            lastUpdatedAt: new Date().toISOString(),
          };
        },
        getStatus: () => ({
          status: "healthy",
          isAvailable: true,
          owner: "external",
          lastUpdatedAt: new Date().toISOString(),
        }),
        stopManagedRuntime: async () => undefined,
      },
    });

    await Promise.all([store.initializeRuntime(), store.initializeRuntime()]);
    expect(calls).toBe(1);
  });

  it("captures runtime and MCP server health snapshots", async () => {
    const now = new Date().toISOString();
    const store = new RuntimeConsoleStore({
      runtimeEventStore: new RuntimeEventBuffer(),
      pythonRuntimeManager: {
        checkAvailability: async () => true,
        ensureRuntimeAvailability: async () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "external" as const,
          lastUpdatedAt: now,
        }),
        getStatus: () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "external" as const,
          lastUpdatedAt: now,
        }),
        stopManagedRuntime: async () => undefined,
      },
      mcpService: {
        listConfiguredServers: async () => ([
          {
            id: "local",
            name: "Local MCP",
            transport: "stdio",
            status: "disconnected",
            connected: false,
            toolCount: 0,
            resourceCount: 0,
            capabilities: { tools: true },
          },
        ]),
        getServerStatus: async () => ({
          serverId: "local",
          name: "Local MCP",
          transport: "stdio",
          configured: true,
          enabled: true,
          state: "connected",
          connected: true,
          checkedAt: now,
          toolCount: 1,
          resourceCount: 0,
          capabilities: { tools: true },
        }),
      } as any,
    });

    await store.refreshHealth();

    expect(store.getState().healthChecks.map((check) => check.label)).toEqual(["Python runtime", "Local MCP"]);
    expect(store.getState().healthChecks[1]?.status).toBe("healthy");
  });

  it("swallows runtime initialization failures", async () => {
    const store = new RuntimeConsoleStore({
      runtimeEventStore: new RuntimeEventBuffer(),
      pythonRuntimeManager: {
        checkAvailability: async () => false,
        ensureRuntimeAvailability: async () => {
          throw new Error("runtime unavailable");
        },
        getStatus: () => ({
          status: "unavailable",
          isAvailable: false,
          owner: "none",
          lastUpdatedAt: new Date().toISOString(),
        }),
        stopManagedRuntime: async () => undefined,
      },
      mcpService: {
        listConfiguredServers: async () => {
          throw new Error("mcp unavailable");
        },
        getServerStatus: async () => {
          throw new Error("mcp unavailable");
        },
      } as any,
    });

    await expect(store.initializeRuntime()).resolves.toBeUndefined();
    expect(store.getState().healthChecks.some((check) => check.label === "MCP runtime")).toBeTrue();
  });
});
