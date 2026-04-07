import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import type { AuthoritativeRunQueryBackendApi } from "../../../../api/runs/AuthoritativeRunQueryBackendApi";

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

class StubAuthoritativeRunQueryBackendApi {
  public lastListRequest: Readonly<Record<string, unknown>> | undefined;
  public lastDetailRequest: Readonly<Record<string, unknown>> | undefined;
  public lastStatusRequest: Readonly<Record<string, unknown>> | undefined;

  public async listRuns(request: Readonly<Record<string, unknown>>) {
    this.lastListRequest = request;
    return {
      ok: true as const,
      data: {
        items: [{
          contractVersion: "run-orchestration-transport/v1",
          runId: "run:1",
          workflowId: "workflow:1",
          workspaceId: "workspace-alpha",
          source: "api",
          state: "running",
          assignmentStatus: "assigned",
          executionOutcome: "none",
          submittedAt: "2026-04-07T10:00:00.000Z",
          updatedAt: "2026-04-07T10:01:00.000Z",
        }],
        totalCount: 1,
      },
    };
  }

  public async getRunDetail(request: Readonly<Record<string, unknown>>) {
    this.lastDetailRequest = request;
    if (request.runId === "run:missing") {
      return {
        ok: false as const,
        error: {
          code: "not-found" as const,
          message: "Run was not found.",
        },
      };
    }
    return {
      ok: true as const,
      data: {
        contractVersion: "run-orchestration-transport/v1",
        runId: "run:1",
        workflowId: "workflow:1",
        workspaceId: "workspace-alpha",
        source: "api",
        state: "running",
        assignmentStatus: "assigned",
        executionOutcome: "none",
        submittedAt: "2026-04-07T10:00:00.000Z",
        updatedAt: "2026-04-07T10:01:00.000Z",
        submission: {
          submittedByActorId: "user:owner",
        },
        assignment: {
          status: "assigned",
        },
        execution: {
          outcome: "none",
        },
        retry: {
          attempt: 1,
          maxAttempts: 1,
        },
      },
    };
  }

  public async getRunStatus(request: Readonly<Record<string, unknown>>) {
    this.lastStatusRequest = request;
    return {
      ok: true as const,
      data: {
        runId: "run:1",
        state: "running",
        updatedAt: "2026-04-07T10:01:00.000Z",
        assignmentStatus: "assigned",
        executionOutcome: "none",
        retry: {
          attempt: 1,
          maxAttempts: 1,
        },
      },
    };
  }
}

async function startServer(runQueryBackend: StubAuthoritativeRunQueryBackendApi): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    authoritativeRunQueryBackendApi: runQueryBackend as unknown as AuthoritativeRunQueryBackendApi,
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

describe("IdentityHttpServer authoritative run read routes", () => {
  it("enforces authentication and workspace guards for run list reads", async () => {
    const backend = new StubAuthoritativeRunQueryBackendApi();
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.read.guard.1");

    const unauthenticated = await fetch(`${baseUrl}/api/v1/runtime/runs?workspaceId=workspace-alpha`);
    expect(unauthenticated.status).toBe(401);
    const unauthenticatedBody = await unauthenticated.json();
    expect(unauthenticatedBody.ok).toBe(false);
    expect(unauthenticatedBody.error.code).toBe("authentication-failed");

    const missingWorkspace = await fetch(`${baseUrl}/api/v1/runtime/runs`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(missingWorkspace.status).toBe(400);
    const missingWorkspaceBody = await missingWorkspace.json();
    expect(missingWorkspaceBody.ok).toBe(false);
    expect(missingWorkspaceBody.error.code).toBe("invalid-request");
  });

  it("supports authoritative list/detail/status reads with canonical request parsing", async () => {
    const backend = new StubAuthoritativeRunQueryBackendApi();
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.read.success.1");

    const listResponse = await fetch(
      `${baseUrl}/api/v1/runtime/runs?workspaceId=workspace-alpha&state=running&source=api&limit=1&offset=0&sortBy=updatedAt&sortDirection=desc&search=workflow`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.data.items).toHaveLength(1);
    expect(backend.lastListRequest?.workspaceId).toBe("workspace-alpha");
    expect(backend.lastListRequest?.limit).toBe(1);
    expect(backend.lastListRequest?.sortBy).toBe("updatedAt");

    const detailResponse = await fetch(
      `${baseUrl}/api/v1/runtime/runs/${encodeURIComponent("run:1")}?workspaceId=workspace-alpha`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.ok).toBe(true);
    expect(detailBody.data.runId).toBe("run:1");
    expect(backend.lastDetailRequest?.runId).toBe("run:1");

    const statusResponse = await fetch(
      `${baseUrl}/api/v1/runtime/runs/${encodeURIComponent("run:1")}/status?workspaceId=workspace-alpha`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    expect(statusResponse.status).toBe(200);
    const statusBody = await statusResponse.json();
    expect(statusBody.ok).toBe(true);
    expect(statusBody.data.runId).toBe("run:1");
    expect(statusBody.data.submission).toBeUndefined();
  });

  it("maps non-leaky run detail misses to canonical not-found", async () => {
    const backend = new StubAuthoritativeRunQueryBackendApi();
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.read.notfound.1");

    const response = await fetch(
      `${baseUrl}/api/v1/runtime/runs/${encodeURIComponent("run:missing")}?workspaceId=workspace-alpha`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("not-found");
  });
});

