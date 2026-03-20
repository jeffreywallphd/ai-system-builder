import "dotenv/config";
import http from "node:http";
import { spawn } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_PORT = Number(process.env.SERVICE_SUPERVISOR_PORT || 8790);
const DEFAULT_HOST = process.env.SERVICE_SUPERVISOR_HOST || "127.0.0.1";
const DEFAULT_LOG_LIMIT = Number(process.env.SERVICE_SUPERVISOR_LOG_LIMIT || 200);
const DEFAULT_STUB_MODE = process.env.SERVICE_SUPERVISOR_STUB_MODE !== "false";

export const ServiceStates = Object.freeze({
  unavailable: "unavailable",
  starting: "starting",
  running: "running",
  degraded: "degraded",
  failed: "failed",
  stopping: "stopping",
  stopped: "stopped",
});

function createClockTimestamp(clock) {
  return clock().toISOString();
}

function createLogEntry(clock, level, message) {
  return {
    timestamp: createClockTimestamp(clock),
    level,
    message,
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });

  res.end(body);
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
    });

    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function normalizeServiceDefinition(definition) {
  if (!definition || typeof definition !== "object") {
    throw new Error("Service definition must be an object.");
  }

  const serviceId = typeof definition.serviceId === "string" ? definition.serviceId.trim() : "";
  const name = typeof definition.name === "string" ? definition.name.trim() : serviceId;

  if (!serviceId) {
    throw new Error("Service definition serviceId is required.");
  }

  return Object.freeze({
    serviceId,
    name: name || serviceId,
    command: typeof definition.command === "string" ? definition.command.trim() : undefined,
    args: Array.isArray(definition.args)
      ? definition.args.filter((value) => typeof value === "string").map((value) => value.trim())
      : [],
    cwd: typeof definition.cwd === "string" ? definition.cwd.trim() : process.cwd(),
    env: definition.env && typeof definition.env === "object" ? { ...definition.env } : {},
    healthCheckPath:
      typeof definition.healthCheckPath === "string" ? definition.healthCheckPath.trim() : "/health",
    metadata: definition.metadata && typeof definition.metadata === "object" ? { ...definition.metadata } : {},
  });
}

function createInitialServiceState(definition, clock) {
  return {
    serviceId: definition.serviceId,
    name: definition.name,
    command: definition.command,
    args: definition.args,
    cwd: definition.cwd,
    pid: null,
    startedAt: null,
    lastHealthCheckAt: null,
    state: ServiceStates.stopped,
    recentLogs: [createLogEntry(clock, "info", `${definition.name} registered with supervisor.`)],
  };
}

function appendRecentLog(existingLogs, logEntry, limit) {
  const nextLogs = [...existingLogs, logEntry];
  return nextLogs.slice(Math.max(0, nextLogs.length - limit));
}

export function createStubProcessRuntime(options = {}) {
  const clock = options.clock ?? (() => new Date());
  let nextPid = Number(options.initialPid ?? 2_000);

  return {
    async start(definition) {
      const pid = nextPid;
      nextPid += 1;

      return {
        pid,
        startedAt: createClockTimestamp(clock),
        detail: `Stubbed launch for ${definition.name}.`,
        logs: [createLogEntry(clock, "info", `Stubbed process launch for ${definition.serviceId}.`)],
      };
    },
    async stop(definition, state) {
      return {
        detail: state.pid
          ? `Stubbed stop for ${definition.name}.`
          : `${definition.name} is already stopped.`,
        logs: [createLogEntry(clock, "info", `Stubbed process stop for ${definition.serviceId}.`)],
      };
    },
    async checkHealth(definition, state) {
      return {
        healthy: state.state === ServiceStates.running,
        detail: state.state === ServiceStates.running
          ? `${definition.name} stub health check passed.`
          : `${definition.name} is not running.`,
        logs: [createLogEntry(clock, "info", `Stubbed health check for ${definition.serviceId}.`)],
      };
    },
  };
}

