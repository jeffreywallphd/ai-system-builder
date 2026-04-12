import type { ProtectedDataClass } from "@domain/security/EncryptionAtRestPolicyDomain";

export const EncryptionEnforcementOutcomes = Object.freeze({
  succeeded: "succeeded",
  denied: "denied",
  rejected: "rejected",
  failed: "failed",
  missing: "missing",
});

export type EncryptionEnforcementOutcome =
  typeof EncryptionEnforcementOutcomes[keyof typeof EncryptionEnforcementOutcomes];

export interface EncryptionEnforcementEvent {
  readonly event: string;
  readonly outcome: EncryptionEnforcementOutcome;
  readonly occurredAt: string;
  readonly actorUserId?: string;
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly dataClass?: ProtectedDataClass;
  readonly correlationId?: string;
  readonly operationKey?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IEncryptionEnforcementObservabilityPort {
  recordEncryptionEnforcementEvent(event: EncryptionEnforcementEvent): Promise<void>;
}

export async function publishEncryptionEnforcementEventBestEffort(
  observabilityPort: IEncryptionEnforcementObservabilityPort | undefined,
  event: EncryptionEnforcementEvent,
): Promise<void> {
  if (!observabilityPort) {
    return;
  }

  try {
    await observabilityPort.recordEncryptionEnforcementEvent(sanitizeEncryptionEnforcementEvent(event));
  } catch {
    // Intentionally best-effort until durable delivery is implemented.
  }
}

export class NoOpEncryptionEnforcementObservabilityPort implements IEncryptionEnforcementObservabilityPort {
  public async recordEncryptionEnforcementEvent(_event: EncryptionEnforcementEvent): Promise<void> {
    // no-op by design
  }
}

const SensitiveEncryptionDetailKeyPattern =
  /(secret|token|password|credential|private[-_]?key|public[-_]?key|key[-_]?reference|key[-_]?id|key[-_]?material|raw|payload|plaintext|ciphertext|content|body|blob|bytes|stream|object[-_]?key|path|file|directory|uri|url|aad|auth[-_]?tag|iv|nonce)/i;
const WindowsPathPattern = /[a-zA-Z]:\\[^\s"'`]+/g;
const UnixPathPattern = /(?:^|[\s"'`])\/(?:[^/\s"'`]+\/)+[^/\s"'`]*/g;
const MaxObservedStringLength = 512;

export function sanitizeEncryptionEnforcementEvent(
  event: EncryptionEnforcementEvent,
): EncryptionEnforcementEvent {
  return Object.freeze({
    event: normalizeRequired(event.event, "unknown-encryption-event"),
    outcome: event.outcome,
    occurredAt: normalizeRequired(event.occurredAt, new Date(0).toISOString()),
    actorUserId: normalizeOptional(event.actorUserId),
    workspaceId: normalizeOptional(event.workspaceId),
    storageInstanceId: normalizeOptional(event.storageInstanceId),
    dataClass: event.dataClass,
    correlationId: normalizeOptional(event.correlationId),
    operationKey: normalizeOptional(event.operationKey),
    details: sanitizeDetails(event.details),
  });
}

function sanitizeDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SensitiveEncryptionDetailKeyPattern.test(key)) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = sanitizeUnknown(value);
  }
  return Object.freeze(output);
}

function sanitizeUnknown(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return redactSensitiveString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, 25).map((entry) => sanitizeUnknown(entry)));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SensitiveEncryptionDetailKeyPattern.test(key)) {
        output[key] = "[REDACTED]";
        continue;
      }
      output[key] = sanitizeUnknown(nestedValue);
    }
    return Object.freeze(output);
  }
  return String(value);
}

function redactSensitiveString(value: string): string {
  let output = value;
  output = output.replace(WindowsPathPattern, "[REDACTED_PATH]");
  output = output.replace(UnixPathPattern, " [REDACTED_PATH]");
  return output.length > MaxObservedStringLength
    ? `${output.slice(0, MaxObservedStringLength)}...`
    : output;
}

function normalizeRequired(value: string, fallback: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

