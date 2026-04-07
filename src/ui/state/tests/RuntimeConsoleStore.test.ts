import { describe, expect, it, mock } from "bun:test";
import { RuntimeEventBuffer } from "../../../application/runtime/RuntimeEventBuffer";
import { createRuntimeEvent, RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import type { PythonRuntimeManagerStatus } from "../../../application/ports/interfaces/IPythonRuntimeManager";
import { RuntimeConsoleStore } from "../RuntimeConsoleStore";

describe("RuntimeConsoleStore", () => {
  it("subscribes to runtime events, tracks tabs, and supports clear/toggle", () => {
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
    expect(store.getState().logs).toHaveLength(1);
    expect(store.getState().activeTab).toBe("health");

    store.setActiveTab("logs");
    expect(store.getState().activeTab).toBe("logs");

    store.toggleExpanded();
    expect(store.getState().isExpanded).toBeTrue();

    store.openConsole("health");
    expect(store.getState().isExpanded).toBeTrue();
    expect(store.getState().activeTab).toBe("health");

    store.clearLogs();
    expect(store.getState().events).toHaveLength(0);
    expect(store.getState().logs).toHaveLength(0);
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

  it("refreshes runtime dependency orchestration before collecting MCP health details", async () => {
    const refresh = mock(async () => ({
      requestedDependencyId: "python-runtime",
      resolvedDependencyId: "python-runtime",
      providerId: "python-runtime-manager",
      state: "healthy",
      health: "healthy",
      availability: "available",
      available: true,
      degraded: false,
      checkedAt: "2026-03-20T10:15:00.000Z",
      dependencyChain: ["python-runtime"],
      fallbackDependencyIds: [],
      usedFallback: false,
      remediationHints: [],
    }));
    const store = new RuntimeConsoleStore({
      runtimeEventStore: new RuntimeEventBuffer(),
      pythonRuntimeManager: {
        checkAvailability: async () => true,
        ensureRuntimeAvailability: async () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "managed" as const,
          lastUpdatedAt: "2026-03-20T10:15:00.000Z",
          detail: "Runtime is healthy.",
        }),
        restartRuntime: async () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "managed" as const,
          lastUpdatedAt: "2026-03-20T10:15:00.000Z",
        }),
        getStatus: () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "managed" as const,
          lastUpdatedAt: "2026-03-20T10:15:00.000Z",
          detail: "Runtime is healthy.",
        }),
        stopManagedRuntime: async () => undefined,
      },
      runtimeDependencyOrchestrator: { refresh },
      mcpService: {
        getConnectionStatus: async () => ({
          enabled: true,
          state: "degraded" as const,
          checkedAt: "2026-03-20T10:15:01.000Z",
          dependencyStatus: {
            requestedDependencyId: "mcp-runtime",
            resolvedDependencyId: "mcp-runtime",
            providerId: "mcp-runtime-orchestration-gate",
            state: "starting",
            health: "degraded",
            availability: "degraded",
            available: false,
            degraded: false,
            checkedAt: "2026-03-20T10:15:01.000Z",
            dependencyChain: ["python-runtime", "mcp-runtime"],
            fallbackDependencyIds: [],
            usedFallback: false,
            detail: "MCP runtime is still starting.",
            remediationHints: ["Wait for startup to complete."],
          },
          servers: [],
          capabilities: { tools: false, resources: false, toolExecution: false },
        }),
        listConfiguredServers: async () => [],
        getServerStatus: async () => { throw new Error("unused"); },
      },
    });

    await store.refreshHealth();

    expect(refresh).toHaveBeenCalledWith("python-runtime");
    expect(store.getState().healthChecks[1]?.detail).toContain("Wait for startup to complete.");
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

  it("creates log entries for runtime initialization failures", async () => {
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
        getConnectionStatus: async () => ({
          enabled: false,
          state: "unavailable",
          checkedAt: new Date().toISOString(),
          servers: [],
          capabilities: {},
        }),
        listConfiguredServers: async () => [],
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

    const initializationLog = store.getState().logs.find((entry) => entry.message === "Python runtime initialization failed.");
    expect(initializationLog).toBeDefined();
    expect(initializationLog?.severity).toBe("error");
    expect(initializationLog?.details).toContain("runtime unavailable");
    expect(store.getState().appState).toBe("failed");
  });

  it("creates log entries for refresh failures", async () => {
    const store = new RuntimeConsoleStore({
      runtimeEventStore: new RuntimeEventBuffer(),
      pythonRuntimeManager: {
        checkAvailability: async () => true,
        ensureRuntimeAvailability: async () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "external" as const,
          lastUpdatedAt: "2026-03-20T00:00:00.000Z",
        }),
        restartRuntime: async () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "external" as const,
          lastUpdatedAt: "2026-03-20T00:00:00.000Z",
        }),
        getStatus: () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "external" as const,
          lastUpdatedAt: "2026-03-20T00:00:00.000Z",
        }),
        stopManagedRuntime: async () => undefined,
      },
      mcpService: {
        getConnectionStatus: async () => {
          throw new Error("Failed to execute 'fetch' on 'Window': Illegal invocation.");
        },
        listConfiguredServers: async () => [],
        getServerStatus: async () => {
          throw new Error("unexpected");
        },
      } as any,
    });

    await store.refreshHealth();

    const refreshLog = store.getState().logs.find((entry) => entry.message === "MCP runtime inspection failed.");
    expect(refreshLog).toBeDefined();
    expect(refreshLog?.severity).toBe("error");
    expect(refreshLog?.source).toBe("network");
    expect(refreshLog?.details).toContain("Illegal invocation");
  });

  it("treats cancelled MCP inspection requests as request-lifecycle noise instead of runtime failure", async () => {
    const store = new RuntimeConsoleStore({
      runtimeEventStore: new RuntimeEventBuffer(),
      pythonRuntimeManager: {
        checkAvailability: async () => true,
        ensureRuntimeAvailability: async () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "external" as const,
          lastUpdatedAt: "2026-03-20T00:00:00.000Z",
        }),
        restartRuntime: async () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "external" as const,
          lastUpdatedAt: "2026-03-20T00:00:00.000Z",
        }),
        getStatus: () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "external" as const,
          lastUpdatedAt: "2026-03-20T00:00:00.000Z",
        }),
        stopManagedRuntime: async () => undefined,
      },
      mcpService: {
        getConnectionStatus: async () => {
          throw new Error("Python runtime MCP request was cancelled.", {
            cause: new DOMException("signal is aborted without reason", "AbortError"),
          });
        },
        listConfiguredServers: async () => [],
        getServerStatus: async () => {
          throw new Error("unexpected");
        },
      } as any,
    });

    await store.refreshHealth();

    const cancelledLog = store.getState().logs.find((entry) => entry.message === "MCP runtime inspection request was cancelled.");
    expect(cancelledLog).toBeDefined();
    expect(cancelledLog?.severity).toBe("info");
    expect(store.getState().logs.find((entry) => entry.message === "MCP runtime inspection failed.")).toBeUndefined();
    expect(store.getState().healthChecks.find((entry) => entry.id === "mcp-runtime")?.status).toBe("unknown");
  });

  it("retains the previous healthy MCP runtime status when a later inspection request is cancelled", async () => {
    let invocation = 0;
    const store = new RuntimeConsoleStore({
      runtimeEventStore: new RuntimeEventBuffer(),
      pythonRuntimeManager: {
        checkAvailability: async () => true,
        ensureRuntimeAvailability: async () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "external" as const,
          lastUpdatedAt: "2026-03-20T00:00:00.000Z",
        }),
        restartRuntime: async () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "external" as const,
          lastUpdatedAt: "2026-03-20T00:00:00.000Z",
        }),
        getStatus: () => ({
          status: "healthy" as const,
          isAvailable: true,
          owner: "external" as const,
          lastUpdatedAt: "2026-03-20T00:00:00.000Z",
        }),
        stopManagedRuntime: async () => undefined,
      },
      mcpService: {
        getConnectionStatus: async () => {
          invocation += 1;
          if (invocation === 1) {
            return {
              enabled: true,
              state: "ready" as const,
              checkedAt: "2026-03-20T00:00:01.000Z",
              servers: [],
              capabilities: { tools: true, resources: true, toolExecution: true },
            };
          }

          throw new Error("Python runtime MCP request was cancelled.");
        },
        listConfiguredServers: async () => [],
        getServerStatus: async () => {
          throw new Error("unexpected");
        },
      } as any,
    });

    await store.refreshHealth();
    expect(store.getState().healthChecks.find((entry) => entry.id === "mcp-runtime")?.status).toBe("healthy");

    await store.refreshHealth();
    expect(store.getState().healthChecks.find((entry) => entry.id === "mcp-runtime")?.status).toBe("healthy");
    expect(store.getState().logs.find((entry) => entry.message === "MCP runtime inspection failed.")).toBeUndefined();
  });

  it("defaults to normal verbosity and lets the user switch to verbose mode", () => {
    const store = new RuntimeConsoleStore({
      runtimeEventStore: new RuntimeEventBuffer(),
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

    expect(store.getState().logVerbosity).toBe("normal");

    store.setLogVerbosity("verbose");

    expect(store.getState().logVerbosity).toBe("verbose");
  });

  it("records uncaught promise rejections with preserved diagnostics", () => {
    const previousWindow = (globalThis as typeof globalThis & { window?: unknown }).window;
    const listeners = new Map<string, Set<(event: any) => void>>();
    const fakeWindow = {
      addEventListener(type: string, listener: (event: any) => void) {
        const bucket = listeners.get(type) ?? new Set();
        bucket.add(listener);
        listeners.set(type, bucket);
      },
      removeEventListener(type: string, listener: (event: any) => void) {
        listeners.get(type)?.delete(listener);
      },
    };
    (globalThis as typeof globalThis & { window?: typeof fakeWindow }).window = fakeWindow;

    try {
      const store = new RuntimeConsoleStore({
        runtimeEventStore: new RuntimeEventBuffer(),
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

      const rootCause = new Error("Socket closed");
      rootCause.name = "NetworkError";
      rootCause.stack = "NetworkError: Socket closed\n    at fetch";
      const rejection = new Error("Failed to execute 'fetch' on 'Window': Illegal invocation.", { cause: rootCause });
      rejection.name = "TypeError";
      rejection.stack = "TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation.\n    at refreshHealth";

      listeners.get("unhandledrejection")?.forEach((listener) => listener({ reason: rejection }));

      const entry = store.getState().logs.find((log) => log.message === "Unhandled runtime management promise rejection.");
      expect(entry).toBeDefined();
      expect(entry?.source).toBe("network");
      expect(entry?.diagnostics?.causeChain).toHaveLength(2);
      expect(entry?.stack).toContain("Illegal invocation");

      store.dispose();
    } finally {
      (globalThis as typeof globalThis & { window?: unknown }).window = previousWindow;
    }
  });

  it("maps runtime event diagnostics into verbose-ready log entries", () => {
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

    eventStore.append(createRuntimeEvent({
      source: RuntimeEventSources.pythonRuntime,
      severity: "error",
      message: "MCP status check failed.",
      details: {
        diagnostics: {
          message: "Failed to execute 'fetch' on 'Window': Illegal invocation.",
          stack: "TypeError: Illegal invocation\n    at refreshHealth",
          cause: "Illegal invocation",
          causeChain: [
            { message: "Illegal invocation", name: "TypeError", stack: "TypeError: Illegal invocation\n    at refreshHealth" },
            { message: "Socket closed", name: "NetworkError", stack: "NetworkError: Socket closed\n    at fetch" },
          ],
          subsystem: "mcp-runtime",
          className: "HttpMcpRuntimeClient",
          methodName: "request",
          operation: "refresh-runtime-health",
          target: "/mcp/status",
          requestMethod: "GET",
          failedBeforeResponse: true,
          details: { phase: "phone-debug" },
          name: "TypeError",
        },
      },
    }));

    const entry = store.getState().logs.find((log) => log.message === "MCP status check failed.");
    expect(entry).toBeDefined();
    expect(entry?.requestMethod).toBe("GET");
    expect(entry?.target).toBe("/mcp/status");
    expect(entry?.stackPreview).toContain("Illegal invocation");
    expect(entry?.diagnostics?.causeChain).toHaveLength(2);
  });

  it("retains a bounded in-memory log buffer", () => {
    const eventStore = new RuntimeEventBuffer({ capacity: 10 });
    const store = new RuntimeConsoleStore({
      runtimeEventStore: eventStore,
      logCapacity: 3,
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

    for (let index = 0; index < 5; index += 1) {
      eventStore.append(
        createRuntimeEvent({
          source: RuntimeEventSources.app,
          severity: "info",
          message: `event-${index}`,
          timestamp: `2026-03-20T00:00:0${index}.000Z`,
        }),
      );
    }

    expect(store.getState().logs).toHaveLength(3);
    expect(store.getState().logs.map((entry) => entry.message)).toEqual(["event-2", "event-3", "event-4"]);
  });

  it("collapses consecutive duplicate runtime events and keeps a stable reconnecting message", async () => {
    let runtimeStatus: PythonRuntimeManagerStatus = {
      status: "healthy",
      isAvailable: true,
      owner: "managed",
      lastUpdatedAt: "2026-03-20T00:00:00.000Z",
      detail: "Runtime is healthy.",
    };
    const eventStore = new RuntimeEventBuffer();
    const checkAvailability = mock(async () => {
      if (runtimeStatus.status === "healthy") {
        runtimeStatus = {
          status: "unavailable",
          isAvailable: false,
          owner: "managed",
          lastUpdatedAt: "2026-03-20T00:00:03.000Z",
          detail: "Runtime unavailable while retrying.",
        };
        return false;
      }

      return runtimeStatus.isAvailable;
    });
    const store = new RuntimeConsoleStore({
      runtimeEventStore: eventStore,
      pythonRuntimeManager: {
        checkAvailability,
        ensureRuntimeAvailability: async () => runtimeStatus,
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

    eventStore.append(createRuntimeEvent({
      source: RuntimeEventSources.pythonRuntime,
      severity: "warning",
      message: "Trying to reconnect…",
      timestamp: "2026-03-20T00:00:01.000Z",
    }));
    eventStore.append(createRuntimeEvent({
      source: RuntimeEventSources.pythonRuntime,
      severity: "warning",
      message: "Trying to reconnect…",
      timestamp: "2026-03-20T00:00:02.000Z",
    }));

    await store.initializeRuntime();
    await store.refreshHealth();

    expect(store.getState().events.map((entry) => entry.message)).toEqual(["Trying to reconnect…"]);
    expect(store.getState().logs.filter((entry) => entry.message === "Trying to reconnect…")).toHaveLength(1);
    expect(store.getState().appState).toBe("reconnecting");
    expect(store.getState().appStateDetail).toBe("Trying to reconnect to the Python runtime…");
  });

  it("keeps reconnecting state stable across retry failures until retries are exhausted", async () => {
    let runtimeStatus: PythonRuntimeManagerStatus = {
      status: "healthy",
      isAvailable: true,
      owner: "managed",
      lastUpdatedAt: "2026-03-20T00:00:00.000Z",
      detail: "Python runtime is healthy.",
    };
    const eventStore = new RuntimeEventBuffer();
    const store = new RuntimeConsoleStore({
      runtimeEventStore: eventStore,
      pythonRuntimeManager: (() => {
        let availabilityChecks = 0;
        return {
          checkAvailability: async () => {
            availabilityChecks += 1;
            if (availabilityChecks === 1) {
              return true;
            }

            if (runtimeStatus.status === "healthy") {
              runtimeStatus = {
                ...runtimeStatus,
                status: "failed",
                isAvailable: false,
                detail: "Python runtime health check failed.",
              };
            }
            return false;
          },
          ensureRuntimeAvailability: async () => runtimeStatus,
          restartRuntime: async () => runtimeStatus,
          getStatus: () => runtimeStatus,
          stopManagedRuntime: async () => undefined,
        };
      })(),
      runtimeManagement: {
        isManagedLocal: true,
        autoStartEnabled: true,
        healthPollIntervalMs: 5_000,
      },
    });

    await store.initializeRuntime();
    await store.refreshHealth();

    expect(store.getState().appState).toBe("reconnecting");
    expect(store.getState().appStateDetail).toBe("Trying to reconnect to the Python runtime…");

    runtimeStatus = {
      ...runtimeStatus,
      detail: "Python runtime restart circuit is open until 2026-03-20T00:01:00.000Z.",
    };

    await store.refreshHealth();

    expect(store.getState().appState).toBe("failed");
    expect(store.getState().appStateDetail).toBe("Python runtime restart circuit is open until 2026-03-20T00:01:00.000Z.");
  });
});
