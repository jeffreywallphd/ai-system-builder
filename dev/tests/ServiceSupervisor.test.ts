import http from "node:http";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "bun:test";
import {
  InMemoryServiceSupervisor,
  ServiceOwnership,
  ServiceStates,
  createNodeProcessRuntime,
  createSupervisorServer,
  loadServiceDefinitionsFromEnvironment,
} from "../service-supervisor.js";

const fixtureScriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "runtime-service.mjs",
);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const serversToClose: Array<{ close: () => Promise<unknown> }> = [];
const processesToStop: Array<{ supervisor: InMemoryServiceSupervisor; serviceId: string }> = [];
const tempDirectories: string[] = [];
const envKeysToRestore = [
  "SERVICE_SUPERVISOR_SERVICES",
  "SERVICE_SUPERVISOR_CONTROL_TOKEN",
  "SERVICE_SUPERVISOR_ALLOWED_EXECUTABLES",
  "SERVICE_SUPERVISOR_ALLOWED_PATHS",
  "PYTHON_RUNTIME_BASE_URL",
  "PYTHON_RUNTIME_EXECUTABLE",
  "PYTHON_RUNTIME_ARGS",
  "PYTHON_RUNTIME_ARGS_JSON",
  "PYTHON_RUNTIME_WORKDIR",
  "PYTHON_RUNTIME_ENV_JSON",
  "PYTHON_RUNTIME_HEALTH_PATH",
  "PYTHON_RUNTIME_STARTUP_TIMEOUT_MS",
  "PYTHON_RUNTIME_HEALTH_POLL_INTERVAL_MS",
  "PYTHON_RUNTIME_VERSION",
  "PYTHON_RUNTIME_COMPATIBILITY_JSON",
] as const;
const originalEnv = Object.fromEntries(envKeysToRestore.map((key) => [key, process.env[key]]));

afterEach(async () => {
  while (processesToStop.length > 0) {
    const processHandle = processesToStop.pop();
    if (processHandle) {
      await processHandle.supervisor.stop(processHandle.serviceId);
    }
  }

  while (serversToClose.length > 0) {
    const server = serversToClose.pop();
    if (server) {
      await server.close();
    }
  }

  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  for (const key of envKeysToRestore) {
    const value = originalEnv[key];
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
});

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to resolve test port."));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function readInitialSseChunk(url: string): Promise<{ contentType?: string; body: string }> {
  return await new Promise((resolve, reject) => {
    const request = http.get(url, { headers: { Accept: "text/event-stream" } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
        if (body.includes("event: snapshot")) {
          request.destroy();
          resolve({
            contentType: response.headers["content-type"],
            body,
          });
        }
      });
      response.on("error", reject);
    });

    request.on("error", reject);
  });
}

function createRuntimeDefinition(overrides: Record<string, unknown> = {}) {
  return {
    serviceId: "python-runtime",
    name: "Python runtime",
    command: process.execPath,
    args: [fixtureScriptPath],
    cwd: repoRoot,
    healthCheckPath: "/health",
    startupTimeoutMs: 1_000,
    healthPollIntervalMs: 25,
    stopTimeoutMs: 500,
    version: "1.2.3-test",
    compatibility: {
      supervisorApiVersion: 1,
      runtimeApiVersion: "2026-03",
      node: process.version,
    },
    ...overrides,
  };
}

function createManagedSupervisor(
  definition: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return new InMemoryServiceSupervisor({
    services: [definition],
    runtime: createNodeProcessRuntime(),
    ...overrides,
  });
}

