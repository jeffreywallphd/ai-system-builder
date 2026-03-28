import "dotenv/config";
import http from "node:http";
import crypto from "node:crypto";
import {
  accessSync,
  constants as fsConstants,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_PORT = Number(process.env.SERVICE_SUPERVISOR_PORT || 8790);
const DEFAULT_HOST = process.env.SERVICE_SUPERVISOR_HOST || "0.0.0.0";
const DEFAULT_LOG_LIMIT = Number(process.env.SERVICE_SUPERVISOR_LOG_LIMIT || 200);
const DEFAULT_METADATA_RETENTION_LIMIT = Number(process.env.SERVICE_SUPERVISOR_METADATA_RETENTION_LIMIT || 25);
const DEFAULT_STUB_MODE = process.env.SERVICE_SUPERVISOR_STUB_MODE === "true";
const DEFAULT_STARTUP_TIMEOUT_MS = 20_000;
const DEFAULT_HEALTH_POLL_INTERVAL_MS = 250;
const DEFAULT_STOP_TIMEOUT_MS = 5_000;
const DEFAULT_FETCH_TIMEOUT_MS = Number(process.env.SERVICE_SUPERVISOR_FETCH_TIMEOUT_MS || 2_000);
const DEFAULT_PYTHON_RUNTIME_BASE_URL = "http://127.0.0.1:8100";
const DEFAULT_PYTHON_RUNTIME_WORKDIR = `${process.cwd()}/python-runtime`;
const DEFAULT_PYTHON_RUNTIME_BIND_HOST = process.env.PYTHON_RUNTIME_BIND_HOST
  || (DEFAULT_HOST === "0.0.0.0" ? "0.0.0.0" : "127.0.0.1");
const DEFAULT_PYTHON_RUNTIME_EXECUTABLE = resolveDefaultPythonRuntimeExecutable();
const DEFAULT_ALLOWED_EXECUTABLES = [
  "python",
  "python3",
  "node",
  "bun",
  "uv",
  process.execPath,
  ...(path.isAbsolute(DEFAULT_PYTHON_RUNTIME_EXECUTABLE) ? [DEFAULT_PYTHON_RUNTIME_EXECUTABLE] : []),
];
const DEFAULT_ALLOWED_PATHS = [process.cwd(), DEFAULT_PYTHON_RUNTIME_WORKDIR];
const DEFAULT_PYTHON_RUNTIME_HEALTH_PATH = "/health";
const DEFAULT_PYTHON_RUNTIME_ENTRYPOINT = "app.main:app";
const DEFAULT_PYTHON_RUNTIME_VERSION = process.env.PYTHON_RUNTIME_PYTHON_VERSION?.trim() || "3.12";
const SUPPORTED_PYTHON_VERSIONS = new Set(["3.11", "3.12"]);
const PROVISIONING_METADATA_FILENAME = ".ai-loom-python-provisioning.json";
const PROVISIONING_METADATA_SCHEMA_VERSION = 2;
const DEFAULT_DEFINITIONS_PATH = path.join(process.cwd(), ".ai-loom-studio", "managed-services.json");
const DEFAULT_CONTROL_TOKEN = process.env.SERVICE_SUPERVISOR_CONTROL_TOKEN?.trim() || undefined;
const DEFAULT_RESTART_POLICY = Object.freeze({
  maxFailures: normalizePositiveNumber(process.env.SERVICE_SUPERVISOR_MAX_RESTART_FAILURES, 3),
  failureWindowMs: normalizePositiveNumber(process.env.SERVICE_SUPERVISOR_RESTART_FAILURE_WINDOW_MS, 60_000),
  cooldownMs: normalizePositiveNumber(process.env.SERVICE_SUPERVISOR_RESTART_COOLDOWN_MS, 30_000),
});
const SHELL_INTERPOLATION_PATTERN = /(`|\$\(|\$\{|&&|\|\||[;<>])/;
const CONTROL_HEADER_NAMES = ["authorization", "x-supervisor-token"];

function resolveDefaultPythonRuntimeExecutable() {
  const explicit = process.env.PYTHON_RUNTIME_EXECUTABLE?.trim();
  if (explicit) {
    return explicit;
  }

  const candidates = process.platform === "win32"
    ? [
      path.join(DEFAULT_PYTHON_RUNTIME_WORKDIR, ".venv", "Scripts", "python.exe"),
      path.join(DEFAULT_PYTHON_RUNTIME_WORKDIR, "venv", "Scripts", "python.exe"),
    ]
    : [
      path.join(DEFAULT_PYTHON_RUNTIME_WORKDIR, ".venv", "bin", "python"),
      path.join(DEFAULT_PYTHON_RUNTIME_WORKDIR, "venv", "bin", "python"),
    ];

  const localPython = candidates.find((candidate) => existsSync(candidate));
  return localPython || "python";
}

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

export const ProvisioningStates = Object.freeze({
  unsupported: "unsupported",
  unprovisioned: "unprovisioned",
  provisioning: "provisioning",
  provisioned: "provisioned",
  provisionFailed: "provision-failed",
  corrupted: "corrupted",
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

function appendRetainedItem(existingItems, nextItem, limit) {
  const retained = [...existingItems, nextItem];
  return retained.slice(Math.max(0, retained.length - limit));
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Supervisor-Token",
    ...extraHeaders,
  });

  res.end(body);
}

function sendEventStreamHeaders(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Supervisor-Token",
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

function normalizePositiveNumber(value, fallback) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
}

function parseListEnvironmentValue(rawValue, fallbackValues = []) {
  if (!rawValue?.trim()) {
    return [...fallbackValues];
  }

  const trimmed = rawValue.trim();
  const parsed = trimmed.startsWith("[") ? JSON.parse(trimmed) : trimmed.split(",");
  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array or comma-delimited string.");
  }

  return parsed
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseSupervisorSecurityPolicy(overrides = {}) {
  const allowedExecutableEntries = overrides.allowedExecutables
    ?? parseListEnvironmentValue(process.env.SERVICE_SUPERVISOR_ALLOWED_EXECUTABLES, DEFAULT_ALLOWED_EXECUTABLES);
  const allowedPathEntries = overrides.allowedPaths
    ?? parseListEnvironmentValue(process.env.SERVICE_SUPERVISOR_ALLOWED_PATHS, DEFAULT_ALLOWED_PATHS);

  const allowedExecutableNames = new Set();
  const allowedExecutablePaths = new Set();

  for (const entry of allowedExecutableEntries) {
    if (typeof entry !== "string") {
      continue;
    }

    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    if (path.isAbsolute(trimmed)) {
      allowedExecutablePaths.add(path.resolve(trimmed));
      continue;
    }

    allowedExecutableNames.add(trimmed);
  }

  return Object.freeze({
    allowedExecutableNames,
    allowedExecutablePaths,
    allowedPaths: new Set(allowedPathEntries.map((entry) => path.resolve(String(entry)))),
  });
}

function parseRestartPolicy(overrides = {}) {
  return Object.freeze({
    maxFailures: normalizePositiveNumber(overrides.maxFailures, DEFAULT_RESTART_POLICY.maxFailures),
    failureWindowMs: normalizePositiveNumber(overrides.failureWindowMs, DEFAULT_RESTART_POLICY.failureWindowMs),
    cooldownMs: normalizePositiveNumber(overrides.cooldownMs, DEFAULT_RESTART_POLICY.cooldownMs),
  });
}

function normalizeCompatibilityMetadata(compatibility) {
  if (!compatibility) {
    return {
      supervisorApiVersion: 1,
    };
  }

  if (typeof compatibility !== "object" || Array.isArray(compatibility)) {
    throw new Error("Service compatibility metadata must be an object.");
  }

  return {
    ...compatibility,
    supervisorApiVersion: compatibility.supervisorApiVersion ?? 1,
  };
}

function normalizeDependencyList(rawDependencies, serviceId) {
  if (!rawDependencies) {
    return [];
  }

  if (!Array.isArray(rawDependencies)) {
    throw new Error(`Service '${serviceId}' dependencies must be an array of service IDs.`);
  }

  return [...new Set(rawDependencies.map((dependencyId, index) => {
    if (typeof dependencyId !== "string" || !dependencyId.trim()) {
      throw new Error(`Service '${serviceId}' dependency at index ${index} must be a non-empty string.`);
    }

    return dependencyId.trim();
  }))];
}

function assertNoUnsafeShellInterpolation(value, fieldName) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }

  if (!value.trim()) {
    throw new Error(`${fieldName} must not be empty.`);
  }

  if (/\r|\n|\0/.test(value)) {
    throw new Error(`${fieldName} contains an unsafe control character.`);
  }

  if (SHELL_INTERPOLATION_PATTERN.test(value)) {
    throw new Error(`${fieldName} contains shell interpolation or redirection tokens that are not allowed.`);
  }
}

function isPathInsideAllowedRoots(targetPath, allowedRoots) {
  const resolvedTarget = path.resolve(targetPath);
  for (const root of allowedRoots) {
    const resolvedRoot = path.resolve(root);
    if (resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
      return true;
    }
  }
  return false;
}

function sanitizeBuiltinPythonRuntimeWorkingDirectory(serviceId, cwd) {
  if (serviceId !== "python-runtime" || typeof cwd !== "string" || !cwd.trim()) {
    return cwd;
  }

  const trimmed = cwd.trim();
  if (!/[\\/]dev[\\/]python-runtime$/.test(trimmed) && trimmed !== "dev/python-runtime" && trimmed !== "./dev/python-runtime") {
    return trimmed;
  }

  if (trimmed === "dev/python-runtime" || trimmed === "./dev/python-runtime") {
    return "python-runtime";
  }

  return trimmed.replace(/[\\/]dev[\\/]python-runtime$/, `${path.sep}python-runtime`);
}

function validateWorkingDirectory(cwd, securityPolicy) {
  const resolvedCwd = path.resolve(cwd);
  if (!isPathInsideAllowedRoots(resolvedCwd, securityPolicy.allowedPaths)) {
    throw new Error(`Working directory '${resolvedCwd}' is outside the allowed supervisor paths.`);
  }

  if (!existsSync(resolvedCwd) || !statSync(resolvedCwd).isDirectory()) {
    throw new Error(`Working directory '${resolvedCwd}' does not exist or is not a directory.`);
  }

  try {
    accessSync(resolvedCwd, fsConstants.R_OK | fsConstants.X_OK);
  } catch (error) {
    throw createPermissionError(`Working directory '${resolvedCwd}' is not accessible.`, error);
  }

  return resolvedCwd;
}

function validateExecutable(command, securityPolicy) {
  assertNoUnsafeShellInterpolation(command, "Service command");

  if (/\s/.test(command.trim())) {
    throw new Error("Service command must be a single executable path or command name.");
  }

  if (path.isAbsolute(command)) {
    const resolvedCommand = path.resolve(command);
    if (!securityPolicy.allowedExecutablePaths.has(resolvedCommand)) {
      throw new Error(`Executable '${resolvedCommand}' is not in the allowed executable paths.`);
    }

    if (existsSync(resolvedCommand)) {
      try {
        accessSync(resolvedCommand, fsConstants.X_OK);
      } catch (error) {
        throw createPermissionError(`Executable '${resolvedCommand}' is not executable.`, error);
      }
    }

    return resolvedCommand;
  }

  if (command.includes(path.sep)) {
    throw new Error("Relative executable paths are not allowed; use an approved absolute path or command name.");
  }

  if (!securityPolicy.allowedExecutableNames.has(command)) {
    throw new Error(`Executable '${command}' is not in the allowed executable list.`);
  }

  return command;
}

function validateServiceArguments(args) {
  if (!Array.isArray(args)) {
    throw new Error("Service args must be an array of strings.");
  }

  return args.map((value, index) => {
    if (typeof value !== "string") {
      throw new Error(`Service arg at index ${index} must be a string.`);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error(`Service arg at index ${index} must not be empty.`);
    }

    assertNoUnsafeShellInterpolation(trimmed, `Service arg '${trimmed}'`);
    return trimmed;
  });
}

function normalizeEnvironmentVariables(env) {
  if (!env) {
    return {};
  }

  if (typeof env !== "object" || Array.isArray(env)) {
    throw new Error("Service env must be an object.");
  }

  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        throw new Error(`Environment variable key '${key}' is invalid.`);
      }

      if (value === undefined || value === null) {
        return [key, ""];
      }

      if (typeof value === "object") {
        throw new Error(`Environment variable '${key}' must be a primitive value.`);
      }

      return [key, String(value)];
    }),
  );
}

function normalizeServiceDefinition(definition, options = {}) {
  if (!definition || typeof definition !== "object") {
    throw new Error("Service definition must be an object.");
  }

  const serviceId = typeof definition.serviceId === "string" ? definition.serviceId.trim() : "";
  const displayName = typeof definition.displayName === "string" ? definition.displayName.trim() : "";
  const name = typeof definition.name === "string" && definition.name.trim()
    ? definition.name.trim()
    : displayName || serviceId;

  if (!serviceId) {
    throw new Error("Service definition serviceId is required.");
  }

  const securityPolicy = options.securityPolicy ?? parseSupervisorSecurityPolicy();
  const baseUrl = typeof definition.baseUrl === "string" ? definition.baseUrl.trim() : undefined;
  const healthCheckPath = typeof definition.healthCheckPath === "string"
    ? definition.healthCheckPath.trim()
    : DEFAULT_PYTHON_RUNTIME_HEALTH_PATH;
  const args = validateServiceArguments(
    Array.isArray(definition.args)
      ? definition.args.filter((value) => typeof value === "string")
      : [],
  );
  const workingDirectory = typeof definition.workingDirectory === "string" ? definition.workingDirectory.trim() : "";
  const requestedCwd = typeof definition.cwd === "string" && definition.cwd.trim()
    ? definition.cwd.trim()
    : workingDirectory || process.cwd();
  const cwd = validateWorkingDirectory(
    sanitizeBuiltinPythonRuntimeWorkingDirectory(serviceId, requestedCwd),
    securityPolicy,
  );
  const env = normalizeEnvironmentVariables(definition.env ?? definition.environmentVariables);
  const metadata = definition.metadata && typeof definition.metadata === "object" && !Array.isArray(definition.metadata)
    ? { ...definition.metadata }
    : {};
  const transport = typeof definition.transport === "string" && definition.transport.trim()
    ? definition.transport.trim()
    : definition.command && baseUrl
      ? "hybrid"
      : definition.command
        ? "process"
        : baseUrl
          ? "http"
          : "none";
  const description = typeof definition.description === "string" && definition.description.trim()
    ? definition.description.trim()
    : typeof metadata.description === "string" && metadata.description.trim()
      ? metadata.description.trim()
      : undefined;
  const version = typeof definition.version === "string" && definition.version.trim()
    ? definition.version.trim()
    : typeof metadata.version === "string" && metadata.version.trim()
      ? metadata.version.trim()
      : "unversioned";
  const compatibility = normalizeCompatibilityMetadata(definition.compatibility ?? metadata.compatibility);
  const pythonVersion = typeof definition.pythonVersion === "string" && definition.pythonVersion.trim()
    ? definition.pythonVersion.trim()
    : typeof metadata.pythonVersion === "string" && metadata.pythonVersion.trim()
      ? metadata.pythonVersion.trim()
      : serviceId === "python-runtime"
        ? DEFAULT_PYTHON_RUNTIME_VERSION
        : undefined;
  const pythonInterpreterPath = typeof definition.pythonInterpreterPath === "string" && definition.pythonInterpreterPath.trim()
    ? definition.pythonInterpreterPath.trim()
    : typeof metadata.pythonInterpreterPath === "string" && metadata.pythonInterpreterPath.trim()
      ? metadata.pythonInterpreterPath.trim()
      : undefined;

  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch (error) {
      throw new Error(`Service '${serviceId}' baseUrl is invalid: ${toErrorMessage(error)}`);
    }
  }

  if (!healthCheckPath.startsWith("/")) {
    throw new Error(`Service '${serviceId}' healthCheckPath must begin with '/'.`);
  }

  const normalized = Object.freeze({
    serviceId,
    name: name || serviceId,
    dependencies: Object.freeze(normalizeDependencyList(definition.dependencies, serviceId)),
    command: typeof definition.command === "string" && definition.command.trim()
      ? validateExecutable(definition.command.trim(), securityPolicy)
      : undefined,
    args,
    cwd,
    env,
    baseUrl: baseUrl || undefined,
    healthCheckPath: healthCheckPath || "/health",
    startupTimeoutMs: normalizePositiveNumber(definition.startupTimeoutMs, DEFAULT_STARTUP_TIMEOUT_MS),
    healthPollIntervalMs: normalizePositiveNumber(definition.healthPollIntervalMs, DEFAULT_HEALTH_POLL_INTERVAL_MS),
    stopTimeoutMs: normalizePositiveNumber(definition.stopTimeoutMs, DEFAULT_STOP_TIMEOUT_MS),
    metadata: {
      ...metadata,
      kind: typeof definition.kind === "string" && definition.kind.trim()
        ? definition.kind.trim()
        : typeof metadata.kind === "string" && metadata.kind.trim()
          ? metadata.kind.trim()
          : serviceId === "python-runtime"
            ? "python-runtime"
            : "custom",
      source: typeof definition.source === "string" && definition.source.trim()
        ? definition.source.trim()
        : typeof metadata.source === "string" && metadata.source.trim()
          ? metadata.source.trim()
          : serviceId === "python-runtime"
            ? "builtin"
            : "custom",
      transport,
      autoStartPolicy: typeof definition.autoStartPolicy === "string" && definition.autoStartPolicy.trim()
        ? definition.autoStartPolicy.trim()
        : typeof metadata.autoStartPolicy === "string" && metadata.autoStartPolicy.trim()
          ? metadata.autoStartPolicy.trim()
          : "manual",
      restartPolicyName: typeof definition.restartPolicy === "string" && definition.restartPolicy.trim()
        ? definition.restartPolicy.trim()
        : typeof metadata.restartPolicyName === "string" && metadata.restartPolicyName.trim()
          ? metadata.restartPolicyName.trim()
          : "on-failure",
      capabilities: Array.isArray(definition.capabilities)
        ? definition.capabilities.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())
        : Array.isArray(metadata.capabilities)
          ? metadata.capabilities.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())
          : [],
      tags: Array.isArray(definition.tags)
        ? definition.tags.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())
        : Array.isArray(metadata.tags)
          ? metadata.tags.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())
          : [],
      description,
      version,
      compatibility,
      pythonVersion,
      pythonInterpreterPath,
    },
    restartPolicy: parseRestartPolicy(definition.restartPolicy),
  });

  return normalized;
}

function toManagedServiceDefinition(definition) {
  return Object.freeze({
    serviceId: definition.serviceId,
    kind: definition.metadata.kind ?? (definition.serviceId === "python-runtime" ? "python-runtime" : "custom"),
    displayName: definition.name,
    description: definition.metadata.description,
    dependencies: [...(definition.dependencies ?? [])],
    transport: definition.metadata.transport ?? (definition.command && definition.baseUrl
      ? "hybrid"
      : definition.command
        ? "process"
        : definition.baseUrl
          ? "http"
          : "none"),
    source: definition.metadata.source ?? (definition.serviceId === "python-runtime" ? "builtin" : "custom"),
    baseUrl: definition.baseUrl,
    healthCheckPath: definition.healthCheckPath,
    workingDirectory: definition.cwd,
    command: definition.command,
    args: [...definition.args],
    environmentVariables: { ...definition.env },
    autoStartPolicy: definition.metadata.autoStartPolicy ?? "manual",
    restartPolicy: definition.metadata.restartPolicyName ?? "on-failure",
    startupTimeoutMs: definition.startupTimeoutMs,
    pythonVersion: definition.metadata.pythonVersion,
    pythonInterpreterPath: definition.metadata.pythonInterpreterPath,
    tags: [...(definition.metadata.tags ?? [])],
    capabilities: [...(definition.metadata.capabilities ?? [])],
  });
}

function readPersistedServiceDefinitions(definitionsPath) {
  if (!definitionsPath || !existsSync(definitionsPath)) {
    return [];
  }

  const raw = readFileSync(definitionsPath, "utf8");
  if (!raw.trim()) {
    return [];
  }

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Persisted managed service definitions must be a JSON array.");
  }

  return parsed;
}

function persistServiceDefinitions(definitionsPath, definitions) {
  if (!definitionsPath) {
    return;
  }

  mkdirSync(path.dirname(definitionsPath), { recursive: true });
  writeFileSync(definitionsPath, `${JSON.stringify(definitions, null, 2)}\n`, "utf8");
}

function createInitialDiagnostics(definition, clock) {
  return {
    lastError: null,
    lastExit: null,
    lastStart: null,
    lastHealthProbe: null,
    provisioning: buildInitialProvisioningState(clock, definition),
    circuitBreaker: {
      state: "closed",
      openedAt: null,
      retryAfter: null,
      recentFailures: 0,
      maxFailures: definition.restartPolicy.maxFailures,
      failureWindowMs: definition.restartPolicy.failureWindowMs,
      cooldownMs: definition.restartPolicy.cooldownMs,
    },
  };
}

function createInitialServiceState(definition, clock) {
  return {
    serviceId: definition.serviceId,
    name: definition.name,
    command: definition.command,
    args: definition.args,
    dependencies: definition.dependencies,
    cwd: definition.cwd,
    baseUrl: definition.baseUrl,
    pid: null,
    startedAt: null,
    lastHealthCheckAt: null,
    state: ServiceStates.stopped,
    ownership: ServiceOwnership.none,
    detail: `${definition.name} is stopped.`,
    recentLogs: [createLogEntry(clock, "info", `${definition.name} registered with supervisor.`)],
    processHistory: [],
    metadata: definition.metadata,
    diagnostics: createInitialDiagnostics(definition, clock),
    failureTimestamps: [],
  };
}

function appendRecentLog(existingLogs, logEntry, limit) {
  return appendRetainedItem(existingLogs, logEntry, limit);
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
      host: DEFAULT_PYTHON_RUNTIME_BIND_HOST,
      port: Number.isFinite(port) && port > 0 ? port : 8100,
    };
  } catch {
    return { host: DEFAULT_PYTHON_RUNTIME_BIND_HOST, port: 8100 };
  }
}

function createProcessHistoryEntry(clock, values = {}) {
  return {
    observedAt: createClockTimestamp(clock),
    pid: values.pid ?? null,
    startedAt: values.startedAt ?? null,
    endedAt: values.endedAt ?? null,
    ownership: values.ownership ?? ServiceOwnership.none,
    outcome: values.outcome ?? "observed",
    exitCode: values.exitCode ?? null,
    signal: values.signal ?? null,
    detail: values.detail ?? "",
  };
}

function createDiagnosticError(clock, category, message, details = {}) {
  return {
    at: createClockTimestamp(clock),
    category,
    message,
    code: typeof details.code === "string" ? details.code : null,
    details,
  };
}

function createPermissionError(message, error) {
  const permissionError = new Error(`${message} Permission denied.`);
  permissionError.cause = error;
  permissionError.code = error?.code ?? "EACCES";
  return permissionError;
}

function isProvisioningRequired(definition) {
  const commandName = path.basename(definition?.command || "").toLowerCase();
  return definition?.metadata?.kind === "python-runtime"
    && path.basename(definition?.cwd || "") === "python-runtime"
    && (commandName.startsWith("python") || commandName === "py");
}

function resolveRequestedPythonVersion(definition) {
  return definition?.metadata?.pythonVersion ?? DEFAULT_PYTHON_RUNTIME_VERSION;
}

function getPythonEnvironmentPath(definition) {
  return path.join(definition.cwd, ".venv");
}

function getProvisioningMetadataPath(definition) {
  return path.join(getPythonEnvironmentPath(definition), PROVISIONING_METADATA_FILENAME);
}

function getVenvPythonPath(definition) {
  return process.platform === "win32"
    ? path.join(getPythonEnvironmentPath(definition), "Scripts", "python.exe")
    : path.join(getPythonEnvironmentPath(definition), "bin", "python");
}

function readProvisioningMetadata(definition) {
  const metadataPath = getProvisioningMetadataPath(definition);
  if (!existsSync(metadataPath)) {
    return undefined;
  }

  try {
    return JSON.parse(readFileSync(metadataPath, "utf8"));
  } catch {
    return undefined;
  }
}

function hashFileContents(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  return crypto.createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function buildProvisioningFingerprint(definition) {
  return {
    schemaVersion: PROVISIONING_METADATA_SCHEMA_VERSION,
    requirementsHash: hashFileContents(path.join(definition.cwd, "requirements.txt")),
    platform: process.platform,
    arch: process.arch,
  };
}

function isFingerprintMismatch(currentFingerprint, savedFingerprint) {
  if (!savedFingerprint || typeof savedFingerprint !== "object") {
    return true;
  }

  return currentFingerprint.schemaVersion !== savedFingerprint.schemaVersion
    || currentFingerprint.requirementsHash !== savedFingerprint.requirementsHash
    || currentFingerprint.platform !== savedFingerprint.platform
    || currentFingerprint.arch !== savedFingerprint.arch;
}

function buildInitialProvisioningState(clock, definition) {
  if (!isProvisioningRequired(definition)) {
    return {
      state: ProvisioningStates.unsupported,
      required: false,
      requestedVersion: null,
      resolvedVersion: null,
      resolvedInterpreter: null,
      environmentPath: null,
      versionMismatch: false,
      fingerprintMismatch: false,
      needsReprovision: false,
      lastUpdatedAt: null,
      lastError: null,
    };
  }

  const requestedVersion = resolveRequestedPythonVersion(definition);
  const metadata = readProvisioningMetadata(definition);
  const environmentPath = getPythonEnvironmentPath(definition);
  const venvPythonPath = getVenvPythonPath(definition);
  const hasEnvironment = existsSync(environmentPath) && existsSync(venvPythonPath);
  const resolvedVersion = metadata?.resolvedVersion ?? null;
  const versionMismatch = Boolean(hasEnvironment && resolvedVersion && !String(resolvedVersion).startsWith(requestedVersion));
  const fingerprintMismatch = Boolean(hasEnvironment
    && isFingerprintMismatch(buildProvisioningFingerprint(definition), metadata?.fingerprint));

  return {
    state: hasEnvironment ? ProvisioningStates.provisioned : ProvisioningStates.unprovisioned,
    required: true,
    requestedVersion,
    resolvedVersion,
    resolvedInterpreter: metadata?.resolvedInterpreter ?? null,
    environmentPath,
    versionMismatch,
    fingerprintMismatch,
    needsReprovision: versionMismatch || fingerprintMismatch,
    lastUpdatedAt: metadata?.provisionedAt ?? null,
    lastError: null,
  };
}

function toErrorDetails(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: error.code ?? null,
      cause: error.cause instanceof Error ? error.cause.message : error.cause ?? null,
    };
  }

  return { message: toErrorMessage(error), code: null };
}

function normalizeProbeResult(clock, definition, healthy, detail, extra = {}) {
  return {
    healthy,
    detail,
    logs: extra.logs ?? [],
    probe: {
      at: createClockTimestamp(clock),
      healthy,
      detail,
      url: extra.url ?? resolveHealthUrl(definition) ?? null,
      statusCode: extra.statusCode ?? null,
      durationMs: extra.durationMs ?? null,
      errorCode: extra.errorCode ?? null,
    },
  };
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
      return normalizeProbeResult(
        clock,
        definition,
        state.state === ServiceStates.healthy,
        state.state === ServiceStates.healthy
          ? `${definition.name} stub health check passed.`
          : `${definition.name} is not healthy.`,
        {
          logs: [createLogEntry(clock, "info", `Stubbed health check for ${definition.serviceId}.`)],
        },
      );
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

      const startupDeferred = createDeferred();
      const exitDeferred = createDeferred();
      let settledStartup = false;

      const child = spawn(definition.command, definition.args, {
        cwd: definition.cwd,
        env: {
          ...process.env,
          ...definition.env,
        },
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
        windowsHide: true,
      });

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

      child.once("spawn", () => {
        if (settledStartup) {
          return;
        }

        settledStartup = true;
        startupDeferred.resolve({
          pid: child.pid ?? null,
          startedAt: createClockTimestamp(clock),
          detail: `Started ${definition.name}.`,
          logs: [createLogEntry(clock, "info", `Started ${definition.serviceId} with pid ${child.pid ?? "unknown"}.`)],
          exitPromise: record.exitPromise,
        });
      });

      child.on("error", (error) => {
        if (!settledStartup) {
          settledStartup = true;
          childProcesses.delete(definition.serviceId);
          exitDeferred.resolve({ code: null, signal: null, errorCode: error.code ?? null });
          startupDeferred.reject(error);
          return;
        }

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
          errorCode: null,
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

      return startupDeferred.promise;
    },
    async stop(definition, _state, hooks = {}) {
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
        return normalizeProbeResult(
          clock,
          definition,
          Boolean(record && state.pid),
          record ? `${definition.name} process is active.` : `${definition.name} process is not active.`,
          {
            logs: [createLogEntry(clock, "info", `Checked process health for ${definition.serviceId}.`)],
            url: null,
          },
        );
      }

      const startedAt = Date.now();
      try {
        const response = await withTimeout(
          fetch(healthUrl, { headers: { Accept: "application/json" } }),
          DEFAULT_FETCH_TIMEOUT_MS,
          `${definition.name} health check timed out for ${healthUrl}.`,
        );
        const healthy = response.ok;
        const detail = healthy
          ? `${definition.name} health check passed at ${healthUrl}.`
          : `${definition.name} health check returned HTTP ${response.status} at ${healthUrl}.`;
        return normalizeProbeResult(clock, definition, healthy, detail, {
          logs: [createLogEntry(clock, healthy ? "info" : "warning", `Health check ${healthy ? "passed" : "failed"} for ${definition.serviceId}.`)],
          url: healthUrl,
          statusCode: response.status,
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        if (record && state.pid) {
          await sleep(1);
        }
        return normalizeProbeResult(clock, definition, false, `${definition.name} health check failed at ${healthUrl}: ${toErrorMessage(error)}`, {
          logs: [createLogEntry(clock, "warning", `Health check failed for ${definition.serviceId}.`)],
          url: healthUrl,
          durationMs: Date.now() - startedAt,
          errorCode: error?.code ?? (error instanceof Error ? error.name : null),
        });
      }
    },
  };
}

export class InMemoryServiceSupervisor {
  constructor(options = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.logLimit = Number(options.logLimit ?? DEFAULT_LOG_LIMIT);
    this.metadataRetentionLimit = Number(options.metadataRetentionLimit ?? DEFAULT_METADATA_RETENTION_LIMIT);
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.definitions = new Map();
    this.states = new Map();
    this.operations = new Map();
    this.listeners = new Set();
    this.nextEventId = 1;
    this.baseDefinitions = new Map();
    this.persistedDefinitions = new Map();
    this.securityPolicy = parseSupervisorSecurityPolicy(options);
    this.definitionsPath = typeof options.definitionsPath === "string" && options.definitionsPath.trim()
      ? path.resolve(options.definitionsPath)
      : process.env.SERVICE_SUPERVISOR_DEFINITIONS_PATH?.trim()
        ? path.resolve(process.env.SERVICE_SUPERVISOR_DEFINITIONS_PATH.trim())
        : undefined;
    this.controlToken = typeof options.controlToken === "string" && options.controlToken.trim()
      ? options.controlToken.trim()
      : DEFAULT_CONTROL_TOKEN;
    this.runtime = options.runtime ?? (DEFAULT_STUB_MODE
      ? createStubProcessRuntime({ clock: this.clock })
      : createNodeProcessRuntime({ clock: this.clock, sleep: this.sleep }));

    for (const rawDefinition of options.services ?? []) {
      try {
        const definition = normalizeServiceDefinition(rawDefinition, { securityPolicy: this.securityPolicy });
        this.baseDefinitions.set(definition.serviceId, definition);
      } catch (error) {
        const serviceId = typeof rawDefinition?.serviceId === "string" && rawDefinition.serviceId.trim()
          ? rawDefinition.serviceId.trim()
          : `invalid-service-${this.definitions.size + this.states.size + 1}`;
        const name = typeof rawDefinition?.name === "string" && rawDefinition.name.trim() ? rawDefinition.name.trim() : serviceId;
        const fallbackDefinition = Object.freeze({
          serviceId,
          name,
          command: undefined,
          args: [],
          cwd: process.cwd(),
          env: {},
          baseUrl: undefined,
      healthCheckPath: DEFAULT_PYTHON_RUNTIME_HEALTH_PATH,
      dependencies: [],
          startupTimeoutMs: DEFAULT_STARTUP_TIMEOUT_MS,
          healthPollIntervalMs: DEFAULT_HEALTH_POLL_INTERVAL_MS,
          stopTimeoutMs: DEFAULT_STOP_TIMEOUT_MS,
          metadata: {
            version: "invalid",
            compatibility: { supervisorApiVersion: 1 },
          },
          restartPolicy: parseRestartPolicy(),
          invalid: true,
          invalidReason: toErrorMessage(error),
        });
        this.baseDefinitions.set(serviceId, fallbackDefinition);
      }
    }

    for (const rawDefinition of readPersistedServiceDefinitions(this.definitionsPath)) {
      const definition = normalizeServiceDefinition(rawDefinition, { securityPolicy: this.securityPolicy });
      this.persistedDefinitions.set(definition.serviceId, definition);
    }

    this.rebuildDefinitions();
  }

  nowMs() {
    return this.clock().getTime();
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
        services: [...this.states.values()].map((state) => this.toSummary(state.serviceId)),
      },
    };
  }

  getService(serviceId) {
    if (!this.states.has(serviceId)) {
      return undefined;
    }

    return this.toSummary(serviceId);
  }

  rebuildDefinitions() {
    const mergedDefinitions = new Map(this.baseDefinitions);
    for (const [serviceId, definition] of this.persistedDefinitions.entries()) {
      mergedDefinitions.set(serviceId, definition);
    }

    this.definitions = mergedDefinitions;

    for (const [serviceId, definition] of this.definitions.entries()) {
      const existingState = this.states.get(serviceId);
      if (!existingState) {
        const nextState = createInitialServiceState(definition, this.clock);
        if (definition.invalid) {
          nextState.state = ServiceStates.failed;
          nextState.detail = `Invalid service configuration: ${definition.invalidReason}`;
          nextState.diagnostics.lastError = createDiagnosticError(this.clock, "config", nextState.detail, {
            serviceId,
          });
          nextState.processHistory = appendRetainedItem(nextState.processHistory, createProcessHistoryEntry(this.clock, {
            ownership: ServiceOwnership.none,
            outcome: "config-rejected",
            detail: nextState.detail,
          }), this.metadataRetentionLimit);
        }
        this.states.set(serviceId, nextState);
        continue;
      }

      this.states.set(serviceId, {
        ...existingState,
        name: definition.name,
        command: definition.command,
        args: definition.args,
        dependencies: definition.dependencies,
        cwd: definition.cwd,
        baseUrl: definition.baseUrl,
        metadata: definition.metadata,
        diagnostics: {
          ...existingState.diagnostics,
          provisioning: this.reconcileProvisioningState(existingState.diagnostics.provisioning, definition),
          circuitBreaker: {
            ...existingState.diagnostics.circuitBreaker,
            maxFailures: definition.restartPolicy.maxFailures,
            failureWindowMs: definition.restartPolicy.failureWindowMs,
            cooldownMs: definition.restartPolicy.cooldownMs,
          },
        },
      });
    }

    for (const serviceId of [...this.states.keys()]) {
      if (!this.definitions.has(serviceId)) {
        this.states.delete(serviceId);
      }
    }
  }

  persistDefinitions() {
    persistServiceDefinitions(
      this.definitionsPath,
      [...this.persistedDefinitions.values()].map((definition) => toManagedServiceDefinition(definition)),
    );
  }

  reconcileProvisioningState(existingProvisioning, definition) {
    const baseline = buildInitialProvisioningState(this.clock, definition);
    if (!existingProvisioning?.required) {
      return baseline;
    }

    const requestedVersion = resolveRequestedPythonVersion(definition);
    const resolvedVersion = existingProvisioning.resolvedVersion ?? baseline.resolvedVersion ?? null;
    const versionMismatch = Boolean(resolvedVersion && !String(resolvedVersion).startsWith(requestedVersion));
    return {
      ...existingProvisioning,
      required: true,
      requestedVersion,
      environmentPath: getPythonEnvironmentPath(definition),
      versionMismatch,
      fingerprintMismatch: baseline.fingerprintMismatch,
      needsReprovision: versionMismatch || baseline.needsReprovision,
      state: existingProvisioning.state === ProvisioningStates.unsupported
        ? baseline.state
        : existingProvisioning.state,
    };
  }

  async provision(serviceId) {
    return this.runLifecycleOperation(serviceId, "provision", () => this.provisionInternal(serviceId, "provision"));
  }

  async repair(serviceId) {
    return this.runLifecycleOperation(serviceId, "repair", () => this.provisionInternal(serviceId, "repair"));
  }

  async recreateEnvironment(serviceId) {
    return this.runLifecycleOperation(serviceId, "recreate-environment", () => this.provisionInternal(serviceId, "recreate-environment"));
  }

  async runCommand(command, args, options = {}) {
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ? { ...process.env, ...options.env } : process.env,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.once("error", reject);
      child.once("close", (code, signal) => {
        resolve({
          code: typeof code === "number" ? code : null,
          signal: signal ?? null,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });
    });
  }

  async inspectInterpreter(command, args, cwd) {
    const result = await this.runCommand(command, [...args, "-c", "import json,platform,sys; print(json.dumps({'version': platform.python_version(), 'executable': sys.executable}))"], { cwd });
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || `Interpreter inspection failed for ${command}.`);
    }
    try {
      return JSON.parse(result.stdout);
    } catch (error) {
      throw new Error(`Interpreter inspection returned invalid JSON: ${toErrorMessage(error)}`);
    }
  }

  async resolvePythonInterpreter(definition) {
    const requestedVersion = resolveRequestedPythonVersion(definition);
    if (!SUPPORTED_PYTHON_VERSIONS.has(requestedVersion)) {
      throw new Error(`Unsupported Python version '${requestedVersion}'. Supported versions: ${[...SUPPORTED_PYTHON_VERSIONS].join(", ")}.`);
    }

    const candidates = [];
    if (definition.metadata.pythonInterpreterPath) {
      candidates.push({ command: definition.metadata.pythonInterpreterPath, args: [], label: definition.metadata.pythonInterpreterPath });
    }
    if (process.platform === "win32") {
      candidates.push({ command: "py", args: [`-${requestedVersion}`], label: `py -${requestedVersion}` });
    }
    candidates.push({ command: `python${requestedVersion}`, args: [], label: `python${requestedVersion}` });
    candidates.push({ command: "python3", args: [], label: "python3" });
    candidates.push({ command: "python", args: [], label: "python" });

    let lastError;
    for (const candidate of candidates) {
      try {
        const inspection = await this.inspectInterpreter(candidate.command, candidate.args, definition.cwd);
        if (!String(inspection.version).startsWith(requestedVersion)) {
          lastError = new Error(`Resolved ${candidate.label} to Python ${inspection.version}, expected ${requestedVersion}.`);
          continue;
        }
        return {
          command: candidate.command,
          args: candidate.args,
          executable: inspection.executable,
          version: inspection.version,
          requestedVersion,
          label: candidate.label,
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(`Unable to resolve a compatible Python ${requestedVersion} interpreter. ${lastError ? toErrorMessage(lastError) : ""}`.trim());
  }

  updateProvisioning(serviceId, patch) {
    const state = this.requireState(serviceId);
    return this.updateState(serviceId, {
      diagnostics: {
        ...state.diagnostics,
        provisioning: {
          ...state.diagnostics.provisioning,
          ...patch,
        },
      },
    });
  }

  appendCommandOutput(serviceId, result) {
    if (!result) {
      return;
    }

    if (result.stdout) {
      this.appendLog(serviceId, "stdout", result.stdout);
    }
    if (result.stderr) {
      this.appendLog(serviceId, "stderr", result.stderr);
    }
  }

  async validateVenvPipHealth(serviceId, definition, venvPython) {
    if (!existsSync(venvPython)) {
      return {
        healthy: false,
        error: new Error(`Virtual environment interpreter not found at ${venvPython}.`),
      };
    }

    const importCheck = await this.runCommand(
      venvPython,
      ["-c", "import pip; import pip._internal.cli.main"],
      { cwd: definition.cwd },
    );
    this.appendCommandOutput(serviceId, importCheck);
    if (importCheck.code !== 0) {
      const error = new Error(importCheck.stderr || importCheck.stdout || "pip import integrity check failed.");
      error.code = "PYTHON_RUNTIME_PIP_CORRUPTED";
      return { healthy: false, error };
    }

    const pipVersion = await this.runCommand(venvPython, ["-m", "pip", "--version"], { cwd: definition.cwd });
    this.appendCommandOutput(serviceId, pipVersion);
    if (pipVersion.code !== 0) {
      const error = new Error(pipVersion.stderr || pipVersion.stdout || "pip command check failed.");
      error.code = "PYTHON_RUNTIME_PIP_CORRUPTED";
      return { healthy: false, error };
    }

    return { healthy: true, error: null };
  }

  async provisionInternal(serviceId, action) {
    const definition = this.requireDefinition(serviceId);
    const state = this.requireState(serviceId);
    if (!isProvisioningRequired(definition)) {
      return this.cloneState(state);
    }

    const environmentPath = getPythonEnvironmentPath(definition);
    const metadataPath = getProvisioningMetadataPath(definition);
    const requestedVersion = resolveRequestedPythonVersion(definition);

    this.updateProvisioning(serviceId, {
      state: ProvisioningStates.provisioning,
      required: true,
      requestedVersion,
      environmentPath,
      lastUpdatedAt: createClockTimestamp(this.clock),
      lastError: null,
    });
    this.appendLog(serviceId, "info", `${definition.name} provisioning ${action} started.`);

    try {
      const interpreter = await this.resolvePythonInterpreter(definition);
      this.appendLog(serviceId, "info", `Resolved Python ${interpreter.version} at ${interpreter.executable}.`);

      if (action === "recreate-environment" && existsSync(environmentPath)) {
        this.appendLog(serviceId, "warning", `Removing existing virtual environment at ${environmentPath}.`);
        rmSync(environmentPath, { recursive: true, force: true });
      }

      const venvPython = getVenvPythonPath(definition);
      const metadataBefore = readProvisioningMetadata(definition);
      const shouldRecreate = action !== "provision"
        && (
          !existsSync(venvPython)
          || (metadataBefore?.resolvedVersion && !String(metadataBefore.resolvedVersion).startsWith(requestedVersion))
        );

      if (shouldRecreate && existsSync(environmentPath)) {
        this.appendLog(serviceId, "warning", `Rebuilding incompatible or broken environment at ${environmentPath}.`);
        rmSync(environmentPath, { recursive: true, force: true });
      }

      let environmentCreated = false;
      if (!existsSync(venvPython)) {
        this.appendLog(serviceId, "info", `Creating virtual environment in ${environmentPath}.`);
        const createResult = await this.runCommand(interpreter.command, [...interpreter.args, "-m", "venv", environmentPath], { cwd: definition.cwd });
        this.appendCommandOutput(serviceId, createResult);
        if (createResult.code !== 0) {
          throw new Error(createResult.stderr || createResult.stdout || "Virtual environment creation failed.");
        }
        environmentCreated = true;
      } else {
        this.appendLog(serviceId, "info", `Using existing virtual environment at ${environmentPath}.`);
      }

      let pipHealth = await this.validateVenvPipHealth(serviceId, definition, venvPython);
      if (!pipHealth.healthy) {
        this.appendLog(serviceId, "warning", `${definition.name} detected corrupted Python environment: ${toErrorMessage(pipHealth.error)} Attempting ensurepip repair.`);
        this.updateProvisioning(serviceId, {
          state: ProvisioningStates.corrupted,
          required: true,
          requestedVersion,
          environmentPath,
          needsReprovision: true,
          lastUpdatedAt: createClockTimestamp(this.clock),
          lastError: createDiagnosticError(this.clock, "provisioning", toErrorMessage(pipHealth.error), {
            code: pipHealth.error?.code ?? "PYTHON_RUNTIME_PIP_CORRUPTED",
            category: "corrupted-environment",
          }),
        });

        const ensurePipResult = await this.runCommand(venvPython, ["-m", "ensurepip", "--upgrade"], { cwd: definition.cwd });
        this.appendCommandOutput(serviceId, ensurePipResult);
        if (ensurePipResult.code === 0) {
          pipHealth = await this.validateVenvPipHealth(serviceId, definition, venvPython);
        }

        if (!pipHealth.healthy) {
          this.appendLog(serviceId, "warning", `${definition.name} pip repair failed; recreating virtual environment at ${environmentPath}.`);
          if (existsSync(environmentPath)) {
            rmSync(environmentPath, { recursive: true, force: true });
          }

          const recreateResult = await this.runCommand(interpreter.command, [...interpreter.args, "-m", "venv", environmentPath], { cwd: definition.cwd });
          this.appendCommandOutput(serviceId, recreateResult);
          if (recreateResult.code !== 0) {
            const recreationError = new Error(recreateResult.stderr || recreateResult.stdout || "Virtual environment recreation failed.");
            recreationError.code = "PYTHON_RUNTIME_ENV_RECREATE_FAILED";
            throw recreationError;
          }
          environmentCreated = true;
          pipHealth = await this.validateVenvPipHealth(serviceId, definition, venvPython);
          if (!pipHealth.healthy) {
            const corruptedError = new Error(`Python virtual environment remains corrupted after repair and recreation: ${toErrorMessage(pipHealth.error)}`);
            corruptedError.code = "PYTHON_RUNTIME_PIP_CORRUPTED";
            throw corruptedError;
          }
        }
      }

      if (!environmentCreated) {
        this.appendLog(serviceId, "info", `Virtual environment at ${environmentPath} passed integrity checks.`);
      }

      const upgradePip = await this.runCommand(venvPython, ["-m", "pip", "install", "--upgrade", "pip"], { cwd: definition.cwd });
      this.appendCommandOutput(serviceId, upgradePip);
      if (upgradePip.code !== 0) {
        throw new Error(upgradePip.stderr || upgradePip.stdout || "pip upgrade failed.");
      }

      const requirementsPath = path.join(definition.cwd, "requirements.txt");
      this.appendLog(serviceId, "info", `Installing requirements from ${requirementsPath}.`);
      const installRequirements = await this.runCommand(venvPython, ["-m", "pip", "install", "-r", requirementsPath], { cwd: definition.cwd });
      this.appendCommandOutput(serviceId, installRequirements);
      if (installRequirements.code !== 0) {
        throw new Error(installRequirements.stderr || installRequirements.stdout || "requirements installation failed.");
      }

      mkdirSync(environmentPath, { recursive: true });
      const provisioningFingerprint = buildProvisioningFingerprint(definition);
      writeFileSync(metadataPath, `${JSON.stringify({
        schemaVersion: PROVISIONING_METADATA_SCHEMA_VERSION,
        requestedVersion,
        resolvedVersion: interpreter.version,
        resolvedInterpreter: interpreter.executable,
        fingerprint: provisioningFingerprint,
        provisionedAt: createClockTimestamp(this.clock),
      }, null, 2)}\n`, "utf8");

      this.appendLog(serviceId, "success", `${definition.name} provisioning completed successfully.`);
      return this.updateState(serviceId, {
        detail: `${definition.name} is provisioned and ready to start.`,
        diagnostics: {
          ...this.requireState(serviceId).diagnostics,
          provisioning: {
            ...this.requireState(serviceId).diagnostics.provisioning,
            state: ProvisioningStates.provisioned,
            required: true,
            requestedVersion,
            resolvedVersion: interpreter.version,
            resolvedInterpreter: interpreter.executable,
            environmentPath,
            versionMismatch: false,
            fingerprintMismatch: false,
            needsReprovision: false,
            lastUpdatedAt: createClockTimestamp(this.clock),
            lastError: null,
          },
        },
      });
    } catch (error) {
      this.appendLog(serviceId, "error", `${definition.name} provisioning failed: ${toErrorMessage(error)}`);
      const isCorruptedEnvironment = error?.code === "PYTHON_RUNTIME_PIP_CORRUPTED";
      return this.updateState(serviceId, {
        detail: `${definition.name} provisioning failed: ${toErrorMessage(error)}`,
        diagnostics: {
          ...this.requireState(serviceId).diagnostics,
          provisioning: {
            ...this.requireState(serviceId).diagnostics.provisioning,
            state: isCorruptedEnvironment ? ProvisioningStates.corrupted : ProvisioningStates.provisionFailed,
            required: true,
            requestedVersion,
            environmentPath,
            needsReprovision: true,
            lastUpdatedAt: createClockTimestamp(this.clock),
            lastError: {
              at: createClockTimestamp(this.clock),
              message: toErrorMessage(error),
              code: error?.code ?? null,
              category: isCorruptedEnvironment ? "corrupted-environment" : "provisioning",
              details: toErrorDetails(error),
            },
          },
        },
      });
    }
  }

  buildRuntimeLaunchDefinition(definition, state) {
    if (!isProvisioningRequired(definition)) {
      return definition;
    }

    const venvPython = getVenvPythonPath(definition);
    const resolvedCommand = existsSync(venvPython)
      ? venvPython
      : state?.diagnostics?.provisioning?.resolvedInterpreter || definition.command;

    return {
      ...definition,
      command: resolvedCommand,
    };
  }

  appendLog(serviceId, level, message) {
    const state = this.requireState(serviceId);
    const nextLogs = appendRecentLog(state.recentLogs, createLogEntry(this.clock, level, message), this.logLimit);
    this.updateState(serviceId, {
      recentLogs: nextLogs,
      detail: message,
    });
  }

  listDefinitions() {
    return [...this.definitions.values()].map((definition) => toManagedServiceDefinition(definition));
  }

  getDefinition(serviceId) {
    const definition = this.definitions.get(serviceId);
    return definition ? toManagedServiceDefinition(definition) : undefined;
  }

  async saveDefinition(rawDefinition) {
    const definition = normalizeServiceDefinition(rawDefinition, { securityPolicy: this.securityPolicy });
    const existingService = this.getService(definition.serviceId);

    this.persistedDefinitions.set(definition.serviceId, definition);
    this.persistDefinitions();
    this.rebuildDefinitions();

    const updated = this.requireDefinition(definition.serviceId);
    if (!existingService) {
      this.appendLog(definition.serviceId, "success", `${updated.name} registered for managed supervision.`);
    } else {
      this.appendLog(definition.serviceId, "info", `${updated.name} configuration updated. Restart to apply process changes if needed.`);
    }

    this.emitEvent(this.createSnapshotEvent());
    return toManagedServiceDefinition(updated);
  }

  async deleteDefinition(serviceId) {
    if (this.baseDefinitions.has(serviceId)) {
      this.persistedDefinitions.delete(serviceId);
      this.persistDefinitions();
      this.rebuildDefinitions();
      this.appendLog(serviceId, "info", `${this.requireDefinition(serviceId).name} configuration reset to its built-in defaults.`);
      this.emitEvent(this.createSnapshotEvent());
      return;
    }

    if (!this.definitions.has(serviceId)) {
      throw new Error(`Unknown service '${serviceId}'.`);
    }

    await this.stopInternal(serviceId);
    this.persistedDefinitions.delete(serviceId);
    this.persistDefinitions();
    this.definitions.delete(serviceId);
    this.states.delete(serviceId);
    this.operations.delete(serviceId);
    this.emitEvent(this.createSnapshotEvent());
  }

  async start(serviceId) {
    return this.runLifecycleOperation(serviceId, "start", () => this.startWithDependencies(serviceId));
  }

  async stop(serviceId) {
    return this.runLifecycleOperation(serviceId, "stop", () => this.stopWithDependents(serviceId));
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
      const restartChain = this.getOrderedDependents(serviceId);
      const restartCandidates = [
        serviceId,
        ...restartChain.filter((dependencyId) => {
          const state = this.requireState(dependencyId);
          return state.state !== ServiceStates.stopped || state.ownership === ServiceOwnership.external;
        }),
      ];

      for (const dependentId of [...restartChain].reverse()) {
        await this.stopInternal(dependentId);
      }
      await this.stopInternal(serviceId);
      const restarted = await this.startWithDependencies(serviceId);
      for (const dependentId of restartCandidates.slice(1)) {
        await this.ensureRunning(dependentId);
      }
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
          result?.probe,
        );
      }

      return this.startWithDependencies(serviceId);
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
      result?.probe,
    );
  }

  ensureStartAllowed(serviceId, definition, state) {
    if (definition.invalid) {
      return this.updateState(serviceId, {
        state: ServiceStates.failed,
        detail: `Invalid service configuration: ${definition.invalidReason}`,
        diagnostics: {
          ...state.diagnostics,
          lastError: createDiagnosticError(this.clock, "config", `Invalid service configuration: ${definition.invalidReason}`, {
            serviceId,
          }),
        },
      });
    }

    const failureTimestamps = state.failureTimestamps.filter((timestamp) => this.nowMs() - timestamp <= definition.restartPolicy.failureWindowMs);
    const circuitInfo = { ...state.diagnostics.circuitBreaker };

    if (
      circuitInfo.state === "open"
      && circuitInfo.retryAfter
      && this.nowMs() < new Date(circuitInfo.retryAfter).getTime()
    ) {
      const detail = `${definition.name} restart circuit is open until ${circuitInfo.retryAfter}.`;
      return this.updateState(serviceId, {
        state: ServiceStates.failed,
        detail,
        failureTimestamps,
        diagnostics: {
          ...state.diagnostics,
          circuitBreaker: {
            ...circuitInfo,
            recentFailures: failureTimestamps.length,
          },
          lastError: createDiagnosticError(this.clock, "circuit-breaker", detail, {
            retryAfter: circuitInfo.retryAfter,
            recentFailures: failureTimestamps.length,
          }),
        },
        processHistory: this.pushProcessHistory(state.processHistory, {
          ownership: ServiceOwnership.none,
          outcome: "circuit-open",
          detail,
        }),
      });
    }

    if (circuitInfo.state === "open") {
      return this.updateState(serviceId, {
        diagnostics: {
          ...state.diagnostics,
          circuitBreaker: {
            ...circuitInfo,
            state: "closed",
            openedAt: null,
            retryAfter: null,
            recentFailures: failureTimestamps.length,
          },
        },
        failureTimestamps,
      });
    }

    return undefined;
  }

  getOrderedDependencies(serviceId, visiting = new Set(), ordered = []) {
    if (visiting.has(serviceId)) {
      throw new Error(`Service dependency cycle detected at '${serviceId}'.`);
    }

    const definition = this.requireDefinition(serviceId);
    visiting.add(serviceId);
    for (const dependencyId of definition.dependencies ?? []) {
      if (!this.definitions.has(dependencyId)) {
        throw new Error(`Service '${serviceId}' depends on unknown service '${dependencyId}'.`);
      }
      this.getOrderedDependencies(dependencyId, visiting, ordered);
      if (!ordered.includes(dependencyId)) {
        ordered.push(dependencyId);
      }
    }
    visiting.delete(serviceId);
    return ordered;
  }

  getOrderedDependents(serviceId) {
    const ordered = [];
    const visit = (candidateId) => {
      for (const [dependentId, definition] of this.definitions.entries()) {
        if (!definition.dependencies?.includes(candidateId)) {
          continue;
        }
        if (!ordered.includes(dependentId)) {
          ordered.push(dependentId);
          visit(dependentId);
        }
      }
    };

    visit(serviceId);
    return ordered;
  }

  getDependencyReadiness(serviceId) {
    const definition = this.requireDefinition(serviceId);
    const blockedBy = (definition.dependencies ?? []).filter((dependencyId) => {
      const dependencyState = this.states.get(dependencyId);
      return dependencyState?.state !== ServiceStates.healthy;
    });
    const state = this.requireState(serviceId);
    const isReady = state.state === ServiceStates.healthy && blockedBy.length === 0;
    return {
      isReady,
      blockedBy,
      detail: blockedBy.length > 0
        ? `${definition.name} is waiting on ${blockedBy.join(", ")}.`
        : state.state === ServiceStates.healthy
          ? `${definition.name} is ready.`
          : `${definition.name} is not ready while ${state.state}.`,
    };
  }

  async startWithDependencies(serviceId) {
    for (const dependencyId of this.getOrderedDependencies(serviceId)) {
      const dependencyStatus = await this.startInternal(dependencyId);
      if (dependencyStatus.state !== ServiceStates.healthy) {
        return this.failService(serviceId, this.requireDefinition(serviceId), {
          category: "dependency",
          detail: `${this.requireDefinition(serviceId).name} is blocked by dependency '${dependencyId}'.`,
          error: new Error(`Dependency '${dependencyId}' is not healthy.`),
          outcome: "dependency-blocked",
          ownership: ServiceOwnership.none,
        });
      }
    }

    return this.startInternal(serviceId);
  }

  async stopWithDependents(serviceId) {
    for (const dependentId of [...this.getOrderedDependents(serviceId)].reverse()) {
      await this.stopInternal(dependentId);
    }

    return this.stopInternal(serviceId);
  }

  async startInternal(serviceId) {
    const definition = this.requireDefinition(serviceId);
    const state = this.requireState(serviceId);
    const provisioning = state.diagnostics.provisioning;

    if (provisioning?.required && (provisioning.state !== ProvisioningStates.provisioned || provisioning.needsReprovision)) {
      const detail = provisioning.needsReprovision
        ? provisioning.versionMismatch
          ? `${definition.name} Python version changed from ${provisioning.resolvedVersion ?? "unknown"} to ${provisioning.requestedVersion ?? "unknown"}. Repair or recreate the environment before starting.`
          : `${definition.name} environment inputs changed and reprovisioning is required before starting.`
        : provisioning.state === ProvisioningStates.corrupted
        ? `${definition.name} environment is corrupted. Repair or recreate the environment before starting.`
        : provisioning.state === ProvisioningStates.provisionFailed
        ? `${definition.name} provisioning failed. Repair or recreate the environment before starting.`
        : `${definition.name} must be provisioned before it can start.`;
      return this.updateState(serviceId, {
        state: ServiceStates.stopped,
        ownership: ServiceOwnership.none,
        detail,
        diagnostics: {
          ...state.diagnostics,
          lastError: createDiagnosticError(this.clock, "provisioning", detail, { provisioning }),
        },
      });
    }

    if (state.state === ServiceStates.healthy) {
      return this.recordHealth(serviceId, true, `${definition.name} is already healthy.`);
    }

    const startAllowed = this.ensureStartAllowed(serviceId, definition, state);
    if (startAllowed) {
      return startAllowed;
    }

    const externalStatus = await this.detectExternalService(serviceId, definition, state);
    if (externalStatus) {
      return externalStatus;
    }

    const runtimeDefinition = this.buildRuntimeLaunchDefinition(definition, state);
    const startingLog = createLogEntry(this.clock, "info", `Starting ${definition.name}.`);
    this.updateState(serviceId, {
      state: ServiceStates.starting,
      ownership: ServiceOwnership.managed,
      detail: `Starting ${definition.name}.`,
      recentLogs: this.mergeLogs(state.recentLogs, [startingLog]),
      diagnostics: {
        ...state.diagnostics,
        lastStart: {
          at: createClockTimestamp(this.clock),
          command: runtimeDefinition.command ?? null,
          args: [...runtimeDefinition.args],
          cwd: runtimeDefinition.cwd,
        },
      },
    });

    const runtimeHooks = {
      onLog: (entry) => this.appendRuntimeLog(serviceId, entry),
      onExit: (exitInfo) => this.handleManagedProcessExit(serviceId, exitInfo),
    };

    try {
      const launchResult = await this.runtime.start(runtimeDefinition, this.cloneState(this.requireState(serviceId)), runtimeHooks);
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
        processHistory: this.pushProcessHistory(this.requireState(serviceId).processHistory, {
          pid: launchResult?.pid ?? null,
          startedAt: launchResult?.startedAt ?? createClockTimestamp(this.clock),
          ownership: ServiceOwnership.managed,
          outcome: "started",
          detail: launchResult?.detail ?? `Started ${definition.name}.`,
        }),
      });

      return await this.waitForHealthyStartup(serviceId, definition, () => startupExited ? startupExitInfo : undefined);
    } catch (error) {
      return this.failService(serviceId, definition, {
        category: error?.code === "EACCES" ? "permission" : "start",
        detail: `${definition.name} failed to start: ${toErrorMessage(error)}`,
        error,
        logs: [createLogEntry(this.clock, "error", `Failed to start ${definition.name}.`)],
        outcome: error?.code === "EACCES" ? "permission-denied" : "failed-start",
        ownership: ServiceOwnership.none,
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
        processHistory: this.pushProcessHistory(this.requireState(serviceId).processHistory, {
          startedAt: state.startedAt,
          endedAt: createClockTimestamp(this.clock),
          ownership: ServiceOwnership.managed,
          outcome: "stopped",
          detail: result?.detail ?? `${definition.name} stopped.`,
        }),
      });
    } catch (error) {
      return this.failService(serviceId, definition, {
        category: "stop",
        detail: `${definition.name} failed to stop: ${toErrorMessage(error)}`,
        error,
        logs: [createLogEntry(this.clock, "error", `Failed to stop ${definition.name}.`)],
        outcome: "failed-stop",
        ownership: ServiceOwnership.managed,
      });
    }
  }

  async waitForHealthyStartup(serviceId, definition, getExitInfo) {
    const startedAt = this.nowMs();
    let lastProbe = null;

    while (this.nowMs() - startedAt <= definition.startupTimeoutMs) {
      const current = this.requireState(serviceId);
      const exitInfo = getExitInfo?.();
      if (exitInfo) {
        return this.failService(serviceId, definition, {
          category: "start",
          detail: `${definition.name} exited unexpectedly during startup (code=${exitInfo?.code ?? "null"}, signal=${exitInfo?.signal ?? "null"}).`,
          error: new Error(`${definition.name} exited unexpectedly during startup.`),
          outcome: "failed-start",
          ownership: ServiceOwnership.none,
          exitInfo,
        });
      }

      if (current.state === ServiceStates.failed) {
        return this.cloneState(current);
      }

      const result = await this.runtime.checkHealth?.(definition, this.cloneState(current));
      lastProbe = result?.probe ?? lastProbe;
      if (result?.healthy) {
        return this.updateState(serviceId, {
          state: ServiceStates.healthy,
          detail: result.detail ?? `${definition.name} is healthy.`,
          lastHealthCheckAt: createClockTimestamp(this.clock),
          ownership: current.ownership === ServiceOwnership.external ? ServiceOwnership.external : ServiceOwnership.managed,
          recentLogs: this.mergeLogs(this.requireState(serviceId).recentLogs, result.logs ?? []),
          diagnostics: {
            ...this.requireState(serviceId).diagnostics,
            lastHealthProbe: result.probe ?? this.requireState(serviceId).diagnostics.lastHealthProbe,
            lastError: null,
            circuitBreaker: {
              ...this.requireState(serviceId).diagnostics.circuitBreaker,
              state: "closed",
              openedAt: null,
              retryAfter: null,
              recentFailures: 0,
            },
          },
          failureTimestamps: [],
          processHistory: this.pushProcessHistory(this.requireState(serviceId).processHistory, {
            pid: current.pid,
            startedAt: current.startedAt,
            ownership: current.ownership,
            outcome: "healthy",
            detail: result.detail ?? `${definition.name} is healthy.`,
          }),
        });
      }

      const nextDetail = result?.detail ?? `Waiting for ${definition.name} health check to pass.`;
      const shouldAppendRetryLogs = current.state !== ServiceStates.starting;
      this.updateState(serviceId, {
        state: ServiceStates.starting,
        detail: nextDetail,
        lastHealthCheckAt: createClockTimestamp(this.clock),
        recentLogs: shouldAppendRetryLogs
          ? this.mergeLogs(this.requireState(serviceId).recentLogs, result?.logs ?? [])
          : this.requireState(serviceId).recentLogs,
        diagnostics: {
          ...this.requireState(serviceId).diagnostics,
          lastHealthProbe: result?.probe ?? this.requireState(serviceId).diagnostics.lastHealthProbe,
        },
      });

      await this.sleep(definition.healthPollIntervalMs);
    }

    const timedOut = this.failService(serviceId, definition, {
      category: "start",
      detail: `${definition.name} startup timed out after ${definition.startupTimeoutMs}ms.${lastProbe?.detail ? ` Last probe: ${lastProbe.detail}` : ""}`,
      error: new Error(`${definition.name} startup timed out.`),
      logs: [createLogEntry(this.clock, "error", `${definition.name} startup timed out.`)],
      outcome: "failed-start",
      ownership: ServiceOwnership.managed,
      probe: lastProbe,
    });

    try {
      await this.runtime.stop(
        definition,
        timedOut,
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
      diagnostics: {
        ...state.diagnostics,
        lastHealthProbe: result.probe ?? state.diagnostics.lastHealthProbe,
        lastError: null,
      },
      processHistory: this.pushProcessHistory(state.processHistory, {
        ownership: ServiceOwnership.external,
        outcome: "external-detected",
        detail: result.detail ?? `${definition.name} is already running externally.`,
      }),
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
        diagnostics: {
          ...state.diagnostics,
          lastExit: {
            at: createClockTimestamp(this.clock),
            code: exitInfo?.code ?? null,
            signal: exitInfo?.signal ?? null,
            expected: true,
          },
        },
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

    this.failService(serviceId, this.requireDefinition(serviceId), {
      category: "start",
      detail: `${state.name} exited unexpectedly (code=${exitInfo?.code ?? "null"}, signal=${exitInfo?.signal ?? "null"}).`,
      error: new Error(`${state.name} exited unexpectedly.`),
      outcome: "exited",
      ownership: ServiceOwnership.none,
      exitInfo,
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

  pushProcessHistory(existingHistory, values) {
    return appendRetainedItem(existingHistory, createProcessHistoryEntry(this.clock, values), this.metadataRetentionLimit);
  }

  buildCircuitBreakerState(definition, failureTimestamps, previousCircuitState) {
    const trimmedFailures = failureTimestamps.filter((timestamp) => this.nowMs() - timestamp <= definition.restartPolicy.failureWindowMs);
    const shouldOpen = trimmedFailures.length >= definition.restartPolicy.maxFailures;
    if (!shouldOpen) {
      return {
        state: "closed",
        openedAt: previousCircuitState?.state === "open" ? previousCircuitState.openedAt : null,
        retryAfter: previousCircuitState?.state === "open" ? previousCircuitState.retryAfter : null,
        recentFailures: trimmedFailures.length,
        maxFailures: definition.restartPolicy.maxFailures,
        failureWindowMs: definition.restartPolicy.failureWindowMs,
        cooldownMs: definition.restartPolicy.cooldownMs,
      };
    }

    const openedAt = createClockTimestamp(this.clock);
    const retryAfter = new Date(this.nowMs() + definition.restartPolicy.cooldownMs).toISOString();
    return {
      state: "open",
      openedAt,
      retryAfter,
      recentFailures: trimmedFailures.length,
      maxFailures: definition.restartPolicy.maxFailures,
      failureWindowMs: definition.restartPolicy.failureWindowMs,
      cooldownMs: definition.restartPolicy.cooldownMs,
    };
  }

  failService(serviceId, definition, failure) {
    const state = this.requireState(serviceId);
    const failureTimestamps = [...state.failureTimestamps, this.nowMs()].filter(
      (timestamp) => this.nowMs() - timestamp <= definition.restartPolicy.failureWindowMs,
    );
    const circuitBreaker = this.buildCircuitBreakerState(definition, failureTimestamps, state.diagnostics.circuitBreaker);
    const detail = failure.detail;
    return this.updateState(serviceId, {
      pid: null,
      state: ServiceStates.failed,
      ownership: failure.ownership ?? ServiceOwnership.none,
      detail,
      lastHealthCheckAt: createClockTimestamp(this.clock),
      recentLogs: this.mergeLogs(state.recentLogs, failure.logs ?? []),
      diagnostics: {
        ...state.diagnostics,
        lastError: createDiagnosticError(this.clock, failure.category, detail, {
          ...toErrorDetails(failure.error),
          probe: failure.probe ?? null,
          exitInfo: failure.exitInfo ?? null,
        }),
        lastExit: failure.exitInfo
          ? {
            at: createClockTimestamp(this.clock),
            code: failure.exitInfo.code ?? null,
            signal: failure.exitInfo.signal ?? null,
            expected: false,
          }
          : state.diagnostics.lastExit,
        lastHealthProbe: failure.probe ?? state.diagnostics.lastHealthProbe,
        circuitBreaker,
      },
      failureTimestamps,
      processHistory: this.pushProcessHistory(state.processHistory, {
        pid: state.pid,
        startedAt: state.startedAt,
        endedAt: createClockTimestamp(this.clock),
        ownership: failure.ownership ?? ServiceOwnership.none,
        outcome: failure.outcome,
        exitCode: failure.exitInfo?.code ?? null,
        signal: failure.exitInfo?.signal ?? null,
        detail,
      }),
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

  recordHealth(serviceId, healthy, detail, logs = [], probe = null) {
    const state = this.requireState(serviceId);
    const readiness = this.getDependencyReadiness(serviceId);
    const nextState = healthy
      ? readiness.blockedBy.length === 0 ? ServiceStates.healthy : ServiceStates.unhealthy
      : state.ownership === ServiceOwnership.external || Boolean(state.pid)
        ? ServiceStates.unhealthy
        : ServiceStates.stopped;

    return this.updateState(serviceId, {
      state: nextState,
      detail: healthy && readiness.blockedBy.length > 0 ? readiness.detail : detail,
      lastHealthCheckAt: createClockTimestamp(this.clock),
      recentLogs: this.mergeLogs(state.recentLogs, logs),
      diagnostics: {
        ...state.diagnostics,
        lastHealthProbe: probe ?? state.diagnostics.lastHealthProbe,
        lastError: healthy
          ? null
          : createDiagnosticError(this.clock, "health-probe", detail, {
            probe,
          }),
      },
    });
  }

  updateState(serviceId, patch) {
    const current = this.requireState(serviceId);
    const next = {
      ...current,
      ...patch,
      diagnostics: patch.diagnostics ?? current.diagnostics,
      processHistory: patch.processHistory ?? current.processHistory,
      failureTimestamps: patch.failureTimestamps ?? current.failureTimestamps,
    };
    this.states.set(serviceId, next);
    const clonedNext = this.toSummary(serviceId);
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
    const service = this.cloneState(this.requireState(serviceId));
    const definition = this.requireDefinition(serviceId);
    const readiness = this.getDependencyReadiness(serviceId);
    return {
      serviceId: service.serviceId,
      name: service.name,
      command: service.command,
      args: service.args,
      dependencies: [...(definition.dependencies ?? [])],
      dependents: this.getOrderedDependents(serviceId).filter((dependentId, index, entries) => entries.indexOf(dependentId) === index),
      cwd: service.cwd,
      baseUrl: service.baseUrl,
      pid: service.pid,
      startedAt: service.startedAt,
      lastHealthCheckAt: service.lastHealthCheckAt,
      state: service.state,
      ownership: service.ownership,
      detail: service.detail,
      readiness,
      metadata: service.metadata,
      diagnostics: service.diagnostics,
      processHistory: service.processHistory,
      recentLogs: service.recentLogs,
    };
  }

  cloneState(state) {
    return JSON.parse(JSON.stringify({
      ...state,
      args: [...state.args],
      recentLogs: state.recentLogs.map((entry) => ({ ...entry })),
      processHistory: state.processHistory.map((entry) => ({ ...entry })),
      metadata: { ...state.metadata },
      diagnostics: {
        ...state.diagnostics,
        lastError: state.diagnostics.lastError ? { ...state.diagnostics.lastError } : null,
        lastExit: state.diagnostics.lastExit ? { ...state.diagnostics.lastExit } : null,
        lastStart: state.diagnostics.lastStart ? { ...state.diagnostics.lastStart, args: [...state.diagnostics.lastStart.args] } : null,
        lastHealthProbe: state.diagnostics.lastHealthProbe ? { ...state.diagnostics.lastHealthProbe } : null,
        provisioning: state.diagnostics.provisioning
          ? {
            ...state.diagnostics.provisioning,
            lastError: state.diagnostics.provisioning.lastError ? { ...state.diagnostics.provisioning.lastError } : null,
          }
          : null,
        circuitBreaker: { ...state.diagnostics.circuitBreaker },
      },
    }));
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

function extractBearerToken(req) {
  const authorization = req.headers.authorization;
  if (typeof authorization === "string") {
    const [scheme, token] = authorization.split(/\s+/, 2);
    if (scheme?.toLowerCase() === "bearer" && token) {
      return token.trim();
    }
  }

  const alternate = req.headers["x-supervisor-token"];
  if (typeof alternate === "string" && alternate.trim()) {
    return alternate.trim();
  }

  return undefined;
}

function authorizeControlRequest(req, expectedToken) {
  if (!expectedToken) {
    return { ok: true };
  }

  const providedToken = extractBearerToken(req);
  if (providedToken === expectedToken) {
    return { ok: true };
  }

  return {
    ok: false,
    payload: {
      ok: false,
      message: "Supervisor control token is required for lifecycle operations.",
      requiredHeaders: CONTROL_HEADER_NAMES,
    },
    headers: {
      "WWW-Authenticate": 'Bearer realm="service-supervisor"',
    },
  };
}

export function createSupervisorServer(options = {}) {
  const supervisor = options.supervisor ?? new InMemoryServiceSupervisor({
    services: options.services ?? loadServiceDefinitionsFromEnvironment(),
    runtime: options.runtime,
    clock: options.clock,
    logLimit: options.logLimit,
    sleep: options.sleep,
    metadataRetentionLimit: options.metadataRetentionLimit,
    allowedExecutables: options.allowedExecutables,
    allowedPaths: options.allowedPaths,
    definitionsPath: options.definitionsPath ?? process.env.SERVICE_SUPERVISOR_DEFINITIONS_PATH,
    controlToken: options.controlToken,
  });
  const host = options.host ?? DEFAULT_HOST;
  const port = Number(options.port ?? DEFAULT_PORT);
  const controlToken = typeof options.controlToken === "string" && options.controlToken.trim()
    ? options.controlToken.trim()
    : DEFAULT_CONTROL_TOKEN;

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

      if (pathname === "/service-definitions" && req.method === "GET") {
        sendJson(res, 200, {
          ok: true,
          definitions: supervisor.listDefinitions(),
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

      const routeMatch = pathname.match(/^\/services\/([^/]+?)(?:\/(start|stop|restart|ensure-running|provision|repair|recreate-environment))?$/);
      const definitionRouteMatch = pathname.match(/^\/service-definitions\/([^/]+?)$/);

      if (definitionRouteMatch) {
        const [, rawServiceId] = definitionRouteMatch;
        const serviceId = decodeURIComponent(rawServiceId);

        if (req.method === "GET") {
          const definition = supervisor.getDefinition(serviceId);
          if (!definition) {
            sendJson(res, 404, { ok: false, message: `Unknown service definition '${serviceId}'.` });
            return;
          }

          sendJson(res, 200, { ok: true, definition });
          return;
        }

        const authorization = authorizeControlRequest(req, controlToken);
        if (!authorization.ok) {
          sendJson(res, 401, authorization.payload, authorization.headers);
          return;
        }

        if (req.method === "PUT") {
          const body = await parseRequestBody(req);
          const definition = await supervisor.saveDefinition({
            ...body,
            serviceId,
          });
          sendJson(res, 200, { ok: true, definition });
          return;
        }

        if (req.method === "DELETE") {
          await supervisor.deleteDefinition(serviceId);
          sendJson(res, 200, { ok: true });
          return;
        }

        sendJson(res, 405, { ok: false, message: "Method not allowed." });
        return;
      }

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
        const authorization = authorizeControlRequest(req, controlToken);
        if (!authorization.ok) {
          sendJson(res, 401, authorization.payload, authorization.headers);
          return;
        }

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
        } else if (action === "provision") {
          service = await supervisor.provision(serviceId);
        } else if (action === "repair") {
          service = await supervisor.repair(serviceId);
        } else if (action === "recreate-environment") {
          service = await supervisor.recreateEnvironment(serviceId);
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

function parsePythonRuntimeArgsFromEnvironment(baseUrl) {
  if (process.env.PYTHON_RUNTIME_ARGS_JSON?.trim()) {
    const parsed = JSON.parse(process.env.PYTHON_RUNTIME_ARGS_JSON);
    return validateServiceArguments(parsed);
  }

  if (process.env.PYTHON_RUNTIME_ARGS?.trim()) {
    return validateServiceArguments(process.env.PYTHON_RUNTIME_ARGS.split(/\s+/).filter(Boolean));
  }

  const launchTarget = resolveLaunchTarget(baseUrl);
  return [
    "-m",
    "uvicorn",
    process.env.PYTHON_RUNTIME_ENTRYPOINT || DEFAULT_PYTHON_RUNTIME_ENTRYPOINT,
    "--host",
    launchTarget.host,
    "--port",
    String(launchTarget.port),
  ];
}

export function loadServiceDefinitionsFromEnvironment() {
  const rawDefinitions = process.env.SERVICE_SUPERVISOR_SERVICES;

  if (!rawDefinitions) {
    const baseUrl = process.env.PYTHON_RUNTIME_BASE_URL || DEFAULT_PYTHON_RUNTIME_BASE_URL;
    return [
      {
        serviceId: "python-runtime",
        name: "Python runtime",
        baseUrl,
        command: process.env.PYTHON_RUNTIME_EXECUTABLE || DEFAULT_PYTHON_RUNTIME_EXECUTABLE,
        args: parsePythonRuntimeArgsFromEnvironment(baseUrl),
        cwd: process.env.PYTHON_RUNTIME_WORKDIR || DEFAULT_PYTHON_RUNTIME_WORKDIR,
        env: parseJsonObject(process.env.PYTHON_RUNTIME_ENV_JSON),
        healthCheckPath: process.env.PYTHON_RUNTIME_HEALTH_PATH || DEFAULT_PYTHON_RUNTIME_HEALTH_PATH,
        startupTimeoutMs: normalizePositiveNumber(process.env.PYTHON_RUNTIME_STARTUP_TIMEOUT_MS, DEFAULT_STARTUP_TIMEOUT_MS),
        healthPollIntervalMs: normalizePositiveNumber(process.env.PYTHON_RUNTIME_HEALTH_POLL_INTERVAL_MS, DEFAULT_HEALTH_POLL_INTERVAL_MS),
        stopTimeoutMs: normalizePositiveNumber(process.env.SERVICE_SUPERVISOR_STOP_TIMEOUT_MS, DEFAULT_STOP_TIMEOUT_MS),
        pythonVersion: process.env.PYTHON_RUNTIME_PYTHON_VERSION || DEFAULT_PYTHON_RUNTIME_VERSION,
        pythonInterpreterPath: process.env.PYTHON_RUNTIME_INTERPRETER_PATH || undefined,
        metadata: {
          source: "builtin",
          kind: "python-runtime",
          transport: "hybrid",
          autoStartPolicy: "on-demand",
          restartPolicyName: "on-failure",
          capabilities: ["workflow-execution", "mcp-runtime"],
          tags: ["builtin", "python"],
          description: "Built-in Python runtime managed by the local service supervisor.",
        },
        version: process.env.PYTHON_RUNTIME_VERSION || "dev",
        compatibility: parseJsonObject(process.env.PYTHON_RUNTIME_COMPATIBILITY_JSON, { supervisorApiVersion: 1 }),
      },
    ];
  }

  const parsed = JSON.parse(rawDefinitions);
  if (!Array.isArray(parsed)) {
    throw new Error("SERVICE_SUPERVISOR_SERVICES must be a JSON array.");
  }

  return parsed;
}

function parseJsonObject(rawValue, fallback = {}) {
  if (!rawValue?.trim()) {
    return { ...fallback };
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
  const app = createSupervisorServer({
    runtime,
    definitionsPath: process.env.SERVICE_SUPERVISOR_DEFINITIONS_PATH ?? DEFAULT_DEFINITIONS_PATH,
  });
  await app.listen();
  console.log(`[service-supervisor] listening on http://${app.host}:${app.port}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("[service-supervisor] failed to start", error);
    process.exitCode = 1;
  });
}
