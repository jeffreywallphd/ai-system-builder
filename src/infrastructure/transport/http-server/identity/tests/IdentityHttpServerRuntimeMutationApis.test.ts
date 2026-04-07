import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import type { SystemRuntimeBackendApi } from "../../../../api/system-runtime/SystemRuntimeBackendApi";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  })));
});

class StubSystemRuntimeMutationBackendApi {
  public lastStartRequest: Readonly<Record<string, unknown>> | undefined;
  public lastCancelRequest: Readonly<Record<string, unknown>> | undefined;
  public lastDequeueRequest: Readonly<Record<string, unknown>> | undefined;

  public async startExecutionAsync(request: Readonly<Record<string, unknown>>) {
    this.lastStartRequest = request;
    return {
      ok: true as const,
      data: {
        executionId: typeof request.executionId === "string" ? request.executionId : "execution-started",
        sessionId: "runtime-session:1",
        acceptedState: "accepted" as const,
        status: "pending" as const,
        rootAssetId: request.systemId,
        rootVersionId: request.versionId,
        runtimeBehavior: {
          behaviorKind: "deterministic",
          executionPattern: "single-pass",
        },
        executedVersionMap: {
          rootVersionId: request.versionId,
          nodeVersionIds: {},
        },
        nestedExecutionLineage: [],
      },
    };
  }

  public async cancelExecution(request: Readonly<Record<string, unknown>>) {
    this.lastCancelRequest = request;
    if (request.executionId === "execution-denied") {
      return {
        ok: false as const,
        error: {
          code: "forbidden" as const,
          message: "Runtime cancellation denied.",
        },
      };
    }
    return {
      ok: true as const,
      data: {
        executionId: request.executionId,
        status: "cancelled",
        mutation: {
          changed: true,
          mutationId: "runtime-cancel:execution-1:mutation-1",
          occurredAt: "2026-04-07T12:00:00.000Z",
        },
      },
    };
  }

  public async dequeueQueueItem(request: Readonly<Record<string, unknown>>) {
    this.lastDequeueRequest = request;
    return {
      ok: true as const,
      data: {
        queueItemId: request.queueItemId,
        executionId: "execution-1",
        status: "cancelled",
        mutation: {
          changed: false,
          mutationId: "runtime-dequeue:runtime-queue:execution-1:mutation-2",
          occurredAt: "2026-04-07T12:01:00.000Z",
        },
      },
    };
  }
}

async function startServer(runtimeBackend: StubSystemRuntimeMutationBackendApi): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    systemRuntimeBackendApi: runtimeBackend as unknown as SystemRuntimeBackendApi,
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  servers.push(server);
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function registerAndLogin(baseUrl: string, username: string): Promise<string> {
  const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(registerResponse.status).toBe(200);

  const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerSubject: username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(loginResponse.status).toBe(200);
  const loginBody = await loginResponse.json();
  return loginBody.data.sessionToken as string;
}

describe("IdentityHttpServer runtime mutation routes", () => {
  it("enforces authentication and validation semantics for runtime mutations", async () => {
    const runtimeBackend = new StubSystemRuntimeMutationBackendApi();
    const baseUrl = await startServer(runtimeBackend);
    const token = await registerAndLogin(baseUrl, "runtime.http.mutation.guard.1");

    const unauthenticated = await fetch(`${baseUrl}/api/v1/runtime/runs/start?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemId: "system:demo",
        versionId: "system:demo:v1",
        async: true,
      }),
    });
    expect(unauthenticated.status).toBe(401);
    const unauthenticatedBody = await unauthenticated.json();
    expect(unauthenticatedBody.ok).toBe(false);
    expect(unauthenticatedBody.error.code).toBe("authentication-failed");

    const invalidRequest = await fetch(`${baseUrl}/api/v1/runtime/runs/start?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        systemId: "",
        versionId: "system:demo:v1",
      }),
    });
    expect(invalidRequest.status).toBe(400);
    const invalidBody = await invalidRequest.json();
    expect(invalidBody.ok).toBe(false);
    expect(invalidBody.error.code).toBe("invalid-request");
  });

  it("supports start, cancel, and dequeue runtime mutations through shared authoritative routes", async () => {
    const runtimeBackend = new StubSystemRuntimeMutationBackendApi();
    const baseUrl = await startServer(runtimeBackend);
    const token = await registerAndLogin(baseUrl, "runtime.http.mutation.success.1");

    const startResponse = await fetch(`${baseUrl}/api/v1/runtime/runs/start?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        systemId: "system:demo",
        versionId: "system:demo:v1",
        executionId: "execution-1",
        async: true,
        idempotencyKey: "mutation-1",
      }),
    });
    expect(startResponse.status).toBe(200);
    const startBody = await startResponse.json();
    expect(startBody.ok).toBe(true);
    expect(startBody.data.executionId).toBe("execution-1");
    expect(runtimeBackend.lastStartRequest?.idempotencyKey).toBe("mutation-1");

    const cancelResponse = await fetch(`${baseUrl}/api/v1/runtime/runs/execution-1/cancel?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        reason: "user-requested-cancel",
        idempotencyKey: "mutation-1",
      }),
    });
    expect(cancelResponse.status).toBe(200);
    const cancelBody = await cancelResponse.json();
    expect(cancelBody.ok).toBe(true);
    expect(cancelBody.data.executionId).toBe("execution-1");
    expect(cancelBody.data.status).toBe("cancelled");
    expect(cancelBody.data.mutation.changed).toBe(true);
    expect(runtimeBackend.lastCancelRequest?.idempotencyKey).toBe("mutation-1");

    const dequeueResponse = await fetch(`${baseUrl}/api/v1/runtime/queue/${encodeURIComponent("runtime-queue:execution-1")}/dequeue?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        dequeuedAt: "2026-04-07T12:01:00.000Z",
      }),
    });
    expect(dequeueResponse.status).toBe(200);
    const dequeueBody = await dequeueResponse.json();
    expect(dequeueBody.ok).toBe(true);
    expect(dequeueBody.data.queueItemId).toBe("runtime-queue:execution-1");
    expect(dequeueBody.data.status).toBe("cancelled");
    expect(dequeueBody.data.mutation.changed).toBe(false);
  });

  it("maps cancellation policy denials through canonical forbidden responses", async () => {
    const runtimeBackend = new StubSystemRuntimeMutationBackendApi();
    const baseUrl = await startServer(runtimeBackend);
    const token = await registerAndLogin(baseUrl, "runtime.http.mutation.denied.1");

    const denied = await fetch(`${baseUrl}/api/v1/runtime/runs/execution-denied/cancel?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    expect(denied.status).toBe(403);
    const deniedBody = await denied.json();
    expect(deniedBody.ok).toBe(false);
    expect(deniedBody.error.code).toBe("forbidden");
  });
});