export function createNodeProcessRuntime(options = {}) {
  const clock = options.clock ?? (() => new Date());
  const childProcesses = new Map();

  return {
    async start(definition) {
      if (!definition.command) {
        throw new Error(`Service '${definition.serviceId}' is missing a command.`);
      }

      const child = spawn(definition.command, definition.args, {
        cwd: definition.cwd,
        env: {
          ...process.env,
          ...definition.env,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      childProcesses.set(definition.serviceId, child);

      const logs = [createLogEntry(clock, "info", `Started ${definition.serviceId} with pid ${child.pid}.`)];
      child.stdout?.on("data", (chunk) => {
        logs.push(createLogEntry(clock, "stdout", String(chunk).trim()));
      });
      child.stderr?.on("data", (chunk) => {
        logs.push(createLogEntry(clock, "stderr", String(chunk).trim()));
      });
      child.on("exit", (code, signal) => {
        logs.push(createLogEntry(clock, "info", `${definition.serviceId} exited (code=${code}, signal=${signal}).`));
        childProcesses.delete(definition.serviceId);
      });

      return {
        pid: child.pid ?? null,
        startedAt: createClockTimestamp(clock),
        detail: `Started ${definition.name}.`,
        logs,
      };
    },
    async stop(definition) {
      const child = childProcesses.get(definition.serviceId);
      if (!child) {
        return {
          detail: `${definition.name} is already stopped.`,
          logs: [createLogEntry(clock, "info", `${definition.serviceId} stop requested without active child.`)],
        };
      }

      child.kill("SIGTERM");
      childProcesses.delete(definition.serviceId);

      return {
        detail: `Stopped ${definition.name}.`,
        logs: [createLogEntry(clock, "info", `Stopped ${definition.serviceId}.`)],
      };
    },
    async checkHealth(definition, state) {
      const child = childProcesses.get(definition.serviceId);
      return {
        healthy: Boolean(child && state.pid),
        detail: child ? `${definition.name} process is active.` : `${definition.name} process is not active.`,
        logs: [createLogEntry(clock, "info", `Checked process health for ${definition.serviceId}.`)],
      };
    },
  };
}

export class InMemoryServiceSupervisor {
  constructor(options = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.logLimit = Number(options.logLimit ?? DEFAULT_LOG_LIMIT);
    this.definitions = new Map();
    this.states = new Map();
    this.runtime = options.runtime ?? (DEFAULT_STUB_MODE
      ? createStubProcessRuntime({ clock: this.clock })
      : createNodeProcessRuntime({ clock: this.clock }));

    for (const rawDefinition of options.services ?? []) {
      const definition = normalizeServiceDefinition(rawDefinition);
      this.definitions.set(definition.serviceId, definition);
      this.states.set(definition.serviceId, createInitialServiceState(definition, this.clock));
    }
  }

  listServices() {
    return [...this.states.values()].map((state) => this.toSummary(state.serviceId));
  }

  getService(serviceId) {
    const state = this.states.get(serviceId);
    if (!state) {
      return undefined;
    }

    return this.cloneState(state);
  }

  async start(serviceId) {
    const definition = this.requireDefinition(serviceId);
    const state = this.requireState(serviceId);

    if (state.state === ServiceStates.running && state.pid) {
      return this.recordHealth(serviceId, true, `${definition.name} is already running.`);
    }

    this.updateState(serviceId, {
      state: ServiceStates.starting,
      recentLogs: appendRecentLog(
        state.recentLogs,
        createLogEntry(this.clock, "info", `Starting ${definition.name}.`),
        this.logLimit,
      ),
    });

    try {
      const result = await this.runtime.start(definition, this.cloneState(state));
      return this.updateState(serviceId, {
        pid: result?.pid ?? state.pid ?? null,
        startedAt: result?.startedAt ?? createClockTimestamp(this.clock),
        lastHealthCheckAt: createClockTimestamp(this.clock),
        state: ServiceStates.running,
        detail: result?.detail ?? `${definition.name} started.`,
        recentLogs: this.mergeLogs(state.recentLogs, [
          createLogEntry(this.clock, "info", `Starting ${definition.name}.`),
          ...(result?.logs ?? []),
        ]),
      });
    } catch (error) {
      return this.updateState(serviceId, {
        state: ServiceStates.failed,
        detail: error instanceof Error ? error.message : "Service failed to start.",
        recentLogs: this.mergeLogs(state.recentLogs, [
          createLogEntry(this.clock, "error", `Failed to start ${definition.name}.`),
        ]),
      });
    }
  }

  async stop(serviceId) {
    const definition = this.requireDefinition(serviceId);
    const state = this.requireState(serviceId);

    if (state.state === ServiceStates.stopped && !state.pid) {
      return this.updateState(serviceId, {
        detail: `${definition.name} is already stopped.`,
        lastHealthCheckAt: createClockTimestamp(this.clock),
        recentLogs: this.mergeLogs(state.recentLogs, [
          createLogEntry(this.clock, "info", `${definition.name} stop skipped because it is already stopped.`),
        ]),
      });
    }

    this.updateState(serviceId, {
      state: ServiceStates.stopping,
      recentLogs: this.mergeLogs(state.recentLogs, [
        createLogEntry(this.clock, "info", `Stopping ${definition.name}.`),
      ]),
    });

    try {
      const result = await this.runtime.stop(definition, this.cloneState(state));
      return this.updateState(serviceId, {
        pid: null,
        state: ServiceStates.stopped,
        detail: result?.detail ?? `${definition.name} stopped.`,
        lastHealthCheckAt: createClockTimestamp(this.clock),
        recentLogs: this.mergeLogs(state.recentLogs, [
          createLogEntry(this.clock, "info", `Stopping ${definition.name}.`),
          ...(result?.logs ?? []),
        ]),
      });
    } catch (error) {
      return this.updateState(serviceId, {
        state: ServiceStates.failed,
        detail: error instanceof Error ? error.message : "Service failed to stop.",
        lastHealthCheckAt: createClockTimestamp(this.clock),
        recentLogs: this.mergeLogs(state.recentLogs, [
          createLogEntry(this.clock, "error", `Failed to stop ${definition.name}.`),
        ]),
      });
    }
  }

  async restart(serviceId) {
    await this.stop(serviceId);
    return this.start(serviceId);
  }

  async ensureRunning(serviceId) {
    const definition = this.requireDefinition(serviceId);
    const state = this.requireState(serviceId);

    if (state.state === ServiceStates.running && state.pid) {
      const result = await this.runtime.checkHealth?.(definition, this.cloneState(state));
      return this.recordHealth(
        serviceId,
        Boolean(result?.healthy),
        result?.detail ?? `${definition.name} health check completed.`,
        result?.logs ?? [],
      );
    }

    return this.start(serviceId);
  }

  async healthCheck(serviceId) {
    const definition = this.requireDefinition(serviceId);
    const state = this.requireState(serviceId);
    const result = await this.runtime.checkHealth?.(definition, this.cloneState(state));

    return this.recordHealth(
      serviceId,
      Boolean(result?.healthy),
      result?.detail ?? `${definition.name} health check completed.`,
      result?.logs ?? [],
    );
  }

  requireDefinition(serviceId) {
    const definition = this.definitions.get(serviceId);
    if (!definition) {
      throw new Error(`Unknown service '${serviceId}'.`);
    }
    return definition;
  }

  requireState(serviceId) {
    const state = this.states.get(serviceId);
    if (!state) {
      throw new Error(`Unknown service '${serviceId}'.`);
    }
    return state;
  }

  mergeLogs(existingLogs, newLogs) {
    return newLogs.reduce(
      (logs, entry) => appendRecentLog(logs, entry, this.logLimit),
      [...existingLogs],
    );
  }

  recordHealth(serviceId, healthy, detail, logs = []) {
    const state = this.requireState(serviceId);
    const nextState = healthy ? ServiceStates.running : state.pid ? ServiceStates.degraded : ServiceStates.stopped;

    return this.updateState(serviceId, {
      state: nextState,
      detail,
      lastHealthCheckAt: createClockTimestamp(this.clock),
      recentLogs: this.mergeLogs(state.recentLogs, logs),
    });
  }

  updateState(serviceId, patch) {
    const current = this.requireState(serviceId);
    const next = {
      ...current,
      ...patch,
    };
    this.states.set(serviceId, next);
    return this.cloneState(next);
  }

  toSummary(serviceId) {
    const service = this.getService(serviceId);
    return {
      serviceId: service.serviceId,
      name: service.name,
      command: service.command,
      args: service.args,
      cwd: service.cwd,
      pid: service.pid,
      startedAt: service.startedAt,
      lastHealthCheckAt: service.lastHealthCheckAt,
      state: service.state,
      detail: service.detail,
    };
  }

  cloneState(state) {
    return {
      ...state,
      args: [...state.args],
      recentLogs: state.recentLogs.map((entry) => ({ ...entry })),
    };
  }
}

export function createSupervisorServer(options = {}) {
  const supervisor = options.supervisor ?? new InMemoryServiceSupervisor({
    services: options.services ?? loadServiceDefinitionsFromEnvironment(),
    runtime: options.runtime,
    clock: options.clock,
    logLimit: options.logLimit,
  });
  const host = options.host ?? DEFAULT_HOST;
  const port = Number(options.port ?? DEFAULT_PORT);

  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url) {
        sendJson(res, 400, { ok: false, message: "Missing request URL." });
        return;
      }

      const requestUrl = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);
      const pathname = requestUrl.pathname;

      if (req.method === "OPTIONS") {
        sendJson(res, 204, {});
        return;
      }

      if (pathname === "/health" && req.method === "GET") {
        sendJson(res, 200, {
          ok: true,
          mode: "service-supervisor",
          host,
          port,
          serviceCount: supervisor.listServices().length,
          services: supervisor.listServices(),
        });
        return;
      }

      if (pathname === "/services" && req.method === "GET") {
        sendJson(res, 200, {
          ok: true,
          services: supervisor.listServices(),
        });
        return;
      }

      const routeMatch = pathname.match(/^\/services\/([^/]+?)(?:\/(start|stop|restart|ensure-running))?$/);
      if (!routeMatch) {
        sendJson(res, 404, { ok: false, message: "Route not found." });
        return;
      }

      const [, rawServiceId, action] = routeMatch;
      const serviceId = decodeURIComponent(rawServiceId);

      if (!supervisor.getService(serviceId)) {
        sendJson(res, 404, { ok: false, message: `Unknown service '${serviceId}'.` });
        return;
      }

      if (!action && req.method === "GET") {
        sendJson(res, 200, {
          ok: true,
          service: supervisor.getService(serviceId),
        });
        return;
      }

      if (action && req.method === "POST") {
        await parseRequestBody(req);

        let service;
        if (action === "start") {
          service = await supervisor.start(serviceId);
        } else if (action === "stop") {
          service = await supervisor.stop(serviceId);
        } else if (action === "restart") {
          service = await supervisor.restart(serviceId);
        } else if (action === "ensure-running") {
          service = await supervisor.ensureRunning(serviceId);
        }

        sendJson(res, 200, {
          ok: true,
          service,
        });
        return;
      }

      sendJson(res, 405, { ok: false, message: "Method not allowed." });
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(res, 400, { ok: false, message: "Request body must be valid JSON." });
        return;
      }

      sendJson(res, 500, {
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected supervisor error.",
      });
    }
  });

  return {
    host,
    port,
    server,
    supervisor,
    listen() {
      return new Promise((resolve) => {
        server.listen(port, host, () => {
          resolve({ host, port, supervisor, server });
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

export function loadServiceDefinitionsFromEnvironment() {
  const rawDefinitions = process.env.SERVICE_SUPERVISOR_SERVICES;

  if (!rawDefinitions) {
    return [
      {
        serviceId: "python-runtime",
        name: "Python runtime",
        command: process.env.PYTHON_RUNTIME_COMMAND || "python",
        args: process.env.PYTHON_RUNTIME_ARGS
          ? process.env.PYTHON_RUNTIME_ARGS.split(" ").filter(Boolean)
          : ["-m", "http.server", "9001"],
        cwd: process.env.PYTHON_RUNTIME_CWD || process.cwd(),
        healthCheckPath: "/health",
        metadata: {
          source: "default",
        },
      },
    ];
  }

  const parsed = JSON.parse(rawDefinitions);
  if (!Array.isArray(parsed)) {
    throw new Error("SERVICE_SUPERVISOR_SERVICES must be a JSON array.");
  }

  return parsed;
}

async function main() {
  const runtime = DEFAULT_STUB_MODE
    ? createStubProcessRuntime()
    : createNodeProcessRuntime();
  const app = createSupervisorServer({ runtime });
  await app.listen();
  console.log(`[service-supervisor] listening on http://${app.host}:${app.port}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("[service-supervisor] failed to start", error);
    process.exitCode = 1;
  });
}
