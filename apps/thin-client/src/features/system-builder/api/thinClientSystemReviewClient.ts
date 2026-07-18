import type {
  SystemReviewPreview,
  SystemReviewResult,
} from "../../../../../../modules/contracts/system-review";
import type { SystemReviewClient } from "../../../../../../modules/ui/shared/system-builder";
import { parseApiEnvelope } from "../../../security/apiErrorEnvelope";
import { secureFetch } from "../../../security/secureFetch";

const failure = <T>(
  message = "System review is unavailable.",
  code = "unavailable",
): SystemReviewResult<T> => ({ ok: false, error: { code, message } });

async function request<T>(
  url: string,
  map: (value: unknown) => T = (value) => value as T,
): Promise<SystemReviewResult<T>> {
  try {
    const response = await secureFetch(url);
    const envelope = parseApiEnvelope(await response.json());
    if (envelope.ok) return { ok: true, value: map(envelope.value) };
    return failure(
      envelope.error?.message ?? "The system-review request failed.",
      envelope.error?.code ?? "internal",
    );
  } catch {
    return failure();
  }
}

const query = (input: { workspaceId: string; releaseId: string }) =>
  `workspaceId=${encodeURIComponent(input.workspaceId)}&releaseId=${encodeURIComponent(input.releaseId)}`;

export function createThinClientSystemReviewClient(
  baseUrl = "/api",
): SystemReviewClient {
  const root = baseUrl.replace(/\/+$/, "");
  return {
    describe: (input) => request(`${root}/systems/review?${query(input)}`),
    browse: (input) =>
      request(
        `${root}/systems/review/artifacts?${query(input)}${input.nameQuery ? `&nameQuery=${encodeURIComponent(input.nameQuery)}` : ""}${input.limit !== undefined ? `&limit=${input.limit}` : ""}`,
      ),
    detail: (input) =>
      request(
        `${root}/systems/review/artifact?${query(input)}&artifactRef=${encodeURIComponent(input.artifactRef)}`,
      ),
    preview: (input) =>
      request(
        `${root}/systems/review/preview?${query(input)}&artifactRef=${encodeURIComponent(input.artifactRef)}`,
        normalizePreview,
      ),
    listAudit: (input) =>
      request(
        `${root}/systems/review/audit?${query(input)}${input.limit !== undefined ? `&limit=${input.limit}` : ""}`,
      ),
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
