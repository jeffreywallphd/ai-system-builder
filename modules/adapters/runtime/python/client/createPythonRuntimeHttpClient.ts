import type {
  CancelPythonRuntimeTaskResult,
  PythonRuntimeTaskStatusResult,
  PythonRuntimeCapabilitiesResult,
  PythonRuntimeHealthCheckResult,
  PythonRuntimeModelStatusResult,
  StartPythonRuntimeTaskRequest,
  StartPythonRuntimeTaskResult,
  PythonRuntimeUnloadModelsResult,
} from "../../../../contracts/runtime";
import { randomUUID } from "node:crypto";

import {
  mapCancelTaskResponse,
  mapCapabilitiesResponseFromHttpPayload,
  mapHealthResponseFromHttpPayload,
  mapModelStatusResponseFromHttpPayload,
  mapStartTaskRequest,
  mapStartTaskResponse,
  mapTaskStatusResponse,
  mapUnloadModelsResponseFromHttpPayload,
} from "../protocol/pythonRuntimeHttpProtocol";

export interface PythonRuntimeHttpClient {
  getHealthStatus(): Promise<PythonRuntimeHealthCheckResult>;
  getCapabilities(): Promise<PythonRuntimeCapabilitiesResult>;
  ensureModelDownloaded(request: { provider: "transformers"; modelId: string }): Promise<{
    provider: "transformers";
    modelId: string;
    downloaded: boolean;
    fromCache: boolean;
    localPath?: string;
  }>;
  getModelStatus(): Promise<PythonRuntimeModelStatusResult>;
  unloadModels(): Promise<PythonRuntimeUnloadModelsResult>;
  startTask(request: StartPythonRuntimeTaskRequest): Promise<StartPythonRuntimeTaskResult>;
  readTaskStatus(requestId: string): Promise<PythonRuntimeTaskStatusResult>;
  cancelTask(requestId: string): Promise<CancelPythonRuntimeTaskResult>;
}

export interface CreatePythonRuntimeHttpClientOptions {
  baseUrl: string;
  fetchImplementation?: typeof fetch;
  defaultTaskTimeoutMs?: number;
  transportRequestTimeoutMs?: number;
  modelDownloadTimeoutMs?: number;
  modelDownloadPollIntervalMs?: number;
}

async function parseJsonResponseSafe(
  response: Response,
): Promise<unknown | undefined> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function throwNonJsonResponseError(endpoint: string, status: number): never {
  throw new Error(
    `Python runtime request failed for ${endpoint} with status ${status} and invalid JSON response body.`,
  );
}

function mapRuntimeResponsePayload<T>(
  endpoint: string,
  response: Response,
  payload: unknown | undefined,
  mapper: (value: unknown) => T,
): T {
  if (payload === undefined) {
    return throwNonJsonResponseError(endpoint, response.status);
  }

  try {
    return mapper(payload);
  } catch {
    if (!response.ok) {
      throw new Error(
        `Python runtime request failed for ${endpoint} with status ${response.status} and invalid structured payload.`,
      );
    }

    throw new Error(`Python runtime request failed for ${endpoint} with invalid JSON response body.`);
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function mapModelDownloadPayload(endpoint: string, payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`Python runtime request failed for ${endpoint} with invalid structured payload.`);
  }

  const record = payload as Record<string, unknown>;
  if (record.provider !== "transformers" || typeof record.modelId !== "string") {
    throw new Error(`Python runtime request failed for ${endpoint} with invalid structured payload.`);
  }

  return {
    provider: "transformers" as const,
    modelId: record.modelId,
    downloaded: record.downloaded === true,
    fromCache: record.fromCache === true,
    localPath: typeof record.localPath === "string" && record.localPath.length > 0 ? record.localPath : undefined,
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function summarizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && code.length > 0) {
    return code;
  }

  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") {
    return undefined;
  }

  const causeCode = (cause as { code?: unknown }).code;
  return typeof causeCode === "string" && causeCode.length > 0 ? causeCode : undefined;
}

function isRecoverableRuntimePollError(error: unknown): boolean {
  const message = summarizeError(error).toLowerCase();
  const code = readErrorCode(error);

  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("terminated") ||
    code?.startsWith("UND_ERR_") === true ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "EPIPE" ||
    code === "EAI_AGAIN"
  );
}