describe("InMemoryServiceSupervisor", () => {
  it("starts dependencies before dependents and reports dependency readiness", async () => {
    const startOrder: string[] = [];
    const runtime = {
      async start(definition: any) {
        startOrder.push(definition.serviceId);
        return {
          pid: startOrder.length,
          startedAt: new Date().toISOString(),
          detail: `Started ${definition.name}.`,
          logs: [],
          exitPromise: new Promise(() => undefined),
        };
      },
      async stop(definition: any) {
        return { detail: `Stopped ${definition.name}.`, logs: [] };
      },
      async checkHealth(definition: any) {
        return {
          healthy: true,
          detail: `${definition.name} is healthy.`,
          logs: [],
          probe: {
            at: new Date().toISOString(),
            healthy: true,
            detail: `${definition.name} is healthy.`,
            url: null,
            statusCode: 200,
            durationMs: 1,
            errorCode: null,
          },
        };
      },
    };
    const supervisor = new InMemoryServiceSupervisor({
      runtime,
      services: [
        createRuntimeDefinition({ serviceId: "python-runtime" }),
        createRuntimeDefinition({ serviceId: "vector-store", name: "Vector store", dependencies: ["python-runtime"] }),
        createRuntimeDefinition({ serviceId: "model-gateway", name: "Model gateway", dependencies: ["vector-store"] }),
      ],
    });

    const started = await supervisor.start("model-gateway");

    expect(startOrder).toEqual(["python-runtime", "vector-store", "model-gateway"]);
    expect(started.dependencies).toEqual(["vector-store"]);
    expect(started.readiness.isReady).toBeTrue();
    expect(started.dependents).toEqual([]);
    expect(supervisor.getService("python-runtime")?.dependents).toEqual(["vector-store", "model-gateway"]);
  });

  it("restarts dependent chains before returning the selected service", async () => {
    const operations: string[] = [];
    const runtime = {
      async start(definition: any) {
        operations.push(`start:${definition.serviceId}`);
        return {
          pid: operations.length,
          startedAt: new Date().toISOString(),
          detail: `Started ${definition.name}.`,
          logs: [],
          exitPromise: new Promise(() => undefined),
        };
      },
      async stop(definition: any) {
        operations.push(`stop:${definition.serviceId}`);
        return { detail: `Stopped ${definition.name}.`, logs: [] };
      },
      async checkHealth(definition: any) {
        return {
          healthy: true,
          detail: `${definition.name} is healthy.`,
          logs: [],
          probe: {
            at: new Date().toISOString(),
            healthy: true,
            detail: `${definition.name} is healthy.`,
            url: null,
            statusCode: 200,
            durationMs: 1,
            errorCode: null,
          },
        };
      },
    };
    const supervisor = new InMemoryServiceSupervisor({
      runtime,
      services: [
        createRuntimeDefinition({ serviceId: "python-runtime" }),
        createRuntimeDefinition({ serviceId: "vector-store", name: "Vector store", dependencies: ["python-runtime"] }),
        createRuntimeDefinition({ serviceId: "model-gateway", name: "Model gateway", dependencies: ["vector-store"] }),
      ],
    });

    await supervisor.start("model-gateway");
    operations.length = 0;

    await supervisor.restart("python-runtime");

    expect(operations).toEqual([
      "stop:model-gateway",
      "stop:vector-store",
      "stop:python-runtime",
      "start:python-runtime",
      "start:vector-store",
      "start:model-gateway",
    ]);
  });

  it("starts the managed runtime, captures logs, and makes repeated start idempotent", async () => {
    const port = await getAvailablePort();
    const supervisor = createManagedSupervisor(createRuntimeDefinition({
      baseUrl: `http://127.0.0.1:${port}`,
      env: {
        TEST_RUNTIME_PORT: String(port),
        TEST_RUNTIME_HEALTHY_AFTER_MS: "0",
        TEST_RUNTIME_STDOUT_MESSAGE: "managed stdout",
        TEST_RUNTIME_STDERR_MESSAGE: "managed stderr",
      },
    }));
    processesToStop.push({ supervisor, serviceId: "python-runtime" });

    const started = await supervisor.start("python-runtime");
    const startedAgain = await supervisor.start("python-runtime");

    expect(started.state).toBe(ServiceStates.healthy);
    expect(started.ownership).toBe(ServiceOwnership.managed);
    expect(started.pid).toBeNumber();
    expect(started.startedAt).toBeString();
    expect(started.metadata.version).toBe("1.2.3-test");
    expect(started.metadata.compatibility.runtimeApiVersion).toBe("2026-03");
    expect(started.processHistory.some((entry) => entry.outcome === "started")).toBeTrue();
    expect(started.processHistory.some((entry) => entry.outcome === "healthy")).toBeTrue();
    expect(started.recentLogs.some((entry) => entry.level === "stdout" && entry.message.includes("managed stdout"))).toBeTrue();
    expect(started.recentLogs.some((entry) => entry.level === "stderr" && entry.message.includes("managed stderr"))).toBeTrue();
    expect(startedAgain.state).toBe(ServiceStates.healthy);
    expect(startedAgain.pid).toBe(started.pid);
    expect(startedAgain.detail).toContain("already healthy");
  });

  it("marks startup timeout as failed, captures probe diagnostics, and cleans up the process", async () => {
    const port = await getAvailablePort();
    const supervisor = createManagedSupervisor(createRuntimeDefinition({
      baseUrl: `http://127.0.0.1:${port}`,
      startupTimeoutMs: 100,
      healthPollIntervalMs: 10,
      env: {
        TEST_RUNTIME_PORT: String(port),
        TEST_RUNTIME_HEALTHY_AFTER_MS: "500",
      },
    }));

    const status = await supervisor.start("python-runtime");

    expect(status.state).toBe(ServiceStates.failed);
    expect(status.pid).toBeNull();
    expect(status.ownership).toBe(ServiceOwnership.none);
    expect(status.detail).toContain("timed out");
    expect(status.detail).toContain("Last probe");
    expect(status.diagnostics.lastError?.category).toBe("start");
    expect(status.diagnostics.lastHealthProbe?.healthy).toBeFalse();
  });

  it("marks crashes during startup as failed and records exit diagnostics", async () => {
    const port = await getAvailablePort();
    const supervisor = createManagedSupervisor(createRuntimeDefinition({
      baseUrl: `http://127.0.0.1:${port}`,
      startupTimeoutMs: 500,
      healthPollIntervalMs: 25,
      env: {
        TEST_RUNTIME_PORT: String(port),
        TEST_RUNTIME_HEALTHY_AFTER_MS: "500",
        TEST_RUNTIME_CRASH_AFTER_MS: "40",
      },
    }));

    const status = await supervisor.start("python-runtime");

    expect(status.state).toBe(ServiceStates.failed);
    expect(status.pid).toBeNull();
    expect(status.detail).toContain("exited unexpectedly during startup");
    expect(status.diagnostics.lastExit?.code).toBe(12);
    expect(status.recentLogs.some((entry) => entry.message.includes("crashing-during-startup"))).toBeTrue();
  });

  it("stops a managed runtime gracefully", async () => {
    const port = await getAvailablePort();
    const supervisor = createManagedSupervisor(createRuntimeDefinition({
      baseUrl: `http://127.0.0.1:${port}`,
      env: {
        TEST_RUNTIME_PORT: String(port),
        TEST_RUNTIME_HEALTHY_AFTER_MS: "0",
        TEST_RUNTIME_GRACEFUL_SHUTDOWN_DELAY_MS: "25",
      },
    }));

    const started = await supervisor.start("python-runtime");
    const stopped = await supervisor.stop("python-runtime");

    expect(started.state).toBe(ServiceStates.healthy);
    expect(stopped.state).toBe(ServiceStates.stopped);
    expect(stopped.pid).toBeNull();
    expect(stopped.ownership).toBe(ServiceOwnership.none);
    expect(stopped.recentLogs.some((entry) => entry.message.includes("received-sigterm"))).toBeTrue();

    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
  });

  it("restarts a managed runtime with a new process id", async () => {
    const port = await getAvailablePort();
    const supervisor = createManagedSupervisor(createRuntimeDefinition({
      baseUrl: `http://127.0.0.1:${port}`,
      env: {
        TEST_RUNTIME_PORT: String(port),
        TEST_RUNTIME_HEALTHY_AFTER_MS: "0",
      },
    }));
    processesToStop.push({ supervisor, serviceId: "python-runtime" });

    const started = await supervisor.start("python-runtime");
    const restarted = await supervisor.restart("python-runtime");

    expect(started.state).toBe(ServiceStates.healthy);
    expect(restarted.state).toBe(ServiceStates.healthy);
    expect(restarted.pid).toBeNumber();
    expect(restarted.pid).not.toBe(started.pid);
    expect(restarted.ownership).toBe(ServiceOwnership.managed);
  });

  it("detects an already-running external runtime without spawning a managed process", async () => {
    const port = await getAvailablePort();
    const externalServer = http.createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }
      res.writeHead(200);
      res.end("ok");
    });

    await new Promise<void>((resolve) => externalServer.listen(port, "127.0.0.1", resolve));
    serversToClose.push({ close: () => new Promise((resolve, reject) => externalServer.close((error) => error ? reject(error) : resolve(undefined))) });

    const supervisor = createManagedSupervisor(createRuntimeDefinition({
      baseUrl: `http://127.0.0.1:${port}`,
      command: "/definitely/not/a/real/executable",
      args: [],
    }), {
      allowedExecutables: [process.execPath, "/definitely/not/a/real/executable"],
    });

    const status = await supervisor.start("python-runtime");

    expect(status.state).toBe(ServiceStates.healthy);
    expect(status.ownership).toBe(ServiceOwnership.external);
    expect(status.pid).toBeNull();
    expect(status.detail).toContain("health check passed");
    expect(status.processHistory.at(-1)?.outcome).toBe("external-detected");
  });

  it("rejects unsafe command interpolation and invalid configuration with diagnostics", () => {
    const supervisor = createManagedSupervisor(createRuntimeDefinition({
      serviceId: "unsafe-runtime",
      command: "node;rm -rf /",
      args: [fixtureScriptPath],
    }));

    const status = supervisor.getService("unsafe-runtime");

    expect(status?.state).toBe(ServiceStates.failed);
    expect(status?.detail).toContain("Invalid service configuration");
    expect(status?.detail).toContain("shell interpolation");
    expect(status?.diagnostics.lastError?.category).toBe("config");
    expect(status?.processHistory.at(-1)?.outcome).toBe("config-rejected");
  });

  it("reports permission problems for non-executable commands", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "service-supervisor-"));
    tempDirectories.push(tempDir);
    const scriptPath = path.join(tempDir, "non-executable-runtime.sh");
    writeFileSync(scriptPath, "#!/bin/sh\necho nope\n", "utf8");
    chmodSync(scriptPath, 0o644);

    const supervisor = createManagedSupervisor(createRuntimeDefinition({
      serviceId: "permission-runtime",
      command: scriptPath,
      args: [],
    }), {
      allowedExecutables: [process.execPath, scriptPath],
    });

    const status = supervisor.getService("permission-runtime");

    expect(status?.state).toBe(ServiceStates.failed);
    expect(status?.detail).toContain("Permission denied");
    expect(status?.diagnostics.lastError?.message).toContain("Permission denied");
  });

  it("bounds logs and retained process metadata", async () => {
    const port = await getAvailablePort();
    const supervisor = createManagedSupervisor(createRuntimeDefinition({
      baseUrl: `http://127.0.0.1:${port}`,
      env: {
        TEST_RUNTIME_PORT: String(port),
        TEST_RUNTIME_HEALTHY_AFTER_MS: "0",
        TEST_RUNTIME_STDOUT_MESSAGE: "metadata stdout",
        TEST_RUNTIME_STDERR_MESSAGE: "metadata stderr",
      },
    }), {
      logLimit: 4,
      metadataRetentionLimit: 2,
    });

    await supervisor.start("python-runtime");
    await supervisor.restart("python-runtime");
    const stopped = await supervisor.stop("python-runtime");

    expect(stopped.recentLogs.length).toBeLessThanOrEqual(4);
    expect(stopped.processHistory.length).toBeLessThanOrEqual(2);
    expect(stopped.processHistory.at(-1)?.outcome).toBe("stopped");
  });

  it("opens a restart circuit breaker after repeated crash-loop failures", async () => {
    let now = Date.parse("2026-03-20T00:00:00.000Z");
    let nextPid = 1000;
    const clock = () => new Date(now);
    const runtime = {
      async start() {
        const pid = nextPid;
        nextPid += 1;
        return {
          pid,
          startedAt: new Date(now).toISOString(),
          detail: `Started flaky runtime ${pid}.`,
          exitPromise: Promise.resolve({ code: 9, signal: null }),
          logs: [],
        };
      },
      async stop() {
        return { detail: "stopped", logs: [] };
      },
      async checkHealth() {
        now += 10;
        return {
          healthy: false,
          detail: "health probe never succeeded",
          logs: [],
          probe: {
            at: new Date(now).toISOString(),
            healthy: false,
            detail: "health probe never succeeded",
            url: null,
            statusCode: null,
            durationMs: 1,
            errorCode: "ECONNREFUSED",
          },
        };
      },
    };

    const supervisor = new InMemoryServiceSupervisor({
      clock,
      sleep: async () => {
        now += 25;
      },
      runtime,
      services: [createRuntimeDefinition({
        serviceId: "flaky-runtime",
        command: process.execPath,
        args: [fixtureScriptPath],
        restartPolicy: {
          maxFailures: 2,
          failureWindowMs: 5_000,
          cooldownMs: 2_000,
        },
      })],
    });

    const firstFailure = await supervisor.start("flaky-runtime");
    const secondFailure = await supervisor.start("flaky-runtime");
    const blocked = await supervisor.start("flaky-runtime");

    expect(firstFailure.state).toBe(ServiceStates.failed);
    expect(secondFailure.diagnostics.circuitBreaker.state).toBe("open");
    expect(blocked.detail).toContain("restart circuit is open");
    expect(blocked.diagnostics.lastError?.category).toBe("circuit-breaker");
    expect(blocked.processHistory.at(-1)?.outcome).toBe("circuit-open");
  });
});

