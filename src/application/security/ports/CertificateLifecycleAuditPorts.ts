export const CertificateLifecycleAuditEventTypes = Object.freeze({
  certificateAuthorityInitializationStarted: "ca-initialize-started",
  certificateAuthorityInitializationSucceeded: "ca-initialize-succeeded",
  certificateAuthorityInitializationFailed: "ca-initialize-failed",
  certificateIssuanceStarted: "certificate-issuance-started",
  certificateIssuanceSucceeded: "certificate-issuance-succeeded",
  certificateIssuanceBlocked: "certificate-issuance-blocked",
  certificateIssuanceFailed: "certificate-issuance-failed",
  certificateRevocationStarted: "certificate-revocation-started",
  certificateRevocationSucceeded: "certificate-revocation-succeeded",
  certificateRevocationFailed: "certificate-revocation-failed",
  certificateRenewalStarted: "certificate-renewal-started",
  certificateRenewalSucceeded: "certificate-renewal-succeeded",
  certificateRenewalFailed: "certificate-renewal-failed",
});

export type CertificateLifecycleAuditEventType =
  typeof CertificateLifecycleAuditEventTypes[keyof typeof CertificateLifecycleAuditEventTypes];

export interface CertificateLifecycleAuditEvent {
  readonly type: CertificateLifecycleAuditEventType;
  readonly actorUserIdentityId: string;
  readonly occurredAt: string;
  readonly certificateAuthorityId?: string;
  readonly serialNumber?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface CertificateLifecycleAuditSink {
  recordCertificateLifecycleAuditEvent(event: CertificateLifecycleAuditEvent): Promise<void>;
}

export async function publishCertificateLifecycleAuditEventBestEffort(
  auditSink: CertificateLifecycleAuditSink | undefined,
  event: CertificateLifecycleAuditEvent,
): Promise<void> {
  if (!auditSink) {
    return;
  }

  try {
    await auditSink.recordCertificateLifecycleAuditEvent(sanitizeCertificateLifecycleAuditEvent(event));
  } catch {
    // Intentionally best-effort until dedicated security audit durability is introduced.
  }
}

const SensitiveCertificateLifecycleAuditDetailKeyPattern =
  /(secret|token|password|credential|private[-_]?key|trust[-_]?material|certificate[-_]?material|chain[-_]?material|storage[-_]?locator|pem|csr|public[-_]?key|key[-_]?scope|raw)/i;
const MaxCertificateLifecycleAuditStringLength = 256;

function sanitizeCertificateLifecycleAuditEvent(event: CertificateLifecycleAuditEvent): CertificateLifecycleAuditEvent {
  return Object.freeze({
    ...event,
    actorUserIdentityId: normalizeAuditValue(event.actorUserIdentityId),
    occurredAt: normalizeAuditValue(event.occurredAt),
    certificateAuthorityId: normalizeAuditOptional(event.certificateAuthorityId),
    serialNumber: normalizeAuditOptional(event.serialNumber),
    details: sanitizeCertificateLifecycleAuditDetails(event.details),
  });
}

function sanitizeCertificateLifecycleAuditDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SensitiveCertificateLifecycleAuditDetailKeyPattern.test(key)) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = sanitizeAuditUnknown(value);
  }

  return Object.freeze(output);
}

function sanitizeAuditUnknown(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return value.length > MaxCertificateLifecycleAuditStringLength
      ? `${value.slice(0, MaxCertificateLifecycleAuditStringLength)}...`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, 20).map((entry) => sanitizeAuditUnknown(entry)));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SensitiveCertificateLifecycleAuditDetailKeyPattern.test(key)) {
        output[key] = "[REDACTED]";
        continue;
      }
      output[key] = sanitizeAuditUnknown(nestedValue);
    }
    return Object.freeze(output);
  }

  return String(value);
}

function normalizeAuditValue(value: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "unknown";
}

function normalizeAuditOptional(value?: string): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
