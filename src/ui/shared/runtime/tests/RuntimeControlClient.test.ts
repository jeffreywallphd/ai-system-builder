import { describe, expect, it } from "bun:test";
import { HttpRuntimeControlClient } from "../RuntimeControlClient";

describe("HttpRuntimeControlClient", () => {
  it("calls authoritative runtime mutation routes with shared payload contracts", async () => {
    const requests: Array<{ method: string; url: string; authorization?: string; body?: string }> = [];
    (globalThis as typeof globalThis & {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    }).fetch = async (input, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      requests.push({
        method: String(init?.method ?? "GET"),
        url: input,
        authorization: headers?.authorization,
        body: typeof init?.body === "string" ? init.body : undefined,
      });

      const url = String(input);
      if (url.includes("/cancel")) {
        return new Response(JSON.stringify({
          ok: true,
          data: {
            executionId: "execution-1",
            status: "cancelled",
            mutation: {
              changed: true,
              mutationId: "runtime-cancel:execution-1:idempotency-1",
              occurredAt: "2026-04-07T12:00:00.000Z",
            },
          },
        }));
      }
      if (url.includes("/dequeue")) {
        return new Response(JSON.stringify({
          ok: true,
          data: {
            queueItemId: "runtime-queue:execution-1",
            executionId: "execution-1",
            status: "cancelled",
            mutation: {
              changed: false,
              mutationId: "runtime-dequeue:runtime-queue:execution-1:idempotency-2",
              occurredAt: "2026-04-07T12:00:01.000Z",
            },
          },
        }));
      }
      return new Response(JSON.stringify({
        ok: true,
        data: {
          executionId: "execution-1",
          status: "pending",
          acceptedState: "accepted",
          systemId: "system:demo",
          versionId: "system:demo:v1",
          executedVersionMap: {
            rootVersionId: "system:demo:v1",
            nodeVersionIds: {},
          },
          nestedExecutionLineage: [],
        },
      }));
    };

    const client = new HttpRuntimeControlClient("http://127.0.0.1:8788/");
    await client.startRun({
      workspaceId: "workspace-alpha",
      systemId: "system:demo",
      versionId: "system:demo:v1",
      async: true,
      idempotencyKey: "idempotency-1",
    }, "token-start");
    await client.cancelRun({
      workspaceId: "workspace-alpha",
      executionId: "execution-1",
      reason: "cancel",
      idempotencyKey: "idempotency-1",
    }, "token-cancel");
    await client.dequeueQueueItem({
      workspaceId: "workspace-alpha",
      queueItemId: "runtime-queue:execution-1",
      idempotencyKey: "idempotency-2",
    }, "token-dequeue");

    expect(requests.map((entry) => entry.method)).toEqual(["POST", "POST", "POST"]);
    expect(requests[0]?.url).toBe("http://127.0.0.1:8788/api/v1/runtime/runs/start?workspaceId=workspace-alpha");
    expect(requests[1]?.url).toBe("http://127.0.0.1:8788/api/v1/runtime/runs/execution-1/cancel?workspaceId=workspace-alpha");
    expect(requests[2]?.url).toBe("http://127.0.0.1:8788/api/v1/runtime/queue/runtime-queue%3Aexecution-1/dequeue?workspaceId=workspace-alpha");
    expect(requests[0]?.authorization).toBe("Bearer token-start");
    expect(requests[1]?.authorization).toBe("Bearer token-cancel");
    expect(requests[2]?.authorization).toBe("Bearer token-dequeue");
  });
});

