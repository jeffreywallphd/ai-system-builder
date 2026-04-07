import type {
  AssetManagementApiError,
  AssetManagementApiErrorCode,
} from "./sdk/PublicAssetManagementApiContract";

const SensitiveDetailKeyPattern =
  /(secret|token|password|credential|content|payload|body|raw|bytes|blob|stream|path|filepath|file[-_]?path|fileName|directory|uri|url|object[-_]?key|object[-_]?version|storage[-_]?uri|checksum[-_]?digest)/i;
const MaxDetailStringLength = 256;

const DefaultMessagesByCode = Object.freeze<Record<AssetManagementApiErrorCode, string>>({
  "invalid-request": "Request validation failed.",
  "authentication-failed": "Authentication is required.",
  forbidden: "Asset operation is not permitted for the current actor.",
  "not-found": "Requested asset resource was not found.",
  conflict: "Asset operation conflicted with the current resource state.",
  "invalid-state": "Asset operation is not allowed in the current resource state.",
  internal: "Asset operation failed due to an internal error.",
});

export function sanitizeAssetManagementApiError(input: {
  readonly code: AssetManagementApiError["code"];
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}): AssetManagementApiError {
  const message = resolveMessage(input.code, input.message);
  const details = sanitizeDetails(input.details);
  return Object.freeze({
    code: input.code,
    message,
    details,
  });
}

function resolveMessage(code: AssetManagementApiError["code"], message: string): string {
  if (code === "invalid-request") {
    const normalized = normalizeMessage(message);
    return normalized.length > 0 ? normalized : DefaultMessagesByCode[code];
  }
  return DefaultMessagesByCode[code] ?? DefaultMessagesByCode.internal;
}

function normalizeMessage(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized;
}

function sanitizeDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SensitiveDetailKeyPattern.test(key)) {
      output[key] = "[REDACTED]";
      continue;
    }

    output[key] = sanitizeUnknown(value);
  }
  return Object.freeze(output);
}

function sanitizeUnknown(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return value.length > MaxDetailStringLength
      ? `${value.slice(0, MaxDetailStringLength)}...`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, 20).map((entry) => sanitizeUnknown(entry)));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SensitiveDetailKeyPattern.test(key)) {
        output[key] = "[REDACTED]";
        continue;
      }
      output[key] = sanitizeUnknown(nested);
    }
    return Object.freeze(output);
  }
  return String(value);
}
