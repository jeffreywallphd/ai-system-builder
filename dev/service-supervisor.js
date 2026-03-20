import "dotenv/config";
import http from "node:http";
import { spawn } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_PORT = Number(process.env.SERVICE_SUPERVISOR_PORT || 8790);
const DEFAULT_HOST = process.env.SERVICE_SUPERVISOR_HOST || "127.0.0.1";
const DEFAULT_LOG_LIMIT = Number(process.env.SERVICE_SUPERVISOR_LOG_LIMIT || 200);
const DEFAULT_STUB_MODE = process.env.SERVICE_SUPERVISOR_STUB_MODE !== "false";
const DEFAULT_STARTUP_TIMEOUT_MS = 20_000;
const DEFAULT_HEALTH_POLL_INTERVAL_MS = 250;
const DEFAULT_STOP_TIMEOUT_MS = 5_000;
const DEFAULT_FETCH_TIMEOUT_MS = Number(process.env.SERVICE_SUPERVISOR_FETCH_TIMEOUT_MS || 2_000);
const DEFAULT_PYTHON_RUNTIME_BASE_URL = "http://127.0.0.1:8100";
const DEFAULT_PYTHON_RUNTIME_WORKDIR = `${process.cwd()}/python-runtime`;
const DEFAULT_PYTHON_RUNTIME_EXECUTABLE = "python";
const DEFAULT_PYTHON_RUNTIME_HEALTH_PATH = "/health";
const DEFAULT_PYTHON_RUNTIME_ENTRYPOINT = "app.main:app";

export const ServiceStates = Object.freeze({
  unavailable: "unavailable",
  starting: "starting",
  healthy: "healthy",
  unhealthy: "unhealthy",
  failed: "failed",
  stopping: "stopping",
  stopped: "stopped",
  running: "healthy",
  degraded: "unhealthy",
});

export const ServiceOwnership = Object.freeze({
  none: "none",
  managed: "managed",
  external: "external",
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

function sendEventStreamHeaders(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-Accel-Buffering": "no",
  });
}

function writeSseEvent(res, event) {
  if (!event) {
    return;
  }

  if (event.id !== undefined) {
    res.write(`id: ${event.id}\n`);
  }

  if (event.type) {
    res.write(`event: ${event.type}\n`);
  }

  const serialized = JSON.stringify(event.payload ?? {});
  for (const line of serialized.split("\n")) {
    res.write(`data: ${line}\n`);
  }

  res.write("\n");
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

  const baseUrl = typeof definition.baseUrl === "string" ? definition.baseUrl.trim() : undefined;
  const healthCheckPath =
    typeof definition.healthCheckPath === "string" ? definition.healthCheckPath.trim() : DEFAULT_PYTHON_RUNTIME_HEALTH_PATH;

  return Object.freeze({
    serviceId,
    name: name || serviceId,
    command: typeof definition.command === "string" ? definition.command.trim() : undefined,
    args: Array.isArray(definition.args)
      ? definition.args.filter((value) => typeof value === "string").map((value) => value.trim())
      : [],
    cwd: typeof definition.cwd === "string" ? definition.cwd.trim() : process.cwd(),
    env: definition.env && typeof definition.env === "object" ? { ...definition.env } : {},
    baseUrl: baseUrl || undefined,
    healthCheckPath: healthCheckPath || "/health",
    startupTimeoutMs: normalizePositiveNumber(definition.startupTimeoutMs, DEFAULT_STARTUP_TIMEOUT_MS),
    healthPollIntervalMs: normalizePositiveNumber(definition.healthPollIntervalMs, DEFAULT_HEALTH_POLL_INTERVAL_MS),
    stopTimeoutMs: normalizePositiveNumber(definition.stopTimeoutMs, DEFAULT_STOP_TIMEOUT_MS),
    metadata: definition.metadata && typeof definition.metadata === "object" ? { ...definition.metadata } : {},
  });
}

function normalizePositiveNumber(value, fallback) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
}

