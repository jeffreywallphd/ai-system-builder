import type { IdentityAuthApiResponse } from "./sdk/PublicIdentityAuthApiContract";

export interface IdentityAuthObservabilityLogEvent {
  readonly event: string;
  readonly flow: "local-register" | "local-login" | "local-logout" | "session-revoke";
  readonly outcome: "success" | "failure";
  readonly statusCode?: number;
  readonly requestId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IdentityAuthObservabilityLogger {
  info(event: IdentityAuthObservabilityLogEvent): void;
  warn(event: IdentityAuthObservabilityLogEvent): void;
  error(event: IdentityAuthObservabilityLogEvent): void;
}

export interface IdentityAuthAuditEvent {
  readonly type:
    | "identity-auth.local.register"
    | "identity-auth.local.login"
    | "identity-auth.local.logout"
    | "identity-auth.session.revoke";
  readonly outcome: "success" | "failure";
  readonly occurredAt: string;
  readonly requestId?: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface IdentityAuthAuditEventSink {
  emit(event: IdentityAuthAuditEvent): Promise<void> | void;
}

export interface IdentityAuthObservabilityOptions {
  readonly logger?: IdentityAuthObservabilityLogger;
  readonly auditEventSink?: IdentityAuthAuditEventSink;
}

interface RecordApiOutcomeInput {
  readonly flow: "local-register" | "local-login" | "local-logout" | "session-revoke";
  readonly request: Record<string, unknown>;
  readonly response: IdentityAuthApiResponse<unknown>;
  readonly statusCode?: number;
  readonly requestId?: string;
  readonly errorCode?: string;
}

const SENSITIVE_FIELD_KEYS = new Set([
  "authorization",
  "bearertoken",
  "candidate",
  "credential",
  "email",
  "hashvalue",
  "password",
  "pepperversion",
  "providersubject",
  "salt",
  "secret",
  "token",
  "trustmarker",
  "trusteddevicebindingid",
  "username",
]);

export class IdentityAuthObservability {
  private readonly logger: IdentityAuthObservabilityLogger;
  private readonly auditEventSink?: IdentityAuthAuditEventSink;

  public constructor(options: IdentityAuthObservabilityOptions = {}) {
    this.logger = options.logger ?? new ConsoleIdentityAuthObservabilityLogger();
    this.auditEventSink = options.auditEventSink;
  }

  public async recordApiOutcome(input: RecordApiOutcomeInput): Promise<void> {
    const logEvent = Object.freeze({
      event: `identity-auth.${input.flow}.completed`,
      flow: input.flow,
      outcome: input.response.ok ? "success" : "failure",
      statusCode: input.statusCode,
      requestId: input.requestId,
      details: Object.freeze({
        request: redactSensitiveAuthPayload(input.request),
        response: redactSensitiveAuthPayload(input.response),
        errorCode: input.errorCode,
      }),
    });

    if (input.response.ok) {
      this.logger.info(logEvent);
    } else if (input.statusCode && input.statusCode >= 500) {
      this.logger.error(logEvent);
    } else {
      this.logger.warn(logEvent);
    }

    if (!this.auditEventSink) {
      return;
    }

    const auditEvent: IdentityAuthAuditEvent = Object.freeze({
      type: toAuditType(input.flow),
      outcome: input.response.ok ? "success" : "failure",
      occurredAt: new Date().toISOString(),
      requestId: input.requestId,
      details: Object.freeze({
        statusCode: input.statusCode,
        errorCode: input.errorCode,
        request: redactSensitiveAuthPayload(input.request) as Readonly<Record<string, unknown>>,
        response: redactSensitiveAuthPayload(input.response) as Readonly<Record<string, unknown>>,
      }),
    });

    try {
      await this.auditEventSink.emit(auditEvent);
    } catch (error) {
      this.logger.error(Object.freeze({
        event: "identity-auth.audit-sink.emit-failed",
        flow: input.flow,
        outcome: "failure",
        requestId: input.requestId,
        details: Object.freeze({
          error: normalizeError(error),
        }),
      }));
    }
  }
}

function toAuditType(flow: RecordApiOutcomeInput["flow"]): IdentityAuthAuditEvent["type"] {
  switch (flow) {
    case "local-register":
      return "identity-auth.local.register";
    case "local-login":
      return "identity-auth.local.login";
    case "local-logout":
      return "identity-auth.local.logout";
    case "session-revoke":
      return "identity-auth.session.revoke";
    default:
      return "identity-auth.local.login";
  }
}

export function redactSensitiveAuthPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => redactSensitiveAuthPayload(entry)));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (SENSITIVE_FIELD_KEYS.has(key.toLowerCase())) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = redactSensitiveAuthPayload(nestedValue);
  }

  return Object.freeze(output);
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

class ConsoleIdentityAuthObservabilityLogger implements IdentityAuthObservabilityLogger {
  public info(event: IdentityAuthObservabilityLogEvent): void {
    console.info(JSON.stringify(event));
  }

  public warn(event: IdentityAuthObservabilityLogEvent): void {
    console.warn(JSON.stringify(event));
  }

  public error(event: IdentityAuthObservabilityLogEvent): void {
    console.error(JSON.stringify(event));
  }
}
