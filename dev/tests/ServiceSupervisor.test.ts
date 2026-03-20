import { afterEach, describe, expect, it } from "bun:test";
import {
  InMemoryServiceSupervisor,
  ServiceStates,
  createSupervisorServer,
} from "../service-supervisor.js";

function createFakeRuntime() {
  let nextPid = 4_242;
  const calls = {
    start: [] as string[],
    stop: [] as string[],
    checkHealth: [] as string[],
  };

  return {
    calls,
    runtime: {
      async start(definition: { serviceId: string; name: string }) {
        calls.start.push(definition.serviceId);
        return {
          pid: nextPid++,
          startedAt: "2026-03-20T00:00:00.000Z",
          detail: `${definition.name} started by fake runtime.`,
          logs: [
            {
              timestamp: "2026-03-20T00:00:00.000Z",
              level: "info",
              message: `fake start for ${definition.serviceId}`,
            },
          ],
        };
      },
      async stop(definition: { serviceId: string; name: string }) {
        calls.stop.push(definition.serviceId);
        return {
          detail: `${definition.name} stopped by fake runtime.`,
          logs: [
            {
              timestamp: "2026-03-20T00:01:00.000Z",
              level: "info",
              message: `fake stop for ${definition.serviceId}`,
            },
          ],
        };
      },
      async checkHealth(definition: { serviceId: string; name: string }, state: { pid: number | null }) {
        calls.checkHealth.push(definition.serviceId);
        return {
          healthy: Boolean(state.pid),
          detail: state.pid
            ? `${definition.name} is healthy in fake runtime.`
            : `${definition.name} is unhealthy in fake runtime.`,
          logs: [
            {
              timestamp: "2026-03-20T00:02:00.000Z",
              level: "info",
              message: `fake health for ${definition.serviceId}`,
            },
          ],
        };
      },
    },
  };
}

const services = [
  {
    serviceId: "python-runtime",
    name: "Python runtime",
    command: "python",
    args: ["-m", "http.server", "9001"],
  },
  {
    serviceId: "asset-worker",
    name: "Asset worker",
    command: "node",
    args: ["worker.js"],
  },
];

const serversToClose: Array<{ close: () => Promise<unknown> }> = [];

afterEach(async () => {
  while (serversToClose.length > 0) {
    const server = serversToClose.pop();
    if (server) {
      await server.close();
    }
  }
});

describe("InMemoryServiceSupervisor", () => {
  it("tracks start, health, stop, and restart transitions for multiple services", async () => {
    const fake = createFakeRuntime();
    const supervisor = new InMemoryServiceSupervisor({
      services,
      runtime: fake.runtime,
    });

    expect(supervisor.listServices()).toHaveLength(2);
    expect(supervisor.getService("python-runtime")?.state).toBe(ServiceStates.stopped);

    const started = await supervisor.start("python-runtime");
    const ensured = await supervisor.ensureRunning("python-runtime");
    const stopped = await supervisor.stop("python-runtime");
    const restarted = await supervisor.restart("python-runtime");

    expect(started.state).toBe(ServiceStates.running);
    expect(started.pid).toBe(4_242);
    expect(ensured.state).toBe(ServiceStates.running);
    expect(ensured.lastHealthCheckAt).toBeString();
    expect(stopped.state).toBe(ServiceStates.stopped);
    expect(stopped.pid).toBeNull();
    expect(restarted.state).toBe(ServiceStates.running);
    expect(restarted.pid).toBe(4_243);
    expect(fake.calls.start).toEqual(["python-runtime", "python-runtime"]);
    expect(fake.calls.stop).toEqual(["python-runtime"]);
    expect(fake.calls.checkHealth).toEqual(["python-runtime"]);
    expect(restarted.recentLogs.some((entry) => entry.message.includes("fake start"))).toBeTrue();
  });
});

describe("service supervisor HTTP API", () => {
  it("exposes health, list, detail, and lifecycle endpoints", async () => {
    const fake = createFakeRuntime();
    const app = createSupervisorServer({
      host: "127.0.0.1",
      port: 8799,
      supervisor: new InMemoryServiceSupervisor({
        services,
        runtime: fake.runtime,
      }),
    });

    serversToClose.push(app);
    await app.listen();

    const healthResponse = await fetch("http://127.0.0.1:8799/health");
    const listResponse = await fetch("http://127.0.0.1:8799/services");
    const startResponse = await fetch("http://127.0.0.1:8799/services/python-runtime/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const detailResponse = await fetch("http://127.0.0.1:8799/services/python-runtime");
    const ensureResponse = await fetch("http://127.0.0.1:8799/services/python-runtime/ensure-running", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const stopResponse = await fetch("http://127.0.0.1:8799/services/python-runtime/stop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const missingResponse = await fetch("http://127.0.0.1:8799/services/unknown-service");

    const health = await healthResponse.json();
    const list = await listResponse.json();
    const started = await startResponse.json();
    const detail = await detailResponse.json();
    const ensured = await ensureResponse.json();
    const stopped = await stopResponse.json();
    const missing = await missingResponse.json();

    expect(healthResponse.status).toBe(200);
    expect(health.mode).toBe("service-supervisor");
    expect(health.serviceCount).toBe(2);
    expect(list.services).toHaveLength(2);
    expect(started.service.state).toBe(ServiceStates.running);
    expect(started.service.pid).toBe(4_242);
    expect(detail.service.serviceId).toBe("python-runtime");
    expect(detail.service.recentLogs.length).toBeGreaterThan(0);
    expect(ensured.service.detail).toContain("healthy");
    expect(stopped.service.state).toBe(ServiceStates.stopped);
    expect(missingResponse.status).toBe(404);
    expect(missing.message).toContain("Unknown service");
  });
});
