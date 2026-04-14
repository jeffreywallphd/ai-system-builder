import type { AuthorizationDiagnosticRecord } from "@shared/contracts/authorization/AuthorizationDiagnosticsContracts";

export interface AuthorizationLoggedEvent {
  readonly event: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

interface AuthorizationDiagnosticEnvelope {
  readonly diagnostic?: AuthorizationDiagnosticRecord;
  readonly diagnosticCorrelationId?: string;
}

export function requireAuthorizationDiagnosticEvent(
  events: ReadonlyArray<AuthorizationLoggedEvent>,
  eventName: string,
): AuthorizationDiagnosticRecord {
  const event = events.find((entry) => entry.event === eventName);
  if (!event) {
    throw new Error(`Expected diagnostic event '${eventName}' to be emitted.`);
  }

  const envelope = event.details as AuthorizationDiagnosticEnvelope | undefined;
  if (!envelope?.diagnostic) {
    throw new Error(`Expected diagnostic payload on event '${eventName}'.`);
  }
  return envelope.diagnostic;
}

export function extractAuthorizationDiagnosticCorrelationId(
  diagnostic: AuthorizationDiagnosticRecord,
): string | undefined {
  return diagnostic.correlation.correlationId
    ?? diagnostic.correlation.requestId;
}
