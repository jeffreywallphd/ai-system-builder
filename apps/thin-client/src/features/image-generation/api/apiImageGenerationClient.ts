import type { ImageGenerationRequest } from "../../../../../../modules/contracts/image-generation";
import type { RuntimeTaskRecord } from "../../../../../../modules/contracts/runtime";

export class ImageGenerationApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly endpoint: string,
    public readonly status?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ImageGenerationApiError";
  }

  get httpStatus(): number | undefined {
    return this.status;
  }
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ImageGenerationApiError };

function apiUrl(base: string, endpoint: string): string {
  return `${base.replace(/\/+$/, "") || "/api"}${endpoint}`;
}

async function callApi<T>(baseUrl: string, endpoint: string, payload: Record<string, unknown>): Promise<ApiResult<T>> {
  const response = await fetch(apiUrl(baseUrl, endpoint), {
    method: "POST",
    headers: { "content-type": "application/json", "x-client-source": "thin-client.image-generation" },
    body: JSON.stringify({ payload }),
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    return { ok: false, error: new ImageGenerationApiError(`Non-JSON response from ${endpoint} (status ${response.status}).`, "non-json-response", endpoint, response.status) };
  }

  if (!response.ok) {
    const errorBody = (body as { error?: { code?: string; message?: string; details?: Record<string, unknown> } })?.error;
    return {
      ok: false,
      error: new ImageGenerationApiError(
        errorBody?.message ?? `Request failed (${response.status}).`,
        errorBody?.code ?? `http-${response.status}`,
        endpoint,
        response.status,
        errorBody?.details,
      ),
    };
  }

  if (!body || typeof body !== "object" || (body as { ok?: boolean }).ok !== true) {
    return { ok: false, error: new ImageGenerationApiError("Response is not a valid success envelope.", "invalid-envelope", endpoint, response.status) };
  }

  return { ok: true, value: (body as { value: T }).value };
}

export function createApiImageGenerationClient(apiBaseUrl = "/api") {
  return {
    startImageGeneration(input: ImageGenerationRequest) {
      return callApi<{ requestId: string }>(apiBaseUrl, "/image-generation/start", input as unknown as Record<string, unknown>);
    },
    readImageGeneration(requestId: string) {
      return callApi<RuntimeTaskRecord>(apiBaseUrl, "/image-generation/read", { requestId });
    },
    cancelImageGeneration(requestId: string) {
      return callApi<RuntimeTaskRecord>(apiBaseUrl, "/image-generation/cancel", { requestId });
    },
    finalizeImageGeneration(requestId: string) {
      return callApi<{ assets?: Array<{ assetId: string; artifactId: string; storageKey?: string }> }>(apiBaseUrl, "/image-generation/finalize", { requestId });
    },
  };
}