function createInitialServiceState(definition, clock) {
  return {
    serviceId: definition.serviceId,
    name: definition.name,
    command: definition.command,
    args: definition.args,
    cwd: definition.cwd,
    baseUrl: definition.baseUrl,
    pid: null,
    startedAt: null,
    lastHealthCheckAt: null,
    state: ServiceStates.stopped,
    ownership: ServiceOwnership.none,
    detail: `${definition.name} is stopped.`,
    recentLogs: [createLogEntry(clock, "info", `${definition.name} registered with supervisor.`)],
  };
}

function appendRecentLog(existingLogs, logEntry, limit) {
  const nextLogs = [...existingLogs, logEntry];
  return nextLogs.slice(Math.max(0, nextLogs.length - limit));
}

function withTimeout(task, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    Promise.resolve(task)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function resolveHealthUrl(definition) {
  if (!definition.baseUrl) {
    return undefined;
  }

  return new URL(definition.healthCheckPath || "/health", definition.baseUrl).toString();
}

function resolveLaunchTarget(baseUrl) {
  try {
    const parsed = new URL(baseUrl || DEFAULT_PYTHON_RUNTIME_BASE_URL);
    const port = parsed.port ? Number(parsed.port) : (parsed.protocol === "https:" ? 443 : 80);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: Number.isFinite(port) && port > 0 ? port : 8100,
    };
  } catch {
    return { host: "127.0.0.1", port: 8100 };
  }
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
        healthy: state.state === ServiceStates.healthy,
        detail: state.state === ServiceStates.healthy
          ? `${definition.name} stub health check passed.`
          : `${definition.name} is not healthy.`,
        logs: [createLogEntry(clock, "info", `Stubbed health check for ${definition.serviceId}.`)],
      };
    },
  };
}

