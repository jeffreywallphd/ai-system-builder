import type {
  PythonRuntimeCapabilitiesResult,
  PythonRuntimeError,
  PythonRuntimeHealthCheckResult,
  PythonRuntimeHealthStatus,
  PythonRuntimeTaskRequest,
  PythonRuntimeTaskResult,
} from "../../../../contracts/runtime";

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid python runtime ${label}: expected object payload.`);
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid python runtime payload: ${field} must be a non-empty string.`);
  }

  return value;
}

function asOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return asString(value, field);
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid python runtime payload: ${field} must be a boolean.`);
  }

  return value;
}

function asOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return asBoolean(value, field);
}

function asOptionalRecord(value: unknown, field: string): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return asObject(value, field);
}

function parseRuntimeError(value: unknown, field: string): PythonRuntimeError | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const payload = asObject(value, field);
  return {
    code: asString(payload.code, `${field}.code`),
    message: asString(payload.message, `${field}.message`),
    details: asOptionalRecord(payload.details, `${field}.details`),
    retryable: asOptionalBoolean(payload.retryable, `${field}.retryable`),
  };
}

function parseHealthStatus(value: unknown): PythonRuntimeHealthStatus {
  const payload = asObject(value, "health status");
  return {
    runtimeId: asString(payload.runtimeId, "status.runtimeId"),
    status: asString(payload.status, "status.status"),
    version: asOptionalString(payload.version, "status.version"),
    pythonVersion: asOptionalString(payload.pythonVersion, "status.pythonVersion"),
    workerStartedAt: asOptionalString(payload.workerStartedAt, "status.workerStartedAt"),
    lastHeartbeatAt: asOptionalString(payload.lastHeartbeatAt, "status.lastHeartbeatAt"),
  };
}

function parseCapabilities(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid python runtime capabilities: capabilities must be an array.");
  }

  return value.map((entry, index) => asString(entry, `capabilities[${index}]`));
}

export function mapTaskRequestToHttpPayload(
  request: PythonRuntimeTaskRequest,
): PythonRuntimeTaskRequest {
  return {
    requestId: asString(request.requestId, "request.requestId"),
    taskType: asString(request.taskType, "request.taskType"),
    payload: request.payload,
    timeoutMs: request.timeoutMs,
    metadata: request.metadata,
  };
}

export function mapHealthResponseFromHttpPayload(
  payload: unknown,
): PythonRuntimeHealthCheckResult {
  const response = asObject(payload, "health response");
  return {
    healthy: asBoolean(response.healthy, "healthy"),
    status: parseHealthStatus(response.status),
    error: parseRuntimeError(response.error, "error"),
    message: asOptionalString(response.message, "message"),
  };
}

export function mapCapabilitiesResponseFromHttpPayload(
  payload: unknown,
): PythonRuntimeCapabilitiesResult {
  const response = asObject(payload, "capabilities response");
  return {
    runtimeId: asString(response.runtimeId, "runtimeId"),
    capabilities: parseCapabilities(response.capabilities),
  };
}

export function mapTaskResponseFromHttpPayload(
  payload: unknown,
): PythonRuntimeTaskResult {
  const response = asObject(payload, "task response");

  return {
    requestId: asString(response.requestId, "requestId"),
    taskType: asString(response.taskType, "taskType"),
    success: asBoolean(response.success, "success"),
    data: response.data,
    error: parseRuntimeError(response.error, "error"),
    metadata: asOptionalRecord(response.metadata, "metadata"),
  };
}
