import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import type { AuthoritativeRunSubmissionBackendApi } from "../../../../api/runs/AuthoritativeRunSubmissionBackendApi";

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

class StubAuthoritativeRunSubmissionBackendApi {
  public lastSubmissionRequest: Readonly<Record<string, unknown>> | undefined;
  public nextResponse: Readonly<Record<string, unknown>> = Object.freeze({
    ok: true,
    data: Object.freeze({
      run: Object.freeze({
        contractVersion: "run-orchestration-transport/v1",
        runId: "run:1",
        workflowId: "system:system-demo:version-1",
        workspaceId: "workspace-alpha",
        source: "api",
        state: "submitted",
        assignmentStatus: "unassigned",
        executionOutcome: "none",
        submittedAt: "2026-04-07T12:00:00.000Z",
        updatedAt: "2026-04-07T12:00:00.000Z",
        submission: Object.freeze({
          submittedByActorId: "user:submission",
        }),
        assignment: Object.freeze({
          status: "unassigned",
        }),
        execution: Object.freeze({
          outcome: "none",
        }),
        retry: Object.freeze({
          attempt: 1,
          maxAttempts: 1,
        }),
      }),
      mutation: Object.freeze({
        changed: true,
        mutationId: "audit:run:1",
        occurredAt: "2026-04-07T12:00:00.000Z",
      }),
    }),
  });

  public async submitRun(request: Readonly<Record<string, unknown>>) {
    this.lastSubmissionRequest = request;
    return this.nextResponse;
  }
}

async function startServer(runSubmissionBackend: StubAuthoritativeRunSubmissionBackendApi): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    authoritativeRunSubmissionBackendApi: runSubmissionBackend as unknown as AuthoritativeRunSubmissionBackendApi,
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

describe("IdentityHttpServer authoritative run submission route", () => {
  it("enforces authenticated workspace session before authoritative run submission", async () => {
    const backend = new StubAuthoritativeRunSubmissionBackendApi();
    const baseUrl = await startServer(backend);

    const unauthenticated = await fetch(`${baseUrl}/api/v1/runtime/runs/start?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runtimeTarget: {
          systemId: "system-demo",
          versionId: "version-1",
          async: true,
        },
      }),
    });

    expect(unauthenticated.status).toBe(401);
    const body = await unauthenticated.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("authentication-failed");
  });

  it("rejects actor/workspace context mismatches with stable invalid-request semantics", async () => {
    const backend = new StubAuthoritativeRunSubmissionBackendApi();
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.mismatch.1");

    const mismatchedWorkspace = await fetch(`${baseUrl}/api/v1/runtime/runs/start?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        workspaceId: "workspace-beta",
        runtimeTarget: {
          systemId: "system-demo",
          versionId: "version-1",
          async: true,
        },
      }),
    });
    expect(mismatchedWorkspace.status).toBe(400);
    const mismatchedWorkspaceBody = await mismatchedWorkspace.json();
    expect(mismatchedWorkspaceBody.ok).toBe(false);
    expect(mismatchedWorkspaceBody.error.code).toBe("invalid-request");

    const mismatchedActor = await fetch(`${baseUrl}/api/v1/runtime/runs/start?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        submittedByActorId: "user:spoofed",
        runtimeTarget: {
          systemId: "system-demo",
          versionId: "version-1",
          async: true,
        },
      }),
    });
    expect(mismatchedActor.status).toBe(400);
    const mismatchedActorBody = await mismatchedActor.json();
    expect(mismatchedActorBody.ok).toBe(false);
    expect(mismatchedActorBody.error.code).toBe("invalid-request");
  });

  it("returns canonical run submission acceptance payload and forwards enforced context", async () => {
    const backend = new StubAuthoritativeRunSubmissionBackendApi();
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.success.1");

    const response = await fetch(`${baseUrl}/api/v1/runtime/runs/start?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        runtimeTarget: {
          systemId: "system-demo",
          versionId: "version-1",
          async: true,
        },
        source: "api",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.run.runId).toBe("run:1");
    expect(body.data.run.state).toBe("submitted");
    expect(body.data.mutation.changed).toBe(true);

    expect(backend.lastSubmissionRequest?.workspaceId).toBe("workspace-alpha");
    expect(backend.lastSubmissionRequest?.actorUserIdentityId).toBeDefined();
  });

  it("maps backend denial semantics to stable HTTP + error envelopes", async () => {
    const backend = new StubAuthoritativeRunSubmissionBackendApi();
    backend.nextResponse = Object.freeze({
      ok: false,
      error: Object.freeze({
        code: "not-found",
        message: "Run submission target was not found.",
      }),
    });
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.denied.1");

    const notFound = await fetch(`${baseUrl}/api/v1/runtime/runs/start?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        runtimeTarget: {
          systemId: "system-demo",
          versionId: "version-1",
          async: true,
        },
      }),
    });

    expect(notFound.status).toBe(404);
    const body = await notFound.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("not-found");
  });
});
