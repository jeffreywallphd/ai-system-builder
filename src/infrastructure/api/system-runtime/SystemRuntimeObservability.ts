import type { SystemRuntimeApiResponse } from "./SystemRuntimeBackendApi";

export interface SystemRuntimeObservabilityEvent {
  readonly event: string;
  readonly action: "start-execution" | "start-execution-async";
  readonly outcome: "success" | "rejected" | "failure";
  readonly severity: "info" | "warn" | "error";
  readonly occurredAt: string;
  readonly executionId?: string;
  readonly studioId?: string;
  readonly draftId?: string;
  readonly versionId?: string;
  readonly systemId?: string;
  readonly tenantId?: string;
  readonly callerId?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export interface SystemRuntimeObservabilityLogger {
  info(event: SystemRuntimeObservabilityEvent): void;
  warn(event: SystemRuntimeObservabilityEvent): void;
  error(event: SystemRuntimeObservabilityEvent): void;
}

export class SystemRuntimeObservability {
  private readonly logger: SystemRuntimeObservabilityLogger;

  public constructor(logger?: SystemRuntimeObservabilityLogger) {
    this.logger = logger ?? new ConsoleSystemRuntimeObservabilityLogger();
  }

  public recordApiOutcome(input: {
    readonly action: SystemRuntimeObservabilityEvent["action"];
    readonly response: SystemRuntimeApiResponse<{ readonly executionId?: string }>;
    readonly request: {
      readonly studioId?: string;
      readonly draftId?: string;
      readonly versionId?: string;
      readonly systemId?: string;
      readonly tenantId?: string;
      readonly callerId?: string;
    };
    readonly occurredAt?: string;
  }): void {
    try {
      const outcome = resolveOutcome(input.response);
      const event: SystemRuntimeObservabilityEvent = Object.freeze({
        event: `system-runtime.${input.action}.completed`,
        action: input.action,
        outcome: outcome.outcome,
        severity: outcome.severity,
        occurredAt: input.occurredAt ?? new Date().toISOString(),
        executionId: input.response.ok ? input.response.data?.executionId : undefined,
        studioId: normalizeOptional(input.request.studioId),
        draftId: normalizeOptional(input.request.draftId),
        versionId: normalizeOptional(input.request.versionId),
        systemId: normalizeOptional(input.request.systemId),
        tenantId: normalizeOptional(input.request.tenantId),
        callerId: normalizeOptional(input.request.callerId),
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
      // Observability is best-effort and must never block runtime execution flows.
    }
  }
}

function resolveOutcome(response: SystemRuntimeApiResponse<unknown>): {
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

class ConsoleSystemRuntimeObservabilityLogger implements SystemRuntimeObservabilityLogger {
  public info(event: SystemRuntimeObservabilityEvent): void {
    console.info(JSON.stringify(event));
  }

  public warn(event: SystemRuntimeObservabilityEvent): void {
    console.warn(JSON.stringify(event));
  }

  public error(event: SystemRuntimeObservabilityEvent): void {
    console.error(JSON.stringify(event));
  }
}
