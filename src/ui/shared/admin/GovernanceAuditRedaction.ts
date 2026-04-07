const MaxStringLength = 200;

export function redactGovernanceAuditValue(
  key: string,
  value: unknown,
): unknown {
  if (isSensitiveFieldKey(key)) {
    return redactSensitiveValue(value);
  }

  if (typeof value === "string") {
    return trimString(value);
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, 20).map((entry) => redactGovernanceAuditValue(key, entry)));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Readonly<Record<string, unknown>>).slice(0, 20);
    const next: Record<string, unknown> = {};
    for (const [nestedKey, nestedValue] of entries) {
      next[nestedKey] = redactGovernanceAuditValue(nestedKey, nestedValue);
    }
    return Object.freeze(next);
  }

  return value;
}

function isSensitiveFieldKey(key: string): boolean {
  const normalized = key.trim();
  const lower = normalized.toLowerCase();
  if (
    lower.includes("token")
    || lower.includes("secret")
    || lower.includes("password")
    || lower.includes("credential")
    || lower.includes("fingerprint")
    || lower.includes("marker")
    || lower.includes("session")
    || lower.includes("device")
    || lower.includes("identifier")
    || lower.includes("correlation")
  ) {
    return true;
  }
  return lower === "id"
    || lower.endsWith("_id")
    || lower.endsWith("-id")
    || normalized.endsWith("Id")
    || lower === "ref"
    || lower.endsWith("_ref")
    || lower.endsWith("-ref")
    || normalized.endsWith("Ref");
}

export function redactGovernanceAuditDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    redacted[key] = redactGovernanceAuditValue(key, value);
  }
  return Object.freeze(redacted);
}

function redactSensitiveValue(value: unknown): string {
  if (typeof value !== "string") {
    return "[REDACTED]";
  }
  const normalized = value.trim();
  if (normalized.length <= 10) {
    return "[REDACTED]";
  }
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

function trimString(value: string): string {
  return value.length > MaxStringLength ? `${value.slice(0, MaxStringLength)}...` : value;
}
