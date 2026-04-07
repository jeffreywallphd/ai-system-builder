import { randomUUID } from "node:crypto";
import type { CanonicalAuditEvent } from "@domain/audit/AuditDomain";
import {
  AuditDomainError,
  AuditRedactionReasons,
  createCanonicalAuditEvent,
} from "@domain/audit/AuditDomain";
import {
  resolveAuditCategoryForAction,
  type AuditLedgerAppendResult,
} from "../AuditApplicationContracts";
import {
  AuthoritativeAuditActionPrefixHintsBySource,
  AuthoritativeAuditEventSources,
  type AuthoritativeAuditEventSource,
  type AuthoritativeAuditRecordEventInput,
  type AuthoritativeAuditRecordingPort,
  type AuthoritativeAuditRecordingServiceDependencies,
  type AuthoritativeAuditStructuredPayload,
} from "../ports/AuthoritativeAuditRecordingPorts";
import {
  AuditReferenceContextPayloadKey,
  type NormalizedAuthoritativeAuditActionContext,
  normalizeAuthoritativeAuditReferences,
} from "../shared/AuditReferenceNormalization";

const SensitiveAuditDetailKeyPattern = /(secret|token|password|credential|private[-_]?key|public[-_]?key|trust[-_]?material|attestation|pem|csr|raw|body|payload|content|bytes|blob|path|uri|url|connection[-_]?string|database[-_]?url|access[-_]?key|api[-_]?key|authorization)/i;
const PersonalDataAuditDetailKeyPattern = /(email|phone|ssn|address|first[-_]?name|last[-_]?name|personal|pii|birth|dob)/i;
const InternalDiagnosticAuditDetailKeyPattern = /(stack|trace|diagnostic|internal[-_]?only|internal[-_]?error)/i;
const MaxAuditStringLength = 1024;
const MaxAuditArrayLength = 32;

type RedactionReason = typeof AuditRedactionReasons[keyof typeof AuditRedactionReasons];

interface SanitizedBoundaryPayload {
  readonly userSafeDetails?: Readonly<Record<string, unknown>>;
  readonly adminOnlyDetails?: Readonly<Record<string, unknown>>;
  readonly hasProtectedData: boolean;
  readonly redactionReasons: ReadonlyArray<RedactionReason>;
}

export class AuthoritativeAuditRecordingService implements AuthoritativeAuditRecordingPort {
  private readonly now: () => Date;

  private readonly idGenerator: () => string;

  public constructor(private readonly dependencies: AuthoritativeAuditRecordingServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? (() => randomUUID());
  }

  public async recordIdentityEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult> {
    return this.recordEventForSource(AuthoritativeAuditEventSources.identity, input);
  }

  public async recordNodeTrustEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult> {
    return this.recordEventForSource(AuthoritativeAuditEventSources.nodeTrust, input);
  }

  public async recordSharingEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult> {
    return this.recordEventForSource(AuthoritativeAuditEventSources.sharing, input);
  }

  public async recordStorageEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult> {
    return this.recordEventForSource(AuthoritativeAuditEventSources.storage, input);
  }

  public async recordRunsEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult> {
    return this.recordEventForSource(AuthoritativeAuditEventSources.runs, input);
  }

  public async recordSchedulingEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult> {
    return this.recordEventForSource(AuthoritativeAuditEventSources.scheduling, input);
  }

  public async recordSecretsEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult> {
    return this.recordEventForSource(AuthoritativeAuditEventSources.secrets, input);
  }

  public async recordPolicyEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult> {
    return this.recordEventForSource(AuthoritativeAuditEventSources.policy, input);
  }

  private async recordEventForSource(
    source: AuthoritativeAuditEventSource,
    input: AuthoritativeAuditRecordEventInput,
  ): Promise<AuditLedgerAppendResult> {
    const operationKey = normalizeRequired(input.operationKey, "operationKey").toLowerCase();
    const action = normalizeRequired(input.action, "action").toLowerCase();
    this.assertActionPrefixForSource(source, action);
    const normalizedReferences = normalizeAuthoritativeAuditReferences({
      actor: input.actor,
      scope: input.scope,
      protectedResource: input.protectedResource,
      correlationId: input.correlationId,
      requestId: input.requestId,
      actionContext: input.actionContext,
    });

    const event = createCanonicalAuditEvent({
      eventId: `audit:${source}:${this.idGenerator()}`,
      eventType: normalizeRequired(input.eventType, "eventType"),
      category: input.category ?? resolveAuditCategoryForAction(action),
      action,
      outcome: input.outcome,
      occurredAt: input.occurredAt,
      recordedAt: this.now().toISOString(),
      actor: normalizedReferences.actor,
      scope: normalizedReferences.scope,
      protectedResource: normalizedReferences.protectedResource,
      payload: this.sanitizeStructuredPayload(input.payload, normalizedReferences.actionContext),
      integrity: {
        schemaVersion: input.integrity?.schemaVersion?.trim() || "1.0",
        hashAlgorithm: input.integrity?.hashAlgorithm?.trim() || "sha-256",
        eventDigest: normalizeOptional(input.integrity?.eventDigest),
        previousEventDigest: normalizeOptional(input.integrity?.previousEventDigest),
      },
      retention: input.retention,
      immutability: input.immutability,
      correlationId: normalizedReferences.correlationId,
      requestId: normalizedReferences.requestId,
    });

    return this.dependencies.repository.appendAuditEvent(event, {
      operationKey,
      actorId: event.actor.actorId,
      occurredAt: event.occurredAt,
      correlationId: event.correlationId,
    });
  }

