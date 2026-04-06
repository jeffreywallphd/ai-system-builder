import type { SecretScope } from "../../../domain/security/SecretDomain";
import { redactSecretMaterial } from "../../../shared/security/SecretRedaction";

export const SecretOperationalOutcomes = Object.freeze({
  succeeded: "succeeded",
  denied: "denied",
  rejected: "rejected",
  failed: "failed",
  conflict: "conflict",
  missing: "missing",
});

export type SecretOperationalOutcome = typeof SecretOperationalOutcomes[keyof typeof SecretOperationalOutcomes];

export interface SecretOperationalLogEvent {
  readonly event: string;
  readonly outcome: SecretOperationalOutcome;
  readonly occurredAt: string;
  readonly actorId?: string;
  readonly secretId?: string;
  readonly scope?: SecretScope;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ISecretOperationalLogger {
  info(event: SecretOperationalLogEvent): void;
  warn(event: SecretOperationalLogEvent): void;
  error(event: SecretOperationalLogEvent): void;
}

export interface ISecretObservabilityPort {
  recordSecretOperation(event: SecretOperationalLogEvent): Promise<void>;
}

export function sanitizeSecretOperationalEvent(event: SecretOperationalLogEvent): SecretOperationalLogEvent {
  return Object.freeze({
    event: event.event.trim(),
    outcome: event.outcome,
    occurredAt: event.occurredAt,
    actorId: normalizeOptional(event.actorId),
    secretId: normalizeOptional(event.secretId),
    scope: event.scope,
    workspaceId: normalizeOptional(event.workspaceId),
    userIdentityId: normalizeOptional(event.userIdentityId),
    details: event.details
      ? redactSecretMaterial(event.details as Record<string, unknown>) as Readonly<Record<string, unknown>>
      : undefined,
  });
}

export class NoOpSecretObservabilityPort implements ISecretObservabilityPort {
  public async recordSecretOperation(_event: SecretOperationalLogEvent): Promise<void> {
    // no-op by design
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
