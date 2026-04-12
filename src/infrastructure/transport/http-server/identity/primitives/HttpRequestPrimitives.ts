import type { IncomingMessage } from "node:http";
import { URL } from "node:url";

const LocalRequestBaseUrl = "http://localhost";

export function resolveRequestUrl(requestUrl: string | undefined): URL {
  const normalizedUrl = requestUrl?.trim() || "/";
  try {
    return new URL(normalizedUrl, LocalRequestBaseUrl);
  } catch {
    return new URL("/", LocalRequestBaseUrl);
  }
}

export function resolveRequestSearchParams(requestUrl: string | undefined): URLSearchParams {
  return resolveRequestUrl(requestUrl).searchParams;
}

export function normalizeRequestContentType(
  contentTypeHeader: string | string[] | undefined,
): string | undefined {
  const value = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export async function* toRequestBodyStream(request: IncomingMessage): AsyncIterable<Uint8Array> {
  for await (const chunk of request) {
    yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  }
}

export async function parseJsonBody(
  request: IncomingMessage,
  maxBodyBytes: number,
): Promise<{ readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string }> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bufferChunk.length;
    if (totalBytes > maxBodyBytes) {
      return {
        ok: false,
        error: `Request body exceeds limit of ${maxBodyBytes} bytes.`,
      };
    }
    chunks.push(bufferChunk);
  }

  if (chunks.length === 0) {
    return { ok: false, error: "Request body is required." };
  }

  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, error: "Request body must be valid JSON." };
  }
}
