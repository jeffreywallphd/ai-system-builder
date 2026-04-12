export const PERSISTENCE_REDACTED_VALUE = "[REDACTED]";

const SensitiveFieldPattern = /(plaintext|prompt|secret|token|password|credential|private[-_]?key|api[-_]?key|authorization|cookie|session|path|file|directory|protected[-_]?metadata)/i;
const JwtLikePattern = /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
const OpenAiKeyPattern = /\bsk-[A-Za-z0-9_-]{8,}\b/;
const BearerTokenPattern = /\bBearer\s+[A-Za-z0-9._-]+\b/i;
const PemLikeValuePattern = /-----BEGIN [A-Z0-9 ]+-----/;
const AbsolutePathPattern = /^(?:[A-Za-z]:[\\/]|\\\\|\/).+/;

export function sanitizePersistenceDiagnostics<TValue>(value: TValue): TValue {
  return deepFreeze(sanitizeMutable(value)) as TValue;
}

function sanitizeMutable(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return shouldRedactStringValue(value) ? PERSISTENCE_REDACTED_VALUE : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeMutable(entry));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SensitiveFieldPattern.test(key)) {
        output[key] = PERSISTENCE_REDACTED_VALUE;
        continue;
      }
      output[key] = sanitizeMutable(nested);
    }
    return output;
  }

  return String(value);
}

function shouldRedactStringValue(value: string): boolean {
  if (value.trim().length < 1) {
    return false;
  }

  return JwtLikePattern.test(value)
    || OpenAiKeyPattern.test(value)
    || BearerTokenPattern.test(value)
    || PemLikeValuePattern.test(value)
    || AbsolutePathPattern.test(value);
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const nested of value) {
      deepFreeze(nested);
    }
    return Object.freeze(value);
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested);
  }
  return Object.freeze(value);
}
