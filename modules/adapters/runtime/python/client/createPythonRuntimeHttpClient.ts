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
      const response = await fetcher(`${baseUrl}/tasks/execute`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(mapTaskRequestToHttpPayload(request)),
      });

      const payload = await parseJsonResponse<unknown>(response, "/tasks/execute");
      return mapTaskResponseFromHttpPayload(payload);
    },
  };
}
