import { sanitizePersistenceDiagnostics } from "@infrastructure/logging/PersistenceRedaction";

const SensitiveOfflineObservabilityFieldPattern = /(payload|request[-_]?body|response[-_]?body|raw[-_]?path|path|file|directory|token|secret|credential|internal[-_]?trace|diagnostic[-_]?payload)/i;

export function sanitizeOfflineOperationalObservabilityEvent<TValue>(value: TValue): TValue {
  const baselineSanitized = sanitizePersistenceDiagnostics(value);
  return deepFreeze(redactOfflineObservabilityFields(baselineSanitized)) as TValue;
}

function redactOfflineObservabilityFields(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactOfflineObservabilityFields(entry));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SensitiveOfflineObservabilityFieldPattern.test(key)) {
        output[key] = "[REDACTED]";
        continue;
      }
      output[key] = redactOfflineObservabilityFields(nested);
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
