import { describe, expect, it } from "bun:test";
import { HttpRuntimeControlClient } from "../RuntimeControlClient";

describe("HttpRuntimeControlClient", () => {
  it("calls authoritative runtime read and mutation routes with shared payload contracts", async () => {
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
      if (url.includes("/status")) {
        return new Response(JSON.stringify({
          ok: true,
          data: {
            executionId: "execution-1",
            status: "running",
            rootAssetId: "system:demo",
            rootVersionId: "system:demo:v1",
            startedAt: "2026-04-07T12:00:00.000Z",
            updatedAt: "2026-04-07T12:00:01.000Z",
            progress: {
              totalNodeCount: 2,
              completedNodeCount: 1,
              failedNodeCount: 0,
              runningNodeCount: 1,
              updatedAt: "2026-04-07T12:00:01.000Z",
            },
            executedVersionMap: {
              rootVersionId: "system:demo:v1",
              nodeVersionIds: {},
            },
            nestedExecutionLineage: [],
          },
        }));
      }
      if (url.includes("/result")) {
        return new Response(JSON.stringify({
          ok: true,
          data: {
            executionId: "execution-1",
            status: "running",
            rootAssetId: "system:demo",
            rootVersionId: "system:demo:v1",
            diagnostics: [],
            outputSummary: {
              hasOutput: false,
              hasError: false,
              outputFieldCount: 0,
              contractOutputIds: [],
            },
            bounded: {
              nodeResultsTruncated: false,
              diagnosticsTruncated: false,
            },
            serialized: {
              identity: {
                executionId: "execution-1",
                status: "running",
                rootAssetId: "system:demo",
                rootVersionId: "system:demo:v1",
                startedAt: "2026-04-07T12:00:00.000Z",
              },
              summary: {
                hasOutput: false,
                hasError: false,
                outputFieldCount: 0,
                contractOutputIds: [],
                diagnosticsCount: 0,
                nodeResultCount: 0,
                nestedSystemResultCount: 0,
              },
            },
          },
        }));
      }
      if (url.includes("/trace")) {
        return new Response(JSON.stringify({
          ok: true,
          data: {
            executionId: "execution-1",
            trace: {
              events: [],
              logs: [],
            },
          },
        }));
      }
      if (url.includes("/runtime/execution/readiness?")) {
        return new Response(JSON.stringify({
          ok: true,
          data: {
            backendFamily: "adapter.comfyui.image-manipulation",
            checkedAt: "2026-04-07T12:00:02.000Z",
            readiness: "ready",
            readyForExecution: true,
            capabilities: {
              backendFamily: "adapter.comfyui.image-manipulation",
              supportsProgressPolling: true,
              supportsProgressStreaming: false,
              supportsCancellation: true,
              supportsOutputDiscovery: true,
              supportedOperationKinds: ["image-to-image"],
              supportedTranslationContractVersions: ["1.0.0"],
            },
            issues: [],
          },
        }));
      }
      if (url.includes("/runtime/queue?")) {
        return new Response(JSON.stringify({
          ok: true,
          data: {
            items: [{
              queueItemId: "runtime-queue:execution-1",
              executionId: "execution-1",
              systemId: "system:demo",
              status: "queued",
              enqueuedAt: "2026-04-07T12:00:00.000Z",
            }],
            totalCount: 1,
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
    await client.getRunStatus({
      workspaceId: "workspace-alpha",
      executionId: "execution-1",
    }, "token-status");
    await client.getRunResult({
      workspaceId: "workspace-alpha",
      executionId: "execution-1",
      nodeResultLimit: 2,
      diagnosticsLimit: 3,
    }, "token-result");
    await client.getRunTrace({
      workspaceId: "workspace-alpha",
      executionId: "execution-1",
      eventLimit: 20,
      logLimit: 25,
    }, "token-trace");
    await client.getExecutionReadiness({
      workspaceId: "workspace-alpha",
      systemId: "system:demo",
      operationKind: "image-to-image",
      translationContractVersion: "1.0.0",
    }, "token-readiness");
    await client.listQueueItems({
      workspaceId: "workspace-alpha",
      statuses: ["queued", "running"],
      limit: 10,
      offset: 5,
    }, "token-queue");
    await client.dequeueQueueItem({
      workspaceId: "workspace-alpha",
      queueItemId: "runtime-queue:execution-1",
      idempotencyKey: "idempotency-2",
    }, "token-dequeue");

    expect(requests.map((entry) => entry.method)).toEqual(["POST", "POST", "GET", "GET", "GET", "GET", "GET", "POST"]);
    expect(requests[0]?.url).toBe("http://127.0.0.1:8788/api/v1/runtime/runs/start?workspaceId=workspace-alpha");
    expect(requests[1]?.url).toBe("http://127.0.0.1:8788/api/v1/runtime/runs/execution-1/cancel?workspaceId=workspace-alpha");
    expect(requests[2]?.url).toBe("http://127.0.0.1:8788/api/v1/runtime/runs/execution-1/status?workspaceId=workspace-alpha");
    expect(requests[3]?.url).toBe("http://127.0.0.1:8788/api/v1/runtime/runs/execution-1/result?workspaceId=workspace-alpha&nodeResultLimit=2&diagnosticsLimit=3");
    expect(requests[4]?.url).toBe("http://127.0.0.1:8788/api/v1/runtime/runs/execution-1/trace?workspaceId=workspace-alpha&eventLimit=20&logLimit=25");
    expect(requests[5]?.url).toBe("http://127.0.0.1:8788/api/v1/runtime/execution/readiness?workspaceId=workspace-alpha&systemId=system%3Ademo&operationKind=image-to-image&translationContractVersion=1.0.0");
    expect(requests[6]?.url).toBe("http://127.0.0.1:8788/api/v1/runtime/queue?workspaceId=workspace-alpha&limit=10&offset=5&status=queued&status=running");
    expect(requests[7]?.url).toBe("http://127.0.0.1:8788/api/v1/runtime/queue/runtime-queue%3Aexecution-1/dequeue?workspaceId=workspace-alpha");
    expect(requests[0]?.authorization).toBe("Bearer token-start");
    expect(requests[1]?.authorization).toBe("Bearer token-cancel");
    expect(requests[2]?.authorization).toBe("Bearer token-status");
    expect(requests[3]?.authorization).toBe("Bearer token-result");
    expect(requests[4]?.authorization).toBe("Bearer token-trace");
    expect(requests[5]?.authorization).toBe("Bearer token-readiness");
    expect(requests[6]?.authorization).toBe("Bearer token-queue");
    expect(requests[7]?.authorization).toBe("Bearer token-dequeue");
  });
});

