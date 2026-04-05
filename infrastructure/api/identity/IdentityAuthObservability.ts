import type { IdentityAuthApiResponse } from "./sdk/PublicIdentityAuthApiContract";
import { redactSensitiveAuthPayload, redactSensitiveText } from "./IdentityAuthRedaction";

export interface IdentityAuthObservabilityLogEvent {
  readonly event: string;
  readonly flow:
    | "local-register"
    | "local-login"
    | "local-credential-change"
    | "local-logout"
    | "session-revoke"
    | "admin-accounts-list"
    | "admin-account-get"
    | "admin-account-status-set"
    | "trusted-device.list"
    | "trusted-device.get"
    | "trusted-device.revoke"
    | "trusted-device.display-name.update"
    | "trusted-device.pairing.initiate"
    | "trusted-device.pairing.validate"
    | "trusted-device.pairing.complete"
    | "admin-trusted-device.list"
    | "admin-trusted-device.revoke";
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
    | "identity-auth.local.credential.change"
    | "identity-auth.local.logout"
    | "identity-auth.session.revoke"
    | "identity-auth.admin.accounts.list"
    | "identity-auth.admin.account.get"
    | "identity-auth.admin.account.status.set"
    | "identity-auth.trusted-device.list"
    | "identity-auth.trusted-device.get"
    | "identity-auth.trusted-device.revoke"
    | "identity-auth.trusted-device.display-name.update"
    | "identity-auth.trusted-device.pairing.initiate"
    | "identity-auth.trusted-device.pairing.validate"
    | "identity-auth.trusted-device.pairing.complete"
    | "identity-auth.admin.trusted-device.list"
    | "identity-auth.admin.trusted-device.revoke";
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
  readonly flow:
    | "local-register"
    | "local-login"
    | "local-credential-change"
    | "local-logout"
    | "session-revoke"
    | "admin-accounts-list"
    | "admin-account-get"
    | "admin-account-status-set"
    | "trusted-device.list"
    | "trusted-device.get"
    | "trusted-device.revoke"
    | "trusted-device.display-name.update"
    | "trusted-device.pairing.initiate"
    | "trusted-device.pairing.validate"
    | "trusted-device.pairing.complete"
    | "admin-trusted-device.list"
    | "admin-trusted-device.revoke";
  readonly request: Record<string, unknown>;
  readonly response: IdentityAuthApiResponse<unknown>;
  readonly statusCode?: number;
  readonly requestId?: string;
  readonly errorCode?: string;
}

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
    case "local-credential-change":
      return "identity-auth.local.credential.change";
    case "local-logout":
      return "identity-auth.local.logout";
    case "session-revoke":
      return "identity-auth.session.revoke";
    case "admin-accounts-list":
      return "identity-auth.admin.accounts.list";
    case "admin-account-get":
      return "identity-auth.admin.account.get";
    case "admin-account-status-set":
      return "identity-auth.admin.account.status.set";
    case "trusted-device.list":
      return "identity-auth.trusted-device.list";
    case "trusted-device.get":
      return "identity-auth.trusted-device.get";
    case "trusted-device.revoke":
      return "identity-auth.trusted-device.revoke";
    case "trusted-device.display-name.update":
      return "identity-auth.trusted-device.display-name.update";
    case "trusted-device.pairing.initiate":
      return "identity-auth.trusted-device.pairing.initiate";
    case "trusted-device.pairing.validate":
      return "identity-auth.trusted-device.pairing.validate";
    case "trusted-device.pairing.complete":
      return "identity-auth.trusted-device.pairing.complete";
    case "admin-trusted-device.list":
      return "identity-auth.admin.trusted-device.list";
    case "admin-trusted-device.revoke":
      return "identity-auth.admin.trusted-device.revoke";
    default:
      return "identity-auth.local.login";
  }
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return redactSensitiveText(error.message);
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
