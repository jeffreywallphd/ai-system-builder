import type {
  PythonRuntimeCapabilitiesResult,
  PythonRuntimeHealthCheckResult,
  PythonRuntimeTaskRequest,
  PythonRuntimeTaskResult,
} from "../../../../contracts/runtime";

import {
  mapCapabilitiesResponseFromHttpPayload,
  mapHealthResponseFromHttpPayload,
  mapTaskRequestToHttpPayload,
  mapTaskResponseFromHttpPayload,
} from "../protocol/pythonRuntimeHttpProtocol";

export interface PythonRuntimeHttpClient {
  getHealthStatus(): Promise<PythonRuntimeHealthCheckResult>;
  getCapabilities(): Promise<PythonRuntimeCapabilitiesResult>;
  executeTask(request: PythonRuntimeTaskRequest): Promise<PythonRuntimeTaskResult>;
}

export interface CreatePythonRuntimeHttpClientOptions {
  baseUrl: string;
  fetchImplementation?: typeof fetch;
  defaultTaskTimeoutMs?: number;
}

async function parseJsonResponse<T>(response: Response, path: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`Python runtime request failed for ${path} with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function createPythonRuntimeHttpClient(
  options: CreatePythonRuntimeHttpClientOptions,
): PythonRuntimeHttpClient {
  const fetcher = options.fetchImplementation ?? fetch;
  const baseUrl = trimTrailingSlash(options.baseUrl);
  const defaultTaskTimeoutMs = options.defaultTaskTimeoutMs ?? 120_000;

  return {
    async getHealthStatus() {
      const response = await fetcher(`${baseUrl}/health`, { method: "GET" });
      const payload = await parseJsonResponse<unknown>(response, "/health");
      return mapHealthResponseFromHttpPayload(payload);
    },

    async getCapabilities() {
      const response = await fetcher(`${baseUrl}/capabilities`, { method: "GET" });
      const payload = await parseJsonResponse<unknown>(response, "/capabilities");
      return mapCapabilitiesResponseFromHttpPayload(payload);
    },

    async executeTask(request: PythonRuntimeTaskRequest) {
      const timeoutMs = request.timeoutMs ?? defaultTaskTimeoutMs;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error(`Python runtime task timed out after ${timeoutMs}ms.`)), timeoutMs);
      let response: Response;
      try {
        response = await fetcher(`${baseUrl}/tasks/execute`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(mapTaskRequestToHttpPayload({ ...request, timeoutMs })),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && (error.name === "AbortError" || error.message.includes("timed out"))) {
          throw new Error(`Python runtime task request timed out after ${timeoutMs}ms.`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      const payload = await parseJsonResponse<unknown>(response, "/tasks/execute");
      return mapTaskResponseFromHttpPayload(payload);
    },
  };
}