describe("service supervisor HTTP API", () => {
  it("exposes health, list, detail, and lifecycle endpoints", async () => {
    const port = await getAvailablePort();
    const servicePort = await getAvailablePort();
    const app = createSupervisorServer({
      host: "127.0.0.1",
      port,
      runtime: createNodeProcessRuntime(),
      services: [createRuntimeDefinition({
        baseUrl: `http://127.0.0.1:${servicePort}`,
        env: {
          TEST_RUNTIME_PORT: String(servicePort),
          TEST_RUNTIME_HEALTHY_AFTER_MS: "0",
        },
      })],
    });

    serversToClose.push(app);
    await app.listen();

    const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
    const listResponse = await fetch(`http://127.0.0.1:${port}/services`);
    const startResponse = await fetch(`http://127.0.0.1:${port}/services/python-runtime/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const detailResponse = await fetch(`http://127.0.0.1:${port}/services/python-runtime`);
    const ensureResponse = await fetch(`http://127.0.0.1:${port}/services/python-runtime/ensure-running`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const stopResponse = await fetch(`http://127.0.0.1:${port}/services/python-runtime/stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const missingResponse = await fetch(`http://127.0.0.1:${port}/services/unknown-service`);

    const health = await healthResponse.json();
    const list = await listResponse.json();
    const started = await startResponse.json();
    const detail = await detailResponse.json();
    const ensured = await ensureResponse.json();
    const stopped = await stopResponse.json();
    const missing = await missingResponse.json();

    expect(healthResponse.status).toBe(200);
    expect(health.mode).toBe("service-supervisor");
    expect(health.serviceCount).toBe(1);
    expect(list.services).toHaveLength(1);
    expect(started.service.state).toBe(ServiceStates.healthy);
    expect(started.service.ownership).toBe(ServiceOwnership.managed);
    expect(detail.service.serviceId).toBe("python-runtime");
    expect(detail.service.recentLogs.length).toBeGreaterThan(0);
    expect(detail.service.metadata.version).toBe("1.2.3-test");
    expect(ensured.service.detail).toContain("health check passed");
    expect(stopped.service.state).toBe(ServiceStates.stopped);
    expect(missingResponse.status).toBe(404);
    expect(missing.message).toContain("Unknown service");
  });

  it("requires an auth token for lifecycle control endpoints when configured", async () => {
    const port = await getAvailablePort();
    const servicePort = await getAvailablePort();
    const app = createSupervisorServer({
      host: "127.0.0.1",
      port,
      controlToken: "super-secret",
      runtime: createNodeProcessRuntime(),
      services: [createRuntimeDefinition({
        baseUrl: `http://127.0.0.1:${servicePort}`,
        env: {
          TEST_RUNTIME_PORT: String(servicePort),
          TEST_RUNTIME_HEALTHY_AFTER_MS: "0",
        },
      })],
    });

    await app.listen();
    serversToClose.push(app);

    const unauthorized = await fetch(`http://127.0.0.1:${port}/services/python-runtime/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const authorized = await fetch(`http://127.0.0.1:${port}/services/python-runtime/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer super-secret",
      },
      body: JSON.stringify({}),
    });

    const unauthorizedBody = await unauthorized.json();
    const authorizedBody = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(unauthorizedBody.message).toContain("control token");
    expect(authorized.status).toBe(200);
    expect(authorizedBody.service.state).toBe(ServiceStates.healthy);
  });

  it("exposes an SSE snapshot endpoint and emits service events to subscribers", async () => {
    const port = await getAvailablePort();
    const servicePort = await getAvailablePort();
    const app = createSupervisorServer({
      host: "127.0.0.1",
      port,
      runtime: createNodeProcessRuntime(),
      services: [createRuntimeDefinition({
        baseUrl: `http://127.0.0.1:${servicePort}`,
        env: {
          TEST_RUNTIME_PORT: String(servicePort),
          TEST_RUNTIME_HEALTHY_AFTER_MS: "0",
          TEST_RUNTIME_STDOUT_MESSAGE: "streamed stdout",
        },
      })],
    });
    await app.listen();
    serversToClose.push(app);

    const snapshotStream = await readInitialSseChunk(`http://127.0.0.1:${port}/events`);
    expect(snapshotStream.contentType).toContain("text/event-stream");
    expect(snapshotStream.body).toContain("event: snapshot");
    expect(snapshotStream.body).toContain("\"python-runtime\"");

    const observedTypes = new Set<string>();
    const unsubscribe = app.supervisor.subscribe((event) => {
      observedTypes.add(event.type);
    });

    await app.supervisor.start("python-runtime");
    await app.supervisor.restart("python-runtime");
    unsubscribe();

    expect(observedTypes.has("service-state")).toBeTrue();
    expect(observedTypes.has("service-log")).toBeTrue();
    expect(observedTypes.has("service-health")).toBeTrue();
    expect(observedTypes.has("service-restart")).toBeTrue();
  });
});

describe("loadServiceDefinitionsFromEnvironment", () => {
  it("builds the built-in Python runtime definition from environment variables", () => {
    process.env.SERVICE_SUPERVISOR_SERVICES = "";
    process.env.PYTHON_RUNTIME_BASE_URL = "http://127.0.0.1:8123";
    process.env.PYTHON_RUNTIME_EXECUTABLE = "python3";
    process.env.PYTHON_RUNTIME_WORKDIR = "/tmp/python-runtime";
    process.env.PYTHON_RUNTIME_ENV_JSON = JSON.stringify({ PYTHONUNBUFFERED: "1" });
    process.env.PYTHON_RUNTIME_HEALTH_PATH = "/healthz";
    process.env.PYTHON_RUNTIME_STARTUP_TIMEOUT_MS = "4321";
    process.env.PYTHON_RUNTIME_HEALTH_POLL_INTERVAL_MS = "123";
    process.env.PYTHON_RUNTIME_VERSION = "9.9.9";
    process.env.PYTHON_RUNTIME_COMPATIBILITY_JSON = JSON.stringify({ supervisorApiVersion: 2, runtimeApiVersion: "beta" });

    const [definition] = loadServiceDefinitionsFromEnvironment();

    expect(definition.serviceId).toBe("python-runtime");
    expect(definition.baseUrl).toBe("http://127.0.0.1:8123");
    expect(definition.command).toBe("python3");
    expect(definition.cwd).toBe("/tmp/python-runtime");
    expect(definition.env).toEqual({ PYTHONUNBUFFERED: "1" });
    expect(definition.healthCheckPath).toBe("/healthz");
    expect(definition.startupTimeoutMs).toBe(4321);
    expect(definition.healthPollIntervalMs).toBe(123);
    expect(definition.version).toBe("9.9.9");
    expect(definition.compatibility).toEqual({ supervisorApiVersion: 2, runtimeApiVersion: "beta" });
    expect(definition.args).toEqual(["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8123"]);
  });

  it("parses JSON argument arrays for the built-in runtime", () => {
    process.env.SERVICE_SUPERVISOR_SERVICES = "";
    process.env.PYTHON_RUNTIME_ARGS_JSON = JSON.stringify(["-m", "uvicorn", "app.main:app", "--reload"]);

    const [definition] = loadServiceDefinitionsFromEnvironment();

    expect(definition.args).toEqual(["-m", "uvicorn", "app.main:app", "--reload"]);
  });
});