export function createNodeProcessRuntime(options = {}) {
  const clock = options.clock ?? (() => new Date());
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const childProcesses = new Map();

  function emitHook(hook, payload) {
    if (typeof hook === "function") {
      hook(payload);
    }
  }

  return {
    async start(definition, _state, hooks = {}) {
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

      const exitDeferred = createDeferred();
      const record = {
        child,
        exitPromise: exitDeferred.promise,
        exitCode: null,
        signal: null,
        exited: false,
      };

      childProcesses.set(definition.serviceId, record);

      child.stdout?.on("data", (chunk) => {
        const message = String(chunk).trim();
        if (!message) {
          return;
        }
        emitHook(hooks.onLog, createLogEntry(clock, "stdout", message));
      });

      child.stderr?.on("data", (chunk) => {
        const message = String(chunk).trim();
        if (!message) {
          return;
        }
        emitHook(hooks.onLog, createLogEntry(clock, "stderr", message));
      });

      child.on("error", (error) => {
        emitHook(
          hooks.onLog,
          createLogEntry(clock, "error", `Process error for ${definition.serviceId}: ${toErrorMessage(error)}`),
        );
      });

      child.on("exit", (code, signal) => {
        record.exited = true;
        record.exitCode = code;
        record.signal = signal;
        childProcesses.delete(definition.serviceId);
        const exitInfo = {
          code: typeof code === "number" ? code : null,
          signal: signal ?? null,
        };
        emitHook(
          hooks.onLog,
          createLogEntry(
            clock,
            "info",
            `${definition.serviceId} exited (code=${exitInfo.code ?? "null"}, signal=${exitInfo.signal ?? "null"}).`,
          ),
        );
        emitHook(hooks.onExit, exitInfo);
        exitDeferred.resolve(exitInfo);
      });

      return {
        pid: child.pid ?? null,
        startedAt: createClockTimestamp(clock),
        detail: `Started ${definition.name}.`,
        logs: [createLogEntry(clock, "info", `Started ${definition.serviceId} with pid ${child.pid ?? "unknown"}.`)],
        exitPromise: record.exitPromise,
      };
    },
    async stop(definition, state, hooks = {}) {
      const record = childProcesses.get(definition.serviceId);
      if (!record) {
        return {
          detail: `${definition.name} is already stopped.`,
          logs: [createLogEntry(clock, "info", `${definition.serviceId} stop requested without active child.`)],
        };
      }

      emitHook(hooks.onLog, createLogEntry(clock, "info", `Sending SIGTERM to ${definition.serviceId}.`));
      record.child.kill("SIGTERM");

      try {
        await withTimeout(
          record.exitPromise,
          definition.stopTimeoutMs,
          `${definition.name} did not exit before stop timeout.`,
        );
      } catch {
        emitHook(hooks.onLog, createLogEntry(clock, "warning", `Sending SIGKILL to ${definition.serviceId}.`));
        record.child.kill("SIGKILL");
        await withTimeout(record.exitPromise, definition.stopTimeoutMs, `${definition.name} did not exit after SIGKILL.`);
      }

      return {
        detail: `Stopped ${definition.name}.`,
        logs: [createLogEntry(clock, "info", `Stopped ${definition.serviceId}.`)],
      };
    },
    async checkHealth(definition, state) {
      const record = childProcesses.get(definition.serviceId);
      const healthUrl = resolveHealthUrl(definition);

      if (!healthUrl) {
        return {
          healthy: Boolean(record && state.pid),
          detail: record ? `${definition.name} process is active.` : `${definition.name} process is not active.`,
          logs: [createLogEntry(clock, "info", `Checked process health for ${definition.serviceId}.`)],
        };
      }

      try {
        const response = await withTimeout(
          fetch(healthUrl, { headers: { Accept: "application/json" } }),
          DEFAULT_FETCH_TIMEOUT_MS,
          `${definition.name} health check timed out.`,
        );
        const healthy = response.ok;
        return {
          healthy,
          detail: healthy
            ? `${definition.name} health check passed.`
            : `${definition.name} health check returned HTTP ${response.status}.`,
          logs: [createLogEntry(clock, "info", `Health check ${healthy ? "passed" : "failed"} for ${definition.serviceId}.`)],
        };
      } catch (error) {
        if (record && state.pid) {
          await sleep(1);
        }
        return {
          healthy: false,
          detail: `${definition.name} health check failed: ${toErrorMessage(error)}`,
          logs: [createLogEntry(clock, "warning", `Health check failed for ${definition.serviceId}.`)],
        };
      }
    },
  };
}

export class InMemoryServiceSupervisor {
  constructor(options = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.logLimit = Number(options.logLimit ?? DEFAULT_LOG_LIMIT);
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.definitions = new Map();
    this.states = new Map();
    this.operations = new Map();
    this.listeners = new Set();
    this.nextEventId = 1;
    this.runtime = options.runtime ?? (DEFAULT_STUB_MODE
      ? createStubProcessRuntime({ clock: this.clock })
      : createNodeProcessRuntime({ clock: this.clock, sleep: this.sleep }));

    for (const rawDefinition of options.services ?? []) {
      const definition = normalizeServiceDefinition(rawDefinition);
      this.definitions.set(definition.serviceId, definition);
      this.states.set(definition.serviceId, createInitialServiceState(definition, this.clock));
    }
  }