export function createPythonRuntimeHttpClient(
  options: CreatePythonRuntimeHttpClientOptions,
): PythonRuntimeHttpClient {
  const fetcher = options.fetchImplementation ?? fetch;
  const baseUrl = trimTrailingSlash(options.baseUrl);
  const defaultTaskTimeoutMs = options.defaultTaskTimeoutMs ?? 120_000;
  const transportRequestTimeoutMs = options.transportRequestTimeoutMs ?? 9 * 60 * 1000;
  const modelDownloadTimeoutMs = options.modelDownloadTimeoutMs ?? 2 * 60 * 60 * 1000;
  const modelDownloadPollIntervalMs = options.modelDownloadPollIntervalMs ?? 2_000;

  return {
    async getHealthStatus() {
      const response = await fetcher(`${baseUrl}/health`, { method: "GET" });
      const payload = await parseJsonResponseSafe(response);
      return mapRuntimeResponsePayload("/health", response, payload, mapHealthResponseFromHttpPayload);
    },

    async getCapabilities() {
      const response = await fetcher(`${baseUrl}/capabilities`, { method: "GET" });
      const payload = await parseJsonResponseSafe(response);
      return mapRuntimeResponsePayload("/capabilities", response, payload, mapCapabilitiesResponseFromHttpPayload);
    },

    async ensureModelDownloaded(request) {
      const requestId = `model-download-${randomUUID()}`;
      await this.startTask({
        requestId,
        taskType: "ensure-model-download",
        payload: request,
        timeoutMs: modelDownloadTimeoutMs,
        metadata: {
          provider: request.provider,
          modelId: request.modelId,
          operation: "model.download",
        },
      });

      const deadline = Date.now() + modelDownloadTimeoutMs;
      let recoverablePollFailureCount = 0;
      let lastRecoverablePollFailure: string | undefined;
      while (Date.now() <= deadline) {
        let status: PythonRuntimeTaskStatusResult;
        try {
          status = await this.readTaskStatus(requestId);
        } catch (error) {
          if (!isRecoverableRuntimePollError(error)) {
            throw error;
          }

          recoverablePollFailureCount += 1;
          lastRecoverablePollFailure = summarizeError(error);
          await delay(modelDownloadPollIntervalMs);
          continue;
        }

        if (status.status === "succeeded") {
          return mapModelDownloadPayload(`/tasks/${requestId}`, status.data);
        }
        if (status.status === "failed" || status.status === "cancelled") {
          const message = status.error?.message ?? `Python runtime model download task ended with status ${status.status}.`;
          throw new Error(`Python runtime model download failed: ${message}`);
        }
        await delay(modelDownloadPollIntervalMs);
      }

      const pollFailureDetail = recoverablePollFailureCount > 0
        ? ` Last runtime task polling error after ${recoverablePollFailureCount} recoverable failure(s): ${lastRecoverablePollFailure}.`
        : "";
      throw new Error(`Python runtime model download timed out after ${modelDownloadTimeoutMs}ms.${pollFailureDetail}`);
    },

    async getModelStatus() {
      const response = await fetcher(`${baseUrl}/models/status`, { method: "GET" });
      const payload = await parseJsonResponseSafe(response);
      return mapRuntimeResponsePayload("/models/status", response, payload, mapModelStatusResponseFromHttpPayload);
    },

    async unloadModels() {
      const response = await fetcher(`${baseUrl}/models/unload`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
      });
      const payload = await parseJsonResponseSafe(response);
      if (!response.ok && payload && typeof payload === "object" && "error" in payload) {
        const error = (payload as { error?: { message?: unknown } }).error;
        const message = typeof error?.message === "string"
          ? error.message
          : `Python runtime request failed for /models/unload with status ${response.status}.`;
        throw new Error(`Python runtime model unload failed: ${message}`);
      }

      return mapRuntimeResponsePayload("/models/unload", response, payload, mapUnloadModelsResponseFromHttpPayload);
    },
    async startTask(request: StartPythonRuntimeTaskRequest) {
      const response = await fetcher(`${baseUrl}/tasks/start`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(mapStartTaskRequest(request)),
      });
      const payload = await parseJsonResponseSafe(response);
      return mapRuntimeResponsePayload("/tasks/start", response, payload, mapStartTaskResponse);
    },
    async readTaskStatus(requestId: string) {
      const response = await fetcher(`${baseUrl}/tasks/${encodeURIComponent(requestId)}`, { method: "GET" });
      const payload = await parseJsonResponseSafe(response);
      return mapRuntimeResponsePayload(`/tasks/${requestId}`, response, payload, mapTaskStatusResponse);
    },
    async cancelTask(requestId: string) {
      const response = await fetcher(`${baseUrl}/tasks/${encodeURIComponent(requestId)}/cancel`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
      });
      const payload = await parseJsonResponseSafe(response);
      return mapRuntimeResponsePayload(`/tasks/${requestId}/cancel`, response, payload, mapCancelTaskResponse);
    },
  };
}
