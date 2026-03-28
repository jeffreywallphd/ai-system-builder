import { createHmac } from "node:crypto";
import type {
  ExecutionCallbackDeliveryResult,
  ExecutionCallbackEventKind,
  ExecutionCallbackRegistration,
} from "../../../domain/system-runtime/ExecutionCallbackDomain";

export interface ExecutionCallbackPayload {
  readonly callbackId: string;
  readonly eventKind: ExecutionCallbackEventKind;
  readonly executionId: string;
  readonly sessionId?: string;
  readonly occurredAt: string;
  readonly status: string;
  readonly summary?: {
    readonly rootAssetId?: string;
    readonly rootVersionId?: string;
    readonly completedAt?: string;
    readonly outputSummary?: unknown;
    readonly diagnostics?: ReadonlyArray<{
      readonly source: "output" | "runtime-error" | "trace-log";
      readonly severity: "info" | "warning" | "error";
      readonly code?: string;
      readonly message: string;
      readonly nodeId?: string;
      readonly at?: string;
    }>;
  };
}

export interface ExecutionCallbackDispatcher {
  dispatch(
    registration: ExecutionCallbackRegistration,
    payload: ExecutionCallbackPayload,
  ): Promise<ExecutionCallbackDeliveryResult>;
}

function isSecureTarget(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol === "https:") {
      return true;
    }
    if (parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export class HttpExecutionCallbackDispatcher implements ExecutionCallbackDispatcher {
  public async dispatch(
    registration: ExecutionCallbackRegistration,
    payload: ExecutionCallbackPayload,
  ): Promise<ExecutionCallbackDeliveryResult> {
    if (!isSecureTarget(registration.targetUrl)) {
      return Object.freeze({
        callbackId: registration.callbackId,
        eventKind: payload.eventKind,
        executionId: payload.executionId,
        deliveredAt: new Date().toISOString(),
        attemptCount: 0,
        succeeded: false,
        message: "Callback target must use https (or localhost http for development).",
      });
    }

    const maxAttempts = Math.max(1, Math.min(3, registration.maxAttempts));
    let latest: ExecutionCallbackDeliveryResult | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const body = JSON.stringify(payload);
        const headers: Record<string, string> = {
          "content-type": "application/json",
          "x-ai-loom-callback-id": registration.callbackId,
          "x-ai-loom-callback-event": payload.eventKind,
          ...registration.headers,
        };
        if (registration.secretToken) {
          headers["x-ai-loom-callback-signature"] = createHmac("sha256", registration.secretToken).update(body).digest("hex");
        }
        const response = await fetch(registration.targetUrl, {
          method: "POST",
          headers,
          body,
        });
        if (response.ok) {
          return Object.freeze({
            callbackId: registration.callbackId,
            eventKind: payload.eventKind,
            executionId: payload.executionId,
            deliveredAt: new Date().toISOString(),
            attemptCount: attempt,
            succeeded: true,
            statusCode: response.status,
            message: "Callback delivered.",
          });
        }
        latest = Object.freeze({
          callbackId: registration.callbackId,
          eventKind: payload.eventKind,
          executionId: payload.executionId,
          deliveredAt: new Date().toISOString(),
          attemptCount: attempt,
          succeeded: false,
          statusCode: response.status,
          message: `Callback returned HTTP ${response.status}.`,
        });
      } catch (error) {
        latest = Object.freeze({
          callbackId: registration.callbackId,
          eventKind: payload.eventKind,
          executionId: payload.executionId,
          deliveredAt: new Date().toISOString(),
          attemptCount: attempt,
          succeeded: false,
          message: error instanceof Error ? error.message : "Callback delivery failed.",
        });
      }
    }
    return latest ?? Object.freeze({
      callbackId: registration.callbackId,
      eventKind: payload.eventKind,
      executionId: payload.executionId,
      deliveredAt: new Date().toISOString(),
      attemptCount: 0,
      succeeded: false,
      message: "Callback delivery failed.",
    });
  }
}
