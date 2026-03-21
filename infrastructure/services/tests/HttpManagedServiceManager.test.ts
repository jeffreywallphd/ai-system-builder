import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../application/runtime/RuntimeEventBuffer";
import {
  ManagedServiceKinds,
  ManagedServiceOwnership,
  ManagedServiceStartPolicies,
  ManagedServiceStates,
} from "../../../application/services/interfaces/ManagedServiceTypes";
import { ManagedServiceRestartPolicies, ManagedServiceTransports } from "../../../application/services/ManagedServiceDefinition";
import { NodeProcessRuntimeEventSink } from "../../python/runtime/NodeProcessRuntimeEventSink";
import { InMemoryManagedServiceDefinitionRegistry } from "../InMemoryManagedServiceDefinitionRegistry";
import { HttpManagedServiceManager } from "../HttpManagedServiceManager";

describe("HttpManagedServiceManager", () => {
  it("tracks supervisor-backed state, emits status updates, and de-duplicates logs", async () => {
    const definition = {
      serviceId: "python-runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      displayName: "Python runtime",
      description: "Test definition",
      transport: ManagedServiceTransports.http,
      baseUrl: "http://127.0.0.1:8000",
      healthCheckPath: "/health",
      workingDirectory: "python-runtime",
      command: "python",
      args: ["-m", "uvicorn"],
      environmentVariables: {},
      autoStartPolicy: ManagedServiceStartPolicies.onDemand,
      restartPolicy: ManagedServiceRestartPolicies.onFailure,
      startupTimeoutMs: 20_000,
      tags: ["python"],
      capabilities: ["workflow-execution"],
    } as const;

    let snapshot = {
      serviceId: "python-runtime",
      name: "Python runtime",
      args: ["-m", "uvicorn"],
      pid: null,
      startedAt: null,
      lastHealthCheckAt: "2026-03-20T00:00:00.000Z",
      state: "stopped",
      ownership: "none",
      detail: "Python runtime is stopped.",
      recentLogs: [
        { timestamp: "2026-03-20T00:00:00.000Z", level: "info", message: "Python runtime registered." },
      ],
      processHistory: [],
      metadata: { version: "dev", compatibility: {} },
      diagnostics: {
        lastError: null,
        lastExit: null,
        lastStart: null,
        lastHealthProbe: null,
        provisioning: {
          state: "provisioned",
          required: true,
          requestedVersion: "3.12",
          resolvedVersion: "3.12.7",
          resolvedInterpreter: "/usr/bin/python3.12",
          environmentPath: "python-runtime/.venv",
          versionMismatch: false,
          needsReprovision: false,
          lastUpdatedAt: "2026-03-20T00:00:00.000Z",
          lastError: null,
        },
        circuitBreaker: {
          state: "closed",
          openedAt: null,
          retryAfter: null,
          recentFailures: 0,
          maxFailures: 3,
          failureWindowMs: 60_000,
          cooldownMs: 30_000,
        },
      },
    } as const;

    const store = new RuntimeEventBuffer();
    const statusUpdates: string[] = [];
    const logMessages: string[] = [];
    const manager = new HttpManagedServiceManager({
      client: {
        health: async () => ({ ok: true, mode: "service-supervisor", host: "127.0.0.1", port: 8790, serviceCount: 1, services: [snapshot] }),
        listServices: async () => ({ ok: true, services: [snapshot] }),
        getService: async () => ({ ok: true, service: snapshot }),
        start: async () => {
          snapshot = {
            ...snapshot,
            pid: 4321,
            startedAt: "2026-03-20T00:00:05.000Z",
            lastHealthCheckAt: "2026-03-20T00:00:06.000Z",
            state: "healthy",
            ownership: "managed",
            detail: "Python runtime health check passed.",
            recentLogs: [
              ...snapshot.recentLogs,
              { timestamp: "2026-03-20T00:00:05.000Z", level: "info", message: "Starting Python runtime." },
            ],
          };
          return { ok: true, service: snapshot };
        },
        stop: async () => ({ ok: true, service: snapshot }),
        restart: async () => ({ ok: true, service: snapshot }),
        ensureRunning: async () => ({ ok: true, service: snapshot }),
        provision: async () => ({ ok: true, service: snapshot }),
        repair: async () => ({ ok: true, service: snapshot }),
        recreateEnvironment: async () => ({ ok: true, service: snapshot }),
      },
      eventSink: new NodeProcessRuntimeEventSink(store),
      registry: new InMemoryManagedServiceDefinitionRegistry([definition]),
      registrations: [{ serviceId: definition.serviceId }],
    });

    manager.subscribeToStatus("python-runtime", (status) => {
      statusUpdates.push(status.state);
    });
    manager.subscribeToLogs("python-runtime", (event) => {
      logMessages.push(event.message);
    });

    expect(manager.getServiceStatus("python-runtime")?.state).toBe(ManagedServiceStates.unavailable);

    const refreshed = await manager.refreshServiceStatus("python-runtime");
    expect(refreshed.state).toBe(ManagedServiceStates.stopped);
    expect(refreshed.ownership).toBe(ManagedServiceOwnership.none);

    const started = await manager.start("python-runtime");
    expect(started.state).toBe(ManagedServiceStates.running);
    expect(started.ownership).toBe(ManagedServiceOwnership.managed);
    expect(started.isAvailable).toBeTrue();

    await manager.ensureRunning("python-runtime");

    expect(statusUpdates).toEqual([
      ManagedServiceStates.unavailable,
      ManagedServiceStates.stopped,
      ManagedServiceStates.running,
      ManagedServiceStates.running,
    ]);
    expect(logMessages).toEqual([
      "Python runtime registered.",
      "Starting Python runtime.",
    ]);
    expect(store.list().map((event) => event.message)).toEqual(logMessages);
  });
});
