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

class StubSystemRuntimeBackendApi {
  public lastQueueRequest: {
    readonly workspaceId: string;
    readonly statuses?: ReadonlyArray<string>;
    readonly limit?: number;
    readonly offset?: number;
  } | undefined;

  public async getExecutionStatus(
    executionId: string,
    requestContext?: { readonly accessContext?: { readonly metadata?: Readonly<Record<string, unknown>> } },
  ) {
    const workspaceId = requestContext?.accessContext?.metadata?.activeWorkspaceId;
    if (workspaceId === "workspace-denied") {
      return {
        ok: false as const,
        error: {
          code: "forbidden" as const,
          message: "Runtime access denied.",
        },
      };
    }
    if (executionId !== "execution-1") {
      return {
        ok: false as const,
        error: {
          code: "not-found" as const,
          message: "Execution was not found.",
        },
      };
    }
    return {
      ok: true as const,
      data: {
        executionId: "execution-1",
        status: "running" as const,
        rootAssetId: "system:demo",
        rootVersionId: "system:demo:v1",
        startedAt: "2026-04-06T12:00:00.000Z",
        updatedAt: "2026-04-06T12:01:00.000Z",
        progress: {
          totalNodeCount: 3,
          completedNodeCount: 1,
          failedNodeCount: 0,
          runningNodeCount: 1,
          updatedAt: "2026-04-06T12:01:00.000Z",
        },
        errorCount: 0,
        nodeStatuses: [],
        nestedSystems: [],
        recovery: {
          decisionCount: 0,
          retryDecisionCount: 0,
        },
        executedVersionMap: {
          rootVersionId: "system:demo:v1",
          nodeVersionIds: {},
        },
        nestedExecutionLineage: [],
      },
    };
  }

  public async getExecutionResultBounded() {
    return {
      ok: true as const,
      data: {
        executionId: "execution-1",
        status: "running" as const,
        rootAssetId: "system:demo",
        rootVersionId: "system:demo:v1",
        outputSummary: {
          hasOutput: true,
          hasError: false,
          outputFieldCount: 1,
          contractOutputIds: ["response"],
        },
        nodeResults: [],
        nestedSystemResults: [],
        diagnostics: [],
        executedVersionMap: {
          rootVersionId: "system:demo:v1",
          nodeVersionIds: {},
        },
        nestedExecutionLineage: [],
        serialized: {
          identity: {
            executionId: "execution-1",
            status: "running",
            rootAssetId: "system:demo",
            rootVersionId: "system:demo:v1",
            startedAt: "2026-04-06T12:00:00.000Z",
          },
          summary: {
            hasOutput: true,
            hasError: false,
            outputFieldCount: 1,
            contractOutputIds: ["response"],
            diagnosticsCount: 0,
            nodeResultCount: 0,
            nestedSystemResultCount: 0,
          },
        },
      },
    };
  }

  public async getExecutionTrace() {
    return {
      ok: true as const,
      data: {
        executionId: "execution-1",
        trace: {
          events: [],
          logs: [],
        },
      },
    };
  }

  public async listQueueItems(request: {
    readonly workspaceId: string;
    readonly statuses?: ReadonlyArray<string>;
    readonly limit?: number;
    readonly offset?: number;
  }) {
    this.lastQueueRequest = request;
    const allItems = [
      {
        queueItemId: "runtime-queue:execution-1",
        executionId: "execution-1",
        systemId: "system:demo",
        status: "running",
        enqueuedAt: "2026-04-06T12:00:00.000Z",
      },
      {
        queueItemId: "runtime-queue:execution-2",
        executionId: "execution-2",
        systemId: "system:demo",
        status: "queued",
        enqueuedAt: "2026-04-06T11:59:00.000Z",
      },
    ] as const;
    const filtered = request.statuses && request.statuses.length > 0
      ? allItems.filter((item) => request.statuses?.includes(item.status))
      : allItems;
    const offset = request.offset ?? 0;
    const limit = request.limit ?? filtered.length;
    return {
      ok: true as const,
      data: {
        items: filtered.slice(offset, offset + limit),
        totalCount: filtered.length,
      },
    };
  }
}

async function startServer(runtimeBackend: StubSystemRuntimeBackendApi): Promise<string> {
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

describe("IdentityHttpServer runtime read/list routes", () => {
  it("enforces auth and workspace scope guard semantics for runtime reads", async () => {
    const runtimeBackend = new StubSystemRuntimeBackendApi();
    const baseUrl = await startServer(runtimeBackend);
    const token = await registerAndLogin(baseUrl, "runtime.http.guard.1");

    const unauthenticated = await fetch(`${baseUrl}/api/v1/runtime/queue?workspaceId=workspace-alpha`);
    expect(unauthenticated.status).toBe(401);
    const unauthenticatedBody = await unauthenticated.json();
    expect(unauthenticatedBody.ok).toBe(false);
    expect(unauthenticatedBody.error.code).toBe("authentication-failed");

    const missingWorkspace = await fetch(`${baseUrl}/api/v1/runtime/queue`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(missingWorkspace.status).toBe(400);
    const missingWorkspaceBody = await missingWorkspace.json();
    expect(missingWorkspaceBody.ok).toBe(false);
    expect(missingWorkspaceBody.error.code).toBe("invalid-request");
  });

  it("supports queue list pagination and repeated status filters", async () => {
    const runtimeBackend = new StubSystemRuntimeBackendApi();
    const baseUrl = await startServer(runtimeBackend);
    const token = await registerAndLogin(baseUrl, "runtime.http.queue.1");

    const response = await fetch(
      `${baseUrl}/api/v1/runtime/queue?workspaceId=workspace-alpha&status=queued&status=running&limit=1&offset=1`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.totalCount).toBe(2);
    expect(runtimeBackend.lastQueueRequest?.workspaceId).toBe("workspace-alpha");
    expect(runtimeBackend.lastQueueRequest?.limit).toBe(1);
    expect(runtimeBackend.lastQueueRequest?.offset).toBe(1);
    expect(runtimeBackend.lastQueueRequest?.statuses).toEqual(["queued", "running"]);
  });

  it("maps runtime policy denials through canonical forbidden responses", async () => {
    const runtimeBackend = new StubSystemRuntimeBackendApi();
    const baseUrl = await startServer(runtimeBackend);
    const token = await registerAndLogin(baseUrl, "runtime.http.denied.1");

    const response = await fetch(
      `${baseUrl}/api/v1/runtime/runs/execution-1/status?workspaceId=workspace-denied`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("forbidden");
  });

  it("returns invalid-request for malformed runtime pagination inputs", async () => {
    const runtimeBackend = new StubSystemRuntimeBackendApi();
    const baseUrl = await startServer(runtimeBackend);
    const token = await registerAndLogin(baseUrl, "runtime.http.invalid.1");

    const response = await fetch(
      `${baseUrl}/api/v1/runtime/queue?workspaceId=workspace-alpha&limit=0`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid-request");
  });
});
