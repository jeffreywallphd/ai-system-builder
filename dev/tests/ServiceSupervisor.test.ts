import http from "node:http";
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
const envKeysToRestore = [
  "SERVICE_SUPERVISOR_SERVICES",
  "PYTHON_RUNTIME_BASE_URL",
  "PYTHON_RUNTIME_EXECUTABLE",
  "PYTHON_RUNTIME_ARGS",
  "PYTHON_RUNTIME_WORKDIR",
  "PYTHON_RUNTIME_ENV_JSON",
  "PYTHON_RUNTIME_HEALTH_PATH",
  "PYTHON_RUNTIME_STARTUP_TIMEOUT_MS",
  "PYTHON_RUNTIME_HEALTH_POLL_INTERVAL_MS",
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
    ...overrides,
  };
}

function createManagedSupervisor(definition: Record<string, unknown>) {
  return new InMemoryServiceSupervisor({
    services: [definition],
    runtime: createNodeProcessRuntime(),
  });
}

describe("InMemoryServiceSupervisor", () => {
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
    expect(started.recentLogs.some((entry) => entry.level === "stdout" && entry.message.includes("managed stdout"))).toBeTrue();
    expect(started.recentLogs.some((entry) => entry.level === "stderr" && entry.message.includes("managed stderr"))).toBeTrue();
    expect(startedAgain.state).toBe(ServiceStates.healthy);
    expect(startedAgain.pid).toBe(started.pid);
    expect(startedAgain.detail).toContain("already healthy");
  });

  it("marks startup timeout as failed and cleans up the process", async () => {
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
  });

  it("marks crashes during startup as failed", async () => {
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
    expect(status.detail).toContain("exited unexpectedly");
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
    }));

    const status = await supervisor.start("python-runtime");

    expect(status.state).toBe(ServiceStates.healthy);
    expect(status.ownership).toBe(ServiceOwnership.external);
    expect(status.pid).toBeNull();
    expect(status.detail).toContain("health check passed");
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
    expect(ensured.service.detail).toContain("health check passed");
    expect(stopped.service.state).toBe(ServiceStates.stopped);
    expect(missingResponse.status).toBe(404);
    expect(missing.message).toContain("Unknown service");
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

    const [definition] = loadServiceDefinitionsFromEnvironment();

    expect(definition.serviceId).toBe("python-runtime");
    expect(definition.baseUrl).toBe("http://127.0.0.1:8123");
    expect(definition.command).toBe("python3");
    expect(definition.cwd).toBe("/tmp/python-runtime");
    expect(definition.env).toEqual({ PYTHONUNBUFFERED: "1" });
    expect(definition.healthCheckPath).toBe("/healthz");
    expect(definition.startupTimeoutMs).toBe(4321);
    expect(definition.healthPollIntervalMs).toBe(123);
    expect(definition.args).toEqual(["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8123"]);
  });
});
