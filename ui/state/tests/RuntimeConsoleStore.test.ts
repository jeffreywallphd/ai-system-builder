import { describe, expect, it, mock } from "bun:test";
import { RuntimeEventBuffer } from "../../../application/runtime/RuntimeEventBuffer";
import { createRuntimeEvent, RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import type { PythonRuntimeManagerStatus } from "../../../application/ports/interfaces/IPythonRuntimeManager";
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
        restartRuntime: async () => ({
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

  it("initializes runtime once and reports a ready app state", async () => {
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
            owner: "managed" as const,
            lastUpdatedAt: new Date().toISOString(),
            detail: "Runtime is healthy.",
          };
        },
        restartRuntime: async () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "managed" as const,
          lastUpdatedAt: new Date().toISOString(),
        }),
        getStatus: () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "managed" as const,
          lastUpdatedAt: new Date().toISOString(),
          detail: "Runtime is healthy.",
        }),
        stopManagedRuntime: async () => undefined,
      },
      runtimeManagement: {
        isManagedLocal: true,
        autoStartEnabled: true,
        healthPollIntervalMs: 5_000,
      },
    });

    await Promise.all([store.initializeRuntime(), store.initializeRuntime()]);

    expect(calls).toBe(1);
    expect(store.getState().appState).toBe("ready");
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
        restartRuntime: async () => ({
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
        getConnectionStatus: async () => ({
          enabled: true,
          state: "ready",
          checkedAt: now,
          servers: [
            {
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
            },
          ],
          capabilities: { tools: true },
        }),
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

    expect(store.getState().healthChecks.map((check) => check.label)).toEqual(["Python runtime", "MCP runtime", "Local MCP"]);
    expect(store.getState().healthChecks[1]?.status).toBe("healthy");
    expect(store.getState().healthChecks[2]?.status).toBe("healthy");
  });

  it("attempts managed-local recovery after an unexpected runtime loss", async () => {
    let runtimeStatus: PythonRuntimeManagerStatus = {
      status: "healthy" as const,
      isAvailable: true,
      owner: "managed" as const,
      lastUpdatedAt: "2026-03-20T00:00:00.000Z",
      detail: "Runtime is healthy.",
    };
    const ensureRuntimeAvailability = mock(async () => {
      if (!runtimeStatus.isAvailable) {
        runtimeStatus = {
          status: "healthy",
          isAvailable: true,
          owner: "managed",
          lastUpdatedAt: "2026-03-20T00:00:06.000Z",
          detail: "Runtime recovered.",
        };
      }

      return runtimeStatus;
    });
    const checkAvailability = mock(async () => {
      if (runtimeStatus.status === "healthy") {
        runtimeStatus = {
          status: "unavailable",
          isAvailable: false,
          owner: "managed",
          lastUpdatedAt: "2026-03-20T00:00:05.000Z",
          detail: "Python runtime exited unexpectedly.",
        };
        return false;
      }

      return runtimeStatus.isAvailable;
    });
    const store = new RuntimeConsoleStore({
      runtimeEventStore: new RuntimeEventBuffer(),
      pythonRuntimeManager: {
        checkAvailability,
        ensureRuntimeAvailability,
        restartRuntime: async () => runtimeStatus,
        getStatus: () => runtimeStatus,
        stopManagedRuntime: async () => undefined,
      },
      runtimeManagement: {
        isManagedLocal: true,
        autoStartEnabled: true,
        healthPollIntervalMs: 5_000,
      },
    });

    await store.initializeRuntime();
    await store.refreshHealth();

    expect(ensureRuntimeAvailability).toHaveBeenCalledTimes(3);
    expect(store.getState().appState).toBe("ready");
    expect(store.getState().appStateDetail).toBe("Runtime recovered.");
  });

  it("swallows runtime initialization failures and surfaces a failed app state", async () => {
    const store = new RuntimeConsoleStore({
      runtimeEventStore: new RuntimeEventBuffer(),
      pythonRuntimeManager: {
        checkAvailability: async () => false,
        ensureRuntimeAvailability: async () => {
          throw new Error("runtime unavailable");
        },
        restartRuntime: async () => ({
          status: "failed",
          isAvailable: false,
          owner: "managed",
          lastUpdatedAt: new Date().toISOString(),
          detail: "runtime unavailable",
        }),
        getStatus: () => ({
          status: "failed",
          isAvailable: false,
          owner: "managed",
          lastUpdatedAt: new Date().toISOString(),
          detail: "runtime unavailable",
        }),
        stopManagedRuntime: async () => undefined,
      },
      mcpService: {
        getConnectionStatus: async () => {
          throw new Error("mcp unavailable");
        },
        listConfiguredServers: async () => {
          throw new Error("mcp unavailable");
        },
        getServerStatus: async () => {
          throw new Error("mcp unavailable");
        },
      } as any,
      runtimeManagement: {
        isManagedLocal: true,
        autoStartEnabled: true,
        healthPollIntervalMs: 5_000,
      },
    });

    await expect(store.initializeRuntime()).resolves.toBeUndefined();
    expect(store.getState().appState).toBe("failed");
    expect(store.getState().healthChecks.some((check) => check.label === "MCP runtime")).toBeTrue();
  });
});