  listServices() {
    return [...this.states.values()].map((state) => this.toSummary(state.serviceId));
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  createSnapshotEvent() {
    return {
      type: "snapshot",
      payload: {
        services: [...this.states.values()].map((state) => this.cloneState(state)),
      },
    };
  }

  getService(serviceId) {
    const state = this.states.get(serviceId);
    if (!state) {
      return undefined;
    }

    return this.cloneState(state);
  }

  async start(serviceId) {
    return this.runLifecycleOperation(serviceId, "start", () => this.startInternal(serviceId));
  }

  async stop(serviceId) {
    return this.runLifecycleOperation(serviceId, "stop", () => this.stopInternal(serviceId));
  }

  async restart(serviceId) {
    return this.runLifecycleOperation(serviceId, "restart", async () => {
      this.emitEvent({
        type: "service-restart",
        payload: {
          serviceId,
          phase: "requested",
          service: this.getService(serviceId),
          timestamp: createClockTimestamp(this.clock),
        },
      });
      await this.stopInternal(serviceId);
      const restarted = await this.startInternal(serviceId);
      this.emitEvent({
        type: "service-restart",
        payload: {
          serviceId,
          phase: "completed",
          service: restarted,
          timestamp: createClockTimestamp(this.clock),
        },
      });
      return restarted;
    });
  }

  async ensureRunning(serviceId) {
    return this.runLifecycleOperation(serviceId, "ensure-running", async () => {
      const definition = this.requireDefinition(serviceId);
      const state = this.requireState(serviceId);

      if (state.state === ServiceStates.starting) {
        return this.cloneState(state);
      }

      if (state.state === ServiceStates.healthy) {
        const result = await this.runtime.checkHealth?.(definition, this.cloneState(state));
        return this.recordHealth(
          serviceId,
          Boolean(result?.healthy),
          result?.detail ?? `${definition.name} health check completed.`,
          result?.logs ?? [],
        );
      }

      return this.startInternal(serviceId);
    });
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

  async startInternal(serviceId) {
    const definition = this.requireDefinition(serviceId);
    const state = this.requireState(serviceId);

    if (state.state === ServiceStates.healthy) {
      return this.recordHealth(serviceId, true, `${definition.name} is already healthy.`);
    }

    const externalStatus = await this.detectExternalService(serviceId, definition, state);
    if (externalStatus) {
      return externalStatus;
    }

    const startingLog = createLogEntry(this.clock, "info", `Starting ${definition.name}.`);
    this.updateState(serviceId, {
      state: ServiceStates.starting,
      ownership: ServiceOwnership.managed,
      detail: `Starting ${definition.name}.`,
      recentLogs: this.mergeLogs(state.recentLogs, [startingLog]),
    });

    const runtimeHooks = {
      onLog: (entry) => this.appendRuntimeLog(serviceId, entry),
      onExit: (exitInfo) => this.handleManagedProcessExit(serviceId, exitInfo),
    };

    try {
      const launchResult = await this.runtime.start(definition, this.cloneState(this.requireState(serviceId)), runtimeHooks);
      let startupExitInfo;
      let startupExited = false;
      launchResult?.exitPromise?.then((exitInfo) => {
        startupExited = true;
        startupExitInfo = exitInfo;
      });
      this.updateState(serviceId, {
        pid: launchResult?.pid ?? null,
        startedAt: launchResult?.startedAt ?? createClockTimestamp(this.clock),
        ownership: ServiceOwnership.managed,
        detail: launchResult?.detail ?? `Started ${definition.name}.`,
        recentLogs: this.mergeLogs(this.requireState(serviceId).recentLogs, launchResult?.logs ?? []),
      });

      return await this.waitForHealthyStartup(serviceId, definition, () => startupExited ? startupExitInfo : undefined);
    } catch (error) {
      return this.updateState(serviceId, {
        pid: null,
        state: ServiceStates.failed,
        ownership: ServiceOwnership.managed,
        detail: toErrorMessage(error) || "Service failed to start.",
        recentLogs: this.mergeLogs(this.requireState(serviceId).recentLogs, [
          createLogEntry(this.clock, "error", `Failed to start ${definition.name}.`),
        ]),
      });
    }
  }

  async stopInternal(serviceId) {
    const definition = this.requireDefinition(serviceId);
    const state = this.requireState(serviceId);

    if (state.ownership === ServiceOwnership.external) {
      return this.updateState(serviceId, {
        lastHealthCheckAt: createClockTimestamp(this.clock),
        detail: `${definition.name} is running externally and cannot be stopped by the supervisor.`,
        recentLogs: this.mergeLogs(state.recentLogs, [
          createLogEntry(this.clock, "info", `${definition.name} stop skipped because ownership is external.`),
        ]),
      });
    }

    if ((state.state === ServiceStates.stopped || state.state === ServiceStates.failed) && !state.pid) {
      return this.updateState(serviceId, {
        ownership: ServiceOwnership.none,
        detail: `${definition.name} is already stopped.`,
        lastHealthCheckAt: createClockTimestamp(this.clock),
        recentLogs: this.mergeLogs(state.recentLogs, [
          createLogEntry(this.clock, "info", `${definition.name} stop skipped because it is already stopped.`),
        ]),
      });
    }

    this.updateState(serviceId, {
      state: ServiceStates.stopping,
      ownership: state.ownership === ServiceOwnership.managed ? ServiceOwnership.managed : ServiceOwnership.none,
      detail: `Stopping ${definition.name}.`,
      recentLogs: this.mergeLogs(state.recentLogs, [
        createLogEntry(this.clock, "info", `Stopping ${definition.name}.`),
      ]),
    });

    try {
      const result = await this.runtime.stop(
        definition,
        this.cloneState(this.requireState(serviceId)),
        { onLog: (entry) => this.appendRuntimeLog(serviceId, entry) },
      );
      return this.updateState(serviceId, {
        pid: null,
        state: ServiceStates.stopped,
        ownership: ServiceOwnership.none,
        detail: result?.detail ?? `${definition.name} stopped.`,
        lastHealthCheckAt: createClockTimestamp(this.clock),
        recentLogs: this.mergeLogs(this.requireState(serviceId).recentLogs, result?.logs ?? []),
      });
    } catch (error) {
      return this.updateState(serviceId, {
        state: ServiceStates.failed,
        detail: toErrorMessage(error) || "Service failed to stop.",
        lastHealthCheckAt: createClockTimestamp(this.clock),
        recentLogs: this.mergeLogs(this.requireState(serviceId).recentLogs, [
          createLogEntry(this.clock, "error", `Failed to stop ${definition.name}.`),
        ]),
      });
    }
  }

  async waitForHealthyStartup(serviceId, definition, getExitInfo) {
    const startedAt = Date.now();

    while (Date.now() - startedAt <= definition.startupTimeoutMs) {
      const current = this.requireState(serviceId);
      const exitInfo = getExitInfo?.();
      if (exitInfo) {
        return this.updateState(serviceId, {
          pid: null,
          state: ServiceStates.failed,
          ownership: ServiceOwnership.none,
          detail: `${definition.name} exited unexpectedly (code=${exitInfo?.code ?? "null"}, signal=${exitInfo?.signal ?? "null"}).`,
          lastHealthCheckAt: createClockTimestamp(this.clock),
        });
      }

      if (current.state === ServiceStates.failed) {
        return this.cloneState(current);
      }

      const result = await this.runtime.checkHealth?.(definition, this.cloneState(current));
      if (result?.healthy) {
        return this.updateState(serviceId, {
          state: ServiceStates.healthy,
          detail: result.detail ?? `${definition.name} is healthy.`,
          lastHealthCheckAt: createClockTimestamp(this.clock),
          ownership: current.ownership === ServiceOwnership.external ? ServiceOwnership.external : ServiceOwnership.managed,
          recentLogs: this.mergeLogs(this.requireState(serviceId).recentLogs, result.logs ?? []),
        });
      }

      this.updateState(serviceId, {
        state: ServiceStates.starting,
        detail: result?.detail ?? `Waiting for ${definition.name} health check to pass.`,
        lastHealthCheckAt: createClockTimestamp(this.clock),
        recentLogs: this.mergeLogs(this.requireState(serviceId).recentLogs, result?.logs ?? []),
      });

      await this.sleep(definition.healthPollIntervalMs);
    }

    const failedState = this.updateState(serviceId, {
      pid: null,
      state: ServiceStates.failed,
      ownership: ServiceOwnership.managed,
      detail: `${definition.name} startup timed out after ${definition.startupTimeoutMs}ms.`,
      lastHealthCheckAt: createClockTimestamp(this.clock),
      recentLogs: this.mergeLogs(this.requireState(serviceId).recentLogs, [
        createLogEntry(this.clock, "error", `${definition.name} startup timed out.`),
      ]),
    });

    try {
      await this.runtime.stop(
        definition,
        failedState,
        { onLog: (entry) => this.appendRuntimeLog(serviceId, entry) },
      );
    } catch {
      // best effort cleanup after timeout
    }

    return this.updateState(serviceId, {
      pid: null,
      ownership: ServiceOwnership.none,
    });
  }

  async detectExternalService(serviceId, definition, state) {
    if (!definition.baseUrl) {
      return undefined;
    }

    const result = await this.runtime.checkHealth?.(definition, this.cloneState(state));
    if (!result?.healthy) {
      return undefined;
    }

    return this.updateState(serviceId, {
      pid: null,
      state: ServiceStates.healthy,
      ownership: ServiceOwnership.external,
      startedAt: null,
      detail: result.detail ?? `${definition.name} is already running externally.`,
      lastHealthCheckAt: createClockTimestamp(this.clock),
      recentLogs: this.mergeLogs(state.recentLogs, [
        ...(result.logs ?? []),
        createLogEntry(this.clock, "info", `${definition.name} is already running at ${definition.baseUrl}.`),
      ]),
    });
  }

  handleManagedProcessExit(serviceId, exitInfo) {
    const state = this.states.get(serviceId);
    if (!state || state.ownership !== ServiceOwnership.managed) {
      return;
    }

    if (state.state === ServiceStates.stopping || state.state === ServiceStates.stopped) {
      this.updateState(serviceId, {
        pid: null,
        state: ServiceStates.stopped,
        ownership: ServiceOwnership.none,
        detail: `${state.name} stopped.`,
      });
      return;
    }

    if (state.state === ServiceStates.failed && state.detail?.includes("startup timed out")) {
      this.updateState(serviceId, {
        pid: null,
        ownership: ServiceOwnership.none,
        lastHealthCheckAt: createClockTimestamp(this.clock),
      });
      return;
    }

    this.updateState(serviceId, {
      pid: null,
      state: ServiceStates.failed,
      ownership: ServiceOwnership.none,
      detail: `${state.name} exited unexpectedly (code=${exitInfo?.code ?? "null"}, signal=${exitInfo?.signal ?? "null"}).`,
      lastHealthCheckAt: createClockTimestamp(this.clock),
    });
  }

  appendRuntimeLog(serviceId, entry) {
    const state = this.states.get(serviceId);
    if (!state) {
      return;
    }

    this.updateState(serviceId, {
      recentLogs: appendRecentLog(state.recentLogs, entry, this.logLimit),
    });
    this.emitEvent({
      type: "service-log",
      payload: {
        serviceId,
        entry: { ...entry },
        service: this.getService(serviceId),
      },
    });
  }

  async runLifecycleOperation(serviceId, action, operation) {
    const existing = this.operations.get(serviceId);
    if (existing) {
      if (existing.action === action || (action === "start" && existing.action === "ensure-running")) {
        return existing.promise;
      }

      try {
        await existing.promise;
      } catch {
        // allow follow-up lifecycle requests after previous failure
      }
    }

    const promise = Promise.resolve()
      .then(operation)
      .finally(() => {
        const current = this.operations.get(serviceId);
        if (current?.promise === promise) {
          this.operations.delete(serviceId);
        }
      });

    this.operations.set(serviceId, { action, promise });
    return promise;
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
    const nextState = healthy
      ? ServiceStates.healthy
      : state.ownership === ServiceOwnership.external || Boolean(state.pid)
        ? ServiceStates.unhealthy
        : ServiceStates.stopped;

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
    const clonedNext = this.cloneState(next);
    const previousState = current.state;
    const previousHealthCheckAt = current.lastHealthCheckAt;

    this.emitEvent({
      type: "service-state",
      payload: {
        serviceId,
        previousState,
        service: clonedNext,
      },
    });

    if (
      previousState !== next.state
      || previousHealthCheckAt !== next.lastHealthCheckAt
    ) {
      this.emitEvent({
        type: "service-health",
        payload: {
          serviceId,
          previousState,
          service: clonedNext,
          changedAt: createClockTimestamp(this.clock),
        },
      });
    }

    return clonedNext;
  }

  toSummary(serviceId) {
    const service = this.getService(serviceId);
    return {
      serviceId: service.serviceId,
      name: service.name,
      command: service.command,
      args: service.args,
      cwd: service.cwd,
      baseUrl: service.baseUrl,
      pid: service.pid,
      startedAt: service.startedAt,
      lastHealthCheckAt: service.lastHealthCheckAt,
      state: service.state,
      ownership: service.ownership,
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

  emitEvent(event) {
    const normalized = {
      id: this.nextEventId++,
      ...event,
    };

    for (const listener of this.listeners) {
      listener(normalized);
    }
  }
}

export function createSupervisorServer(options = {}) {
  const supervisor = options.supervisor ?? new InMemoryServiceSupervisor({
    services: options.services ?? loadServiceDefinitionsFromEnvironment(),
    runtime: options.runtime,
    clock: options.clock,
    logLimit: options.logLimit,
    sleep: options.sleep,
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

      if (pathname === "/events" && req.method === "GET") {
        sendEventStreamHeaders(res);
        res.write("retry: 1500\n\n");
        writeSseEvent(res, supervisor.createSnapshotEvent());

        const heartbeat = setInterval(() => {
          res.write(": heartbeat\n\n");
        }, 15_000);
        const unsubscribe = supervisor.subscribe((event) => {
          writeSseEvent(res, event);
        });

        const cleanup = () => {
          clearInterval(heartbeat);
          unsubscribe();
        };

        req.on("close", cleanup);
        req.on("error", cleanup);
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
    const baseUrl = process.env.PYTHON_RUNTIME_BASE_URL || DEFAULT_PYTHON_RUNTIME_BASE_URL;
    const launchTarget = resolveLaunchTarget(baseUrl);
    return [
      {
        serviceId: "python-runtime",
        name: "Python runtime",
        baseUrl,
        command: process.env.PYTHON_RUNTIME_EXECUTABLE || DEFAULT_PYTHON_RUNTIME_EXECUTABLE,
        args: process.env.PYTHON_RUNTIME_ARGS
          ? process.env.PYTHON_RUNTIME_ARGS.split(" ").filter(Boolean)
          : [
            "-m",
            "uvicorn",
            process.env.PYTHON_RUNTIME_ENTRYPOINT || DEFAULT_PYTHON_RUNTIME_ENTRYPOINT,
            "--host",
            launchTarget.host,
            "--port",
            String(launchTarget.port),
          ],
        cwd: process.env.PYTHON_RUNTIME_WORKDIR || DEFAULT_PYTHON_RUNTIME_WORKDIR,
        env: parseJsonObject(process.env.PYTHON_RUNTIME_ENV_JSON),
        healthCheckPath: process.env.PYTHON_RUNTIME_HEALTH_PATH || DEFAULT_PYTHON_RUNTIME_HEALTH_PATH,
        startupTimeoutMs: normalizePositiveNumber(process.env.PYTHON_RUNTIME_STARTUP_TIMEOUT_MS, DEFAULT_STARTUP_TIMEOUT_MS),
        healthPollIntervalMs: normalizePositiveNumber(process.env.PYTHON_RUNTIME_HEALTH_POLL_INTERVAL_MS, DEFAULT_HEALTH_POLL_INTERVAL_MS),
        stopTimeoutMs: normalizePositiveNumber(process.env.SERVICE_SUPERVISOR_STOP_TIMEOUT_MS, DEFAULT_STOP_TIMEOUT_MS),
        metadata: {
          source: "default",
          kind: "builtin-python-runtime",
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

function parseJsonObject(rawValue) {
  if (!rawValue?.trim()) {
    return {};
  }

  const parsed = JSON.parse(rawValue);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object for environment variable map.");
  }

  return parsed;
}

function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown error";
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
