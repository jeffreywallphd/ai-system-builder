import type { ImageGenerationRequest } from "../../../../../../modules/contracts/image-generation";
import type { RuntimeTaskRecord } from "../../../../../../modules/contracts/runtime";

interface ApiResponseEnvelope {
  ok: boolean;
  value?: unknown;
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
}

export interface FinalizedImageAsset {
  assetId: string;
  artifactId: string;
  storageKey: string;
  mediaType: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface FinalizeImageGenerationResult {
  finalized: boolean;
  reason?: string;
  assets?: FinalizedImageAsset[];
}

export interface CancelImageGenerationResult {
  cancelled: boolean;
  message?: string;
  status?: string;
}

export interface ImageGenerationApiClient {
  startImageGeneration: (input: ImageGenerationRequest, context?: { source?: string }) => Promise<{ requestId: string }>;
  readImageGeneration: (input: { requestId: string }, context?: { source?: string }) => Promise<RuntimeTaskRecord>;
  cancelImageGeneration: (input: { requestId: string }, context?: { source?: string }) => Promise<CancelImageGenerationResult>;
  finalizeImageGenerationIfCompleted: (input: { requestId: string }, context?: { source?: string }) => Promise<FinalizeImageGenerationResult>;
  createArtifactMediaViewUrl: (storageKey: string) => string;
}

const createApiUrl = (baseUrl: string, suffix: string): string => `${baseUrl.trim().replace(/\/+$/, "") || "/api"}${suffix}`;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function ensureEnvelope(value: unknown): ApiResponseEnvelope {
  if (isRecord(value) && typeof value.ok === "boolean") return value as unknown as ApiResponseEnvelope;
  throw new Error("Image generation response is not a valid API envelope.");
}

function createApiError(response: ApiResponseEnvelope, status: number): Error {
  const code = response.error?.code;
  const message = response.error?.message ?? `Image generation request failed (HTTP ${status}).`;
  const error = new Error(code ? `${message} [${code}]` : message) as Error & { code?: string; details?: Record<string, unknown> };
  error.code = code;
  error.details = response.error?.details;
  return error;
}

function ensureSuccess<T>(response: ApiResponseEnvelope, status: number, pick: (value: unknown) => T): T {
  if (!response.ok) throw createApiError(response, status);
  return pick(response.value);
}

async function postJson(baseUrl: string, path: string, body: Record<string, unknown>, source: string): Promise<{ envelope: ApiResponseEnvelope; status: number }> {
  const response = await fetch(createApiUrl(baseUrl, path), {
    method: "POST",
    headers: { "content-type": "application/json", "x-client-source": source },
    body: JSON.stringify(body),
  });

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(`Image generation API returned non-JSON response (HTTP ${response.status}).`);
  }

  return { envelope: ensureEnvelope(parsed), status: response.status };
}

function expectRequestId(value: unknown): { requestId: string } {
  if (!isRecord(value) || typeof value.requestId !== "string" || value.requestId.trim().length === 0) {
    throw new Error("Image generation start response missing requestId.");
  }
  return { requestId: value.requestId };
}

function expectTaskRecord(value: unknown): RuntimeTaskRecord {
  if (!isRecord(value) || typeof value.requestId !== "string" || typeof value.status !== "string") {
    throw new Error("Image generation read response is malformed.");
  }
  return value as unknown as RuntimeTaskRecord;
}

function expectCancelResult(value: unknown): CancelImageGenerationResult {
  if (!isRecord(value) || typeof value.cancelled !== "boolean") throw new Error("Image generation cancel response is malformed.");
  return value as unknown as CancelImageGenerationResult;
}

function expectFinalizeResult(value: unknown): FinalizeImageGenerationResult {
  if (!isRecord(value) || typeof value.finalized !== "boolean") throw new Error("Image generation finalize response is malformed.");
  return value as unknown as FinalizeImageGenerationResult;
}

export function createApiImageGenerationClient(options: { apiBaseUrl?: string; source?: string } = {}): ImageGenerationApiClient {
  const apiBaseUrl = options.apiBaseUrl ?? "/api";
  const source = options.source ?? "thin-client.image-generation";

  return {
    async startImageGeneration(input, context) {
      const { envelope, status } = await postJson(apiBaseUrl, "/image-generation/start", { ...input }, context?.source ?? source);
      return ensureSuccess(envelope, status, expectRequestId);
    },
    async readImageGeneration(input, context) {
      const { envelope, status } = await postJson(apiBaseUrl, "/image-generation/read", { ...input }, context?.source ?? source);
      return ensureSuccess(envelope, status, expectTaskRecord);
    },
    async cancelImageGeneration(input, context) {
      const { envelope, status } = await postJson(apiBaseUrl, "/image-generation/cancel", { ...input }, context?.source ?? source);
      return ensureSuccess(envelope, status, expectCancelResult);
    },
    async finalizeImageGenerationIfCompleted(input, context) {
      const { envelope, status } = await postJson(apiBaseUrl, "/image-generation/finalize", { ...input }, context?.source ?? source);
      return ensureSuccess(envelope, status, expectFinalizeResult);
    },
    createArtifactMediaViewUrl(storageKey) {
      return `${createApiUrl(apiBaseUrl, "/artifact/media/view")}?storageKey=${encodeURIComponent(storageKey)}`;
    },
  };
}
