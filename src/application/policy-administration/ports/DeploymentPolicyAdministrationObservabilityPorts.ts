import type { DeploymentPolicyPersistenceScope } from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";

export const DeploymentPolicyAdministrationObservabilityOperations = Object.freeze({
  bootstrap: "bootstrap",
  read: "read",
  write: "write",
  adminSurface: "admin-surface",
} as const);

export type DeploymentPolicyAdministrationObservabilityOperation =
  typeof DeploymentPolicyAdministrationObservabilityOperations[keyof typeof DeploymentPolicyAdministrationObservabilityOperations];

export const DeploymentPolicyAdministrationObservabilityOutcomes = Object.freeze({
  success: "success",
  rejected: "rejected",
  failure: "failure",
} as const);

export type DeploymentPolicyAdministrationObservabilityOutcome =
  typeof DeploymentPolicyAdministrationObservabilityOutcomes[keyof typeof DeploymentPolicyAdministrationObservabilityOutcomes];

export interface DeploymentPolicyAdministrationObservabilityEvent {
  readonly event: string;
  readonly operation: DeploymentPolicyAdministrationObservabilityOperation;
  readonly outcome: DeploymentPolicyAdministrationObservabilityOutcome;
  readonly severity: "info" | "warn" | "error";
  readonly occurredAt: string;
  readonly scope?: DeploymentPolicyPersistenceScope;
  readonly actorUserIdentityId?: string;
  readonly profileId?: string;
  readonly correlationId?: string;
  readonly operationKey?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly counters?: Readonly<Record<string, number>>;
}

export interface IDeploymentPolicyAdministrationObservabilityPort {
  recordDeploymentPolicyAdministrationEvent(event: DeploymentPolicyAdministrationObservabilityEvent): Promise<void>;
}

const SensitiveDetailKeyPattern =
  /(value|payload|secret|token|credential|password|prompt|content|body|bytes|raw|path|file|directory|uri|url|internal|detail|diagnostic)/i;
const SensitiveStringPattern =
  /(Bearer\s+[A-Za-z0-9\-._~+/]+=*|api[-_]?key|access[-_]?token|\btoken\s+[A-Za-z0-9\-._~+/]{3,}\b|[a-zA-Z]:\\|\/(?:Users|home|var|tmp|etc)\/)/i;
const RedactedValue = "[REDACTED]";
const MaxObservedStringLength = 256;
const MaxObservedArrayLength = 32;
const MaxObservedObjectEntries = 32;

export async function publishDeploymentPolicyAdministrationObservabilityBestEffort(
  observabilityPort: IDeploymentPolicyAdministrationObservabilityPort | undefined,
  event: DeploymentPolicyAdministrationObservabilityEvent,
): Promise<void> {
  if (!observabilityPort) {
    return;
  }

  try {
    await observabilityPort.recordDeploymentPolicyAdministrationEvent(
      sanitizeDeploymentPolicyAdministrationObservabilityEvent(event),
    );
  } catch {
    // Observability failures must stay non-blocking for policy administration flows.
  }
}

export function sanitizeDeploymentPolicyAdministrationObservabilityEvent(
  event: DeploymentPolicyAdministrationObservabilityEvent,
): DeploymentPolicyAdministrationObservabilityEvent {
  return Object.freeze({
    event: normalizeRequired(event.event, "deployment-policy-admin.event"),
    operation: event.operation,
    outcome: event.outcome,
    severity: event.severity,
    occurredAt: normalizeRequired(event.occurredAt, new Date(0).toISOString()),
    scope: event.scope
      ? Object.freeze({
        kind: event.scope.kind,
        scopeId: normalizeRequired(event.scope.scopeId, "unknown-scope"),
      })
      : undefined,
    actorUserIdentityId: normalizeOptional(event.actorUserIdentityId),
    profileId: normalizeOptional(event.profileId),
    correlationId: normalizeOptional(event.correlationId),
    operationKey: normalizeOptional(event.operationKey),
    details: sanitizeDetails(event.details),
    counters: sanitizeCounters(event.counters),
  });
}

function sanitizeDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details).slice(0, MaxObservedObjectEntries)) {
    if (SensitiveDetailKeyPattern.test(key)) {
      output[key] = RedactedValue;
      continue;
    }
    output[key] = sanitizeUnknown(value);
  }

  return Object.freeze(output);
}

function sanitizeCounters(
  counters: Readonly<Record<string, number>> | undefined,
): Readonly<Record<string, number>> | undefined {
  if (!counters) {
    return undefined;
  }
  const output: Record<string, number> = {};
  for (const [key, value] of Object.entries(counters)) {
    if (!Number.isFinite(value)) {
      continue;
    }
    output[key] = value;
  }
  return Object.freeze(output);
}

function sanitizeUnknown(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, MaxObservedArrayLength).map((entry) => sanitizeUnknown(entry)));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, MaxObservedObjectEntries)) {
      if (SensitiveDetailKeyPattern.test(key)) {
        output[key] = RedactedValue;
        continue;
      }
      output[key] = sanitizeUnknown(nested);
    }
    return Object.freeze(output);
  }
  return String(value);
}

function sanitizeString(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return normalized;
  }
  if (SensitiveStringPattern.test(normalized)) {
    return RedactedValue;
  }
  return normalized.length > MaxObservedStringLength
    ? `${normalized.slice(0, MaxObservedStringLength)}...`
    : normalized;
}

function normalizeRequired(value: string | undefined, fallback: string): string {
  const normalized = normalizeOptional(value);
  return normalized ?? fallback;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
