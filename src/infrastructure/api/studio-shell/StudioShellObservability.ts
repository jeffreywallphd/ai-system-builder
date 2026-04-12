import type { StudioShellApiResponse } from "./StudioShellBackendApi";

export const StudioShellObservabilityActions = Object.freeze({
  ingestReferenceImageUpload: "ingest-reference-image-upload",
  persistReferenceImageOutputs: "persist-reference-image-outputs",
});

export type StudioShellObservabilityAction =
  typeof StudioShellObservabilityActions[keyof typeof StudioShellObservabilityActions];

export interface StudioShellObservabilityEvent {
  readonly event: string;
  readonly action: StudioShellObservabilityAction;
  readonly outcome: "success" | "rejected" | "failure";
  readonly severity: "info" | "warn" | "error";
  readonly occurredAt: string;
  readonly studioId?: string;
  readonly draftId?: string;
  readonly executionId?: string;
  readonly datasetBindingId?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export interface StudioShellObservabilityLogger {
  info(event: StudioShellObservabilityEvent): void;
  warn(event: StudioShellObservabilityEvent): void;
  error(event: StudioShellObservabilityEvent): void;
}

export class StudioShellObservability {
  private readonly logger: StudioShellObservabilityLogger;

  public constructor(logger?: StudioShellObservabilityLogger) {
    this.logger = logger ?? new ConsoleStudioShellObservabilityLogger();
  }

  public recordApiOutcome(input: {
    readonly action: StudioShellObservabilityAction;
    readonly response: StudioShellApiResponse<unknown>;
    readonly request: {
      readonly studioId?: string;
      readonly draftId?: string;
      readonly executionId?: string;
      readonly datasetBindingId?: string;
    };
    readonly occurredAt?: string;
  }): void {
    try {
      const outcome = resolveOutcome(input.response);
      const event: StudioShellObservabilityEvent = Object.freeze({
        event: `studio-shell.${input.action}.completed`,
        action: input.action,
        outcome: outcome.outcome,
        severity: outcome.severity,
        occurredAt: input.occurredAt ?? new Date().toISOString(),
        studioId: normalizeOptional(input.request.studioId),
        draftId: normalizeOptional(input.request.draftId),
        executionId: normalizeOptional(input.request.executionId),
        datasetBindingId: normalizeOptional(input.request.datasetBindingId),
        errorCode: input.response.ok ? undefined : input.response.error?.code,
        errorMessage: input.response.ok ? undefined : normalizeOptional(input.response.error?.message),
      });
      if (event.severity === "error") {
        this.logger.error(event);
      } else if (event.severity === "warn") {
        this.logger.warn(event);
      } else {
        this.logger.info(event);
      }
    } catch {
      // Observability is best-effort and must not block studio-shell operations.
    }
  }
}

function resolveOutcome(response: StudioShellApiResponse<unknown>): {
  readonly outcome: "success" | "rejected" | "failure";
  readonly severity: "info" | "warn" | "error";
} {
  if (response.ok) {
    return Object.freeze({ outcome: "success", severity: "info" });
  }
  if (response.error?.code === "internal") {
    return Object.freeze({ outcome: "failure", severity: "error" });
  }
  return Object.freeze({ outcome: "rejected", severity: "warn" });
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

class ConsoleStudioShellObservabilityLogger implements StudioShellObservabilityLogger {
  public info(event: StudioShellObservabilityEvent): void {
    console.info(JSON.stringify(event));
  }

  public warn(event: StudioShellObservabilityEvent): void {
    console.warn(JSON.stringify(event));
  }

  public error(event: StudioShellObservabilityEvent): void {
    console.error(JSON.stringify(event));
  }
}