  private assertActionPrefixForSource(source: AuthoritativeAuditEventSource, action: string): void {
    const expectedPrefixes = AuthoritativeAuditActionPrefixHintsBySource[source];
    if (expectedPrefixes.some((prefix) => action.startsWith(prefix))) {
      return;
    }

    throw new AuditDomainError(
      `Audit action '${action}' is not valid for '${source}' source. Expected prefixes: ${expectedPrefixes.join(", ")}`,
    );
  }

  private sanitizeStructuredPayload(
    payload: AuthoritativeAuditStructuredPayload | undefined,
    actionContext: NormalizedAuthoritativeAuditActionContext | undefined,
  ): SanitizedBoundaryPayload {
    const userSafeDetailsInput = actionContext
      ? {
        ...(payload?.userSafeDetails ?? {}),
        [AuditReferenceContextPayloadKey]: actionContext,
      }
      : payload?.userSafeDetails;

    const providedReasons = new Set<RedactionReason>(payload?.redactionReasons ?? []);

    const userSafeResult = sanitizeAuditRecord(userSafeDetailsInput, providedReasons);
    const adminOnlyResult = sanitizeAuditRecord(payload?.adminOnlyDetails, providedReasons);

    if (adminOnlyResult.sawAnyValue) {
      providedReasons.add(AuditRedactionReasons.internalOnlyDiagnostic);
    }

    const hasProtectedData = payload?.hasProtectedData
      ?? (adminOnlyResult.sawAnyValue || userSafeResult.redacted);

    if (hasProtectedData && providedReasons.size < 1) {
      providedReasons.add(AuditRedactionReasons.internalOnlyDiagnostic);
    }

    return Object.freeze({
      userSafeDetails: userSafeResult.record,
      adminOnlyDetails: adminOnlyResult.record,
      hasProtectedData,
      redactionReasons: Object.freeze([...providedReasons]),
    });
  }
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AuditDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

interface SanitizedAuditRecordResult {
  readonly record?: Readonly<Record<string, unknown>>;
  readonly redacted: boolean;
  readonly sawAnyValue: boolean;
}

function sanitizeAuditRecord(
  input: Readonly<Record<string, unknown>> | undefined,
  reasons: Set<RedactionReason>,
): SanitizedAuditRecordResult {
  if (!input) {
    return {
      redacted: false,
      sawAnyValue: false,
    };
  }

  let redacted = false;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const sensitivityReason = resolveKeySensitivityReason(key);
    if (sensitivityReason) {
      redacted = true;
      reasons.add(sensitivityReason);
      output[key] = "[REDACTED]";
      continue;
    }

    const sanitized = sanitizeAuditUnknown(value, reasons);
    if (sanitized.redacted) {
      redacted = true;
    }
    output[key] = sanitized.value;
  }

  return {
    record: Object.freeze(output),
    redacted,
    sawAnyValue: Object.keys(output).length > 0,
  };
}

function sanitizeAuditUnknown(
  value: unknown,
  reasons: Set<RedactionReason>,
): { readonly value: unknown; readonly redacted: boolean } {
  if (value === null || value === undefined) {
    return { value, redacted: false };
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    const limited = normalized.length > MaxAuditStringLength
      ? `${normalized.slice(0, MaxAuditStringLength)}...`
      : normalized;
    return { value: limited, redacted: false };
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return { value, redacted: false };
  }

  if (Array.isArray(value)) {
    let redacted = false;
    const output = value
      .slice(0, MaxAuditArrayLength)
      .map((entry) => {
        const sanitized = sanitizeAuditUnknown(entry, reasons);
        if (sanitized.redacted) {
          redacted = true;
        }
        return sanitized.value;
      });

    return { value: Object.freeze(output), redacted };
  }

  if (typeof value === "object") {
    let redacted = false;
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const sensitivityReason = resolveKeySensitivityReason(key);
      if (sensitivityReason) {
        redacted = true;
        reasons.add(sensitivityReason);
        output[key] = "[REDACTED]";
        continue;
      }

      const sanitized = sanitizeAuditUnknown(nestedValue, reasons);
      if (sanitized.redacted) {
        redacted = true;
      }
      output[key] = sanitized.value;
    }

    return { value: Object.freeze(output), redacted };
  }

  return { value: String(value), redacted: false };
}

function resolveKeySensitivityReason(key: string): RedactionReason | undefined {
  if (SensitiveAuditDetailKeyPattern.test(key)) {
    if (/token/i.test(key)) {
      return AuditRedactionReasons.token;
    }
    if (/password|credential/i.test(key)) {
      return AuditRedactionReasons.credential;
    }
    return AuditRedactionReasons.secretMaterial;
  }

  if (PersonalDataAuditDetailKeyPattern.test(key)) {
    return AuditRedactionReasons.personalData;
  }

  if (InternalDiagnosticAuditDetailKeyPattern.test(key)) {
    return AuditRedactionReasons.internalOnlyDiagnostic;
  }

  return undefined;
}

export function toCanonicalAuthoritativeAuditEvent(event: CanonicalAuditEvent): CanonicalAuditEvent {
  return Object.freeze({
    ...event,
    actor: Object.freeze({ ...event.actor }),
    scope: Object.freeze({ ...event.scope }),
    protectedResource: event.protectedResource
      ? Object.freeze({ ...event.protectedResource })
      : undefined,
    payload: Object.freeze({
      ...event.payload,
      userSafeDetails: event.payload.userSafeDetails
        ? Object.freeze({ ...event.payload.userSafeDetails })
        : undefined,
      adminOnlyDetails: event.payload.adminOnlyDetails
        ? Object.freeze({ ...event.payload.adminOnlyDetails })
        : undefined,
      redactionReasons: Object.freeze([...event.payload.redactionReasons]),
    }),
    integrity: Object.freeze({ ...event.integrity }),
  });
}
