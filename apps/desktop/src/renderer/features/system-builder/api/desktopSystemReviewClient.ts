import type {
  SystemReviewPreview,
  SystemReviewResult,
} from "../../../../../../../modules/contracts/system-review";
import type { SystemReviewClient } from "../../../../../../../modules/ui/shared/system-builder";
import { getDesktopApi } from "../../../lib/desktopApi";

interface Envelope {
  readonly ok?: boolean;
  readonly value?: unknown;
  readonly error?: { readonly code?: unknown; readonly message?: unknown };
}

const failure = <T>(
  message = "System review is unavailable.",
  code = "unavailable",
): SystemReviewResult<T> => ({ ok: false, error: { code, message } });

function unwrap<T>(
  response: unknown,
  map: (value: unknown) => T = (value) => value as T,
): SystemReviewResult<T> {
  if (!response || typeof response !== "object" || Array.isArray(response))
    return failure(
      "The desktop system-review response was invalid.",
      "invalid-response",
    );
  const envelope = response as Envelope;
  if (envelope.ok === true) {
    try {
      return { ok: true, value: map(envelope.value) };
    } catch {
      return failure(
        "The desktop system-review response was invalid.",
        "invalid-response",
      );
    }
  }
  return failure(
    typeof envelope.error?.message === "string"
      ? envelope.error.message
      : "The system-review request failed.",
    typeof envelope.error?.code === "string" ? envelope.error.code : "internal",
  );
}

export function createDesktopSystemReviewClient(): SystemReviewClient {
  const api = getDesktopApi();
  return {
    describe: async (input) =>
      typeof api.describeSystemReview === "function"
        ? unwrap(await api.describeSystemReview(input))
        : failure(),
    browse: async (input) =>
      typeof api.browseSystemReviewArtifacts === "function"
        ? unwrap(await api.browseSystemReviewArtifacts(input))
        : failure(),
    detail: async (input) =>
      typeof api.readSystemReviewArtifact === "function"
        ? unwrap(await api.readSystemReviewArtifact(input))
        : failure(),
    preview: async (input) =>
      typeof api.previewSystemReviewArtifact === "function"
        ? unwrap(await api.previewSystemReviewArtifact(input), normalizePreview)
        : failure(),
    listAudit: async (input) =>
      typeof api.listSystemReviewAudit === "function"
        ? unwrap(await api.listSystemReviewAudit(input))
        : failure(),
  };
}

function normalizePreview(value: unknown): SystemReviewPreview {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid preview.");
  const preview = value as SystemReviewPreview & { bytes?: unknown };
  return {
    ...preview,
    ...(preview.bytes === undefined
      ? {}
      : { bytes: normalizeBytes(preview.bytes) }),
  };
}

function normalizeBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (
    !Array.isArray(value) ||
    value.length > 8 * 1024 * 1024 ||
    value.some(
      (entry) =>
        !Number.isInteger(entry) || Number(entry) < 0 || Number(entry) > 255,
    )
  )
    throw new Error("Invalid preview bytes.");
  return Uint8Array.from(value as number[]);
}
