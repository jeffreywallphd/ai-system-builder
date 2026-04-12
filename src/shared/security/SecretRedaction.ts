export const SECRET_REDACTED_VALUE = "[REDACTED]";

const SensitiveSecretFieldPattern = /(plaintext|secret|token|password|credential|private[-_]?key|api[-_]?key|authorization|cookie|session)/i;
const PemLikeValuePattern = /-----BEGIN [A-Z0-9 ]+-----/;

export function isSensitiveSecretField(fieldName: string): boolean {
  return SensitiveSecretFieldPattern.test(fieldName);
}

export function redactSecretValue(value: unknown): string | unknown {
  if (value === undefined || value === null) {
    return value;
  }
  return SECRET_REDACTED_VALUE;
}

export function redactSecretMaterial<TValue>(value: TValue): TValue {
  return deepFreeze(redactSecretMaterialMutable(value)) as TValue;
}

function redactSecretMaterialMutable(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return PemLikeValuePattern.test(value) ? SECRET_REDACTED_VALUE : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSecretMaterialMutable(entry));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveSecretField(key)) {
        output[key] = SECRET_REDACTED_VALUE;
        continue;
      }
      output[key] = redactSecretMaterialMutable(nested);
    }
    return output;
  }

  return String(value);
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
