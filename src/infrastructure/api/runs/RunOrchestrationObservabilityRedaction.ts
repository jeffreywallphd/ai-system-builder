import { sanitizePersistenceDiagnostics } from "@infrastructure/logging/PersistenceRedaction";

export const RUN_OBSERVABILITY_REDACTED_VALUE = "[REDACTED]";

const SensitiveRunObservabilityFieldPattern = /(prompt|parameter|payload|request[-_]?body|response[-_]?body|backend[-_]?(payload|detail|details|response)|unsafe[-_]?backend|raw[-_]?path|raw[-_]?prompt|internal[-_]?diagnostic)/i;

export function sanitizeRunOrchestrationObservabilityEvent<TValue>(value: TValue): TValue {
  const baselineSanitized = sanitizePersistenceDiagnostics(value);
  return deepFreeze(redactRunObservabilityPayloadFields(baselineSanitized)) as TValue;
}

function redactRunObservabilityPayloadFields(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactRunObservabilityPayloadFields(entry));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SensitiveRunObservabilityFieldPattern.test(key)) {
        output[key] = RUN_OBSERVABILITY_REDACTED_VALUE;
        continue;
      }
      output[key] = redactRunObservabilityPayloadFields(nested);
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
