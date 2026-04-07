import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "bun:test";
import { ExecutionCallbackEventKinds, type ExecutionCallbackRegistration } from "../../../../domain/system-runtime/ExecutionCallbackDomain";
import { HttpExecutionCallbackDispatcher, type ExecutionCallbackPayload } from "../ExecutionCallbackDispatcher";

const payload: ExecutionCallbackPayload = Object.freeze({
  callbackId: "callback-1",
  eventKind: ExecutionCallbackEventKinds.executionCompleted,
  executionId: "exec-1",
  sessionId: "session-1",
  occurredAt: "2026-03-30T12:00:00.000Z",
  status: "succeeded",
});

const registration: ExecutionCallbackRegistration = Object.freeze({
  callbackId: "callback-1",
  targetUrl: "https://callbacks.example.test/hook",
  eventKinds: Object.freeze([ExecutionCallbackEventKinds.executionCompleted]),
  secretToken: "shared-secret",
  includeResultSummary: true,
  registeredAt: "2026-03-30T12:00:00.000Z",
  maxAttempts: 1,
});

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("HttpExecutionCallbackDispatcher", () => {
  it("adds a deterministic HMAC signature header when a secret token is configured", async () => {
    let capturedSignature: string | undefined;
    globalThis.fetch = (async (_input, init) => {
      const headers = init?.headers as Record<string, string>;
      capturedSignature = headers?.["x-ai-loom-callback-signature"];
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const dispatcher = new HttpExecutionCallbackDispatcher();
    const result = await dispatcher.dispatch(registration, payload);

    expect(result.succeeded).toBeTrue();
    const expectedBody = JSON.stringify(payload);
    const expectedSignature = createHmac("sha256", registration.secretToken!)
      .update(expectedBody)
      .digest("hex");
    expect(capturedSignature).toBe(expectedSignature);
  });

  it("rejects non-secure callback targets before attempting network delivery", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const dispatcher = new HttpExecutionCallbackDispatcher();
    const result = await dispatcher.dispatch(
      Object.freeze({
        ...registration,
        targetUrl: "http://example.com/unsafe",
      }),
      payload,
    );

    expect(result.succeeded).toBeFalse();
    expect(called).toBeFalse();
    expect(result.message).toContain("https");
  });
});
