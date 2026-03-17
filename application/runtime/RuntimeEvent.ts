export const RuntimeEventSources = {
  app: "app",
  pythonRuntime: "python-runtime",
  workflowExecution: "workflow-execution",
  comfyui: "comfyui",
  models: "models",
} as const;

export type RuntimeEventSource =
  (typeof RuntimeEventSources)[keyof typeof RuntimeEventSources];

export const RuntimeEventSeverities = {
  debug: "debug",
  info: "info",
  warning: "warning",
  error: "error",
  success: "success",
} as const;

export type RuntimeEventSeverity =
  (typeof RuntimeEventSeverities)[keyof typeof RuntimeEventSeverities];

export interface RuntimeEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly source: RuntimeEventSource;
  readonly severity: RuntimeEventSeverity;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface RuntimeEventCreateParams {
  readonly source: RuntimeEventSource;
  readonly severity: RuntimeEventSeverity;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly id?: string;
  readonly timestamp?: string;
}

export function createRuntimeEvent(params: RuntimeEventCreateParams): RuntimeEvent {
  const message = params.message.trim();

  if (!message) {
    throw new Error("Runtime event message cannot be empty.");
  }

  return Object.freeze({
    id: params.id?.trim() || createRuntimeEventId(),
    timestamp: params.timestamp ?? new Date().toISOString(),
    source: params.source,
    severity: params.severity,
    message,
    details: params.details ? Object.freeze({ ...params.details }) : undefined,
  });
}

function createRuntimeEventId(): string {
  return `runtime-event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
