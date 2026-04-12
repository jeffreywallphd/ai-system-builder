import { sanitizePersistenceDiagnostics } from "@infrastructure/logging/PersistenceRedaction";

export const IMAGE_ASSET_OBSERVABILITY_REDACTED_VALUE = "[REDACTED]";

const SensitiveImageAssetObservabilityKeyPattern =
  /(secret|token|password|credential|upload[-_]?session|reservation|content|stream|body|payload|raw|path|file|directory|uri|url|object[-_]?key|object[-_]?version|storage[-_]?reference|storage[-_]?binding|fingerprint|checksum|digest)/i;
const SensitiveImageAssetObservabilityStringPattern =
  /(img-upload-v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|storage-instance:\/\/|workspaces\/[^\s]+\/image-assets\/[^\s]+)/i;

const MaxObservedStringLength = 256;
const MaxObservedArrayLength = 24;
const MaxObservedObjectEntries = 40;

export function sanitizeImageAssetManagementObservabilityPayload<TValue>(value: TValue): TValue {
  const baseline = sanitizePersistenceDiagnostics(value);
  return deepFreeze(redactImageAssetObservabilityPayload(baseline)) as TValue;
}

function redactImageAssetObservabilityPayload(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return normalized;
    }
    if (SensitiveImageAssetObservabilityStringPattern.test(normalized)) {
      return IMAGE_ASSET_OBSERVABILITY_REDACTED_VALUE;
    }
    return normalized.length > MaxObservedStringLength
      ? `${normalized.slice(0, MaxObservedStringLength)}...`
      : normalized;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MaxObservedArrayLength)
      .map((entry) => redactImageAssetObservabilityPayload(entry));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, MaxObservedObjectEntries)) {
      if (SensitiveImageAssetObservabilityKeyPattern.test(key)) {
        output[key] = IMAGE_ASSET_OBSERVABILITY_REDACTED_VALUE;
        continue;
      }
      output[key] = redactImageAssetObservabilityPayload(nested);
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
