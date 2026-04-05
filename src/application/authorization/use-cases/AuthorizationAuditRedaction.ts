const SensitiveAuditMetadataKeyPattern = /(secret|token|password|credential|cookie|session|authorization|api[-_]?key|private[-_]?key)/i;
const MaxStringValueLength = 256;

export function redactAuthorizationAuditMetadata(
  metadata?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined {
  if (!metadata) {
    return undefined;
  }

  const entries = Object.entries(metadata);
  if (entries.length === 0) {
    return undefined;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (SensitiveAuditMetadataKeyPattern.test(key)) {
      redacted[key] = "[REDACTED]";
      continue;
    }
    redacted[key] = sanitizeAuditValue(value);
  }

  return Object.freeze(redacted);
}

export function redactAuthorizationAuditReason(reason?: string): string | undefined {
  const normalized = reason?.trim();
  if (!normalized) {
    return undefined;
  }
  return truncateAuditString(normalized);
}

function sanitizeAuditValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return truncateAuditString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, 10).map((entry) => sanitizeAuditValue(entry)));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(record)) {
      if (SensitiveAuditMetadataKeyPattern.test(key)) {
        output[key] = "[REDACTED]";
        continue;
      }
      output[key] = sanitizeAuditValue(nested);
    }
    return Object.freeze(output);
  }

  return String(value);
}

function truncateAuditString(value: string): string {
  return value.length <= MaxStringValueLength
    ? value
    : `${value.slice(0, MaxStringValueLength)}...`;
}
