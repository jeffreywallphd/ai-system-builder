const SensitiveAuditOperationalKeyPattern =
  /(secret|token|password|credential|private[-_]?key|public[-_]?key|api[-_]?key|authorization|bearer|session|cookie|prompt|completion|transcript|chat|message|instruction|raw|payload|body|content|bytes|blob|path|file|directory|uri|url|connection[-_]?string|database[-_]?url|access[-_]?key)/i;
const WindowsPathPattern = /[a-zA-Z]:\\[^\s"'`]+/g;
const UnixPathPattern = /(?:^|[\s"'`])\/(?:[^/\s"'`]+\/)+[^/\s"'`]*/g;
const BearerTokenPattern = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const SecretAssignmentPattern = /(api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|credential)\s*[:=]\s*([^\s,;]+)/gi;
const PromptValuePattern = /((?:system|user|assistant)?\s*prompt|completion|transcript|message)\s*[:=]\s*([^\n\r]+)/gi;

const DefaultMaxStringLength = 512;
const DefaultMaxArrayLength = 25;

export interface AuditOperationalRedactionOptions {
  readonly maxStringLength?: number;
  readonly maxArrayLength?: number;
}

export function isSensitiveAuditOperationalKey(key: string): boolean {
  return SensitiveAuditOperationalKeyPattern.test(key);
}

export function redactAuditOperationalString(
  value: string,
  options: AuditOperationalRedactionOptions = {},
): string {
  const maxStringLength = options.maxStringLength ?? DefaultMaxStringLength;
  let output = value.trim();
  output = output.replace(BearerTokenPattern, "Bearer [REDACTED]");
  output = output.replace(SecretAssignmentPattern, "$1=[REDACTED]");
  output = output.replace(PromptValuePattern, "$1=[REDACTED_TEXT]");
  output = output.replace(WindowsPathPattern, "[REDACTED_PATH]");
  output = output.replace(UnixPathPattern, " [REDACTED_PATH]");
  return output.length > maxStringLength
    ? `${output.slice(0, maxStringLength)}...`
    : output;
}

export function sanitizeAuditOperationalUnknown(
  value: unknown,
  options: AuditOperationalRedactionOptions = {},
): unknown {
  const maxArrayLength = options.maxArrayLength ?? DefaultMaxArrayLength;

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactAuditOperationalString(value, options);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, maxArrayLength).map((entry) => sanitizeAuditOperationalUnknown(entry, options)));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveAuditOperationalKey(key)) {
        output[key] = "[REDACTED]";
        continue;
      }

      output[key] = sanitizeAuditOperationalUnknown(nestedValue, options);
    }
    return Object.freeze(output);
  }

  return String(value);
}

export function sanitizeAuditOperationalDetails(
  details: Readonly<Record<string, unknown>> | undefined,
  options: AuditOperationalRedactionOptions = {},
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (isSensitiveAuditOperationalKey(key)) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = sanitizeAuditOperationalUnknown(value, options);
  }
  return Object.freeze(output);
}

export function redactAuditOperationalErrorMessage(
  error: unknown,
  fallback = "Unknown failure",
): string {
  if (error instanceof Error) {
    return redactAuditOperationalString(error.message);
  }

  if (typeof error === "string") {
    return redactAuditOperationalString(error);
  }

  return fallback;
}
