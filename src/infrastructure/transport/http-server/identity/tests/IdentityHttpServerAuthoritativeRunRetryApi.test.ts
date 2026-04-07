import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import type { AuthoritativeRunMutationBackendApi } from "../../../../api/runs/AuthoritativeRunMutationBackendApi";

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

class StubAuthoritativeRunMutationBackendApi {
  public lastRetryRequest: Readonly<Record<string, unknown>> | undefined;

  public async cancelRun(_request: Readonly<Record<string, unknown>>) {
    return Object.freeze({
      ok: false as const,
      error: Object.freeze({
        code: "invalid-request",
        message: "not-used",
      }),
    });
  }

  public async retryRun(request: Readonly<Record<string, unknown>>) {
    this.lastRetryRequest = request;
    return Object.freeze({
      ok: true as const,
      data: Object.freeze({
        action: "retry",
        run: Object.freeze({
          contractVersion: "run-orchestration-transport/v1",
          runId: "run:retry-1",
          workflowId: "workflow:demo",
          workspaceId: "workspace-alpha",
          source: "ui-rerun",
          state: "queued",
          assignmentStatus: "unassigned",
          executionOutcome: "none",
          submittedAt: "2026-04-07T12:11:00.000Z",
          updatedAt: "2026-04-07T12:11:00.000Z",
          submission: Object.freeze({
            submittedByActorId: "user:ops",
          }),
          assignment: Object.freeze({
            status: "unassigned",
          }),
          execution: Object.freeze({
            outcome: "none",
          }),
          retry: Object.freeze({
            attempt: 2,
            maxAttempts: 3,
            previousRunId: "run:1",
            retryReason: "operator retry",
            queuedAt: "2026-04-07T12:11:00.000Z",
          }),
        }),
        mutation: Object.freeze({
          changed: true,
          mutationId: "audit:retry:1",
          occurredAt: "2026-04-07T12:11:00.000Z",
        }),
      }),
    });
  }
}

async function startServer(runMutationBackend: StubAuthoritativeRunMutationBackendApi): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    authoritativeRunMutationBackendApi: runMutationBackend as unknown as AuthoritativeRunMutationBackendApi,
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

describe("IdentityHttpServer authoritative run retry route", () => {
  it("accepts authenticated retry requests and forwards canonical payload", async () => {
    const backend = new StubAuthoritativeRunMutationBackendApi();
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.retry.1");

    const response = await fetch(`${baseUrl}/api/v1/runtime/runs/${encodeURIComponent("run:1")}/retry?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        reason: "operator retry",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.action).toBe("retry");
    expect(body.data.run.retry.previousRunId).toBe("run:1");
    expect(backend.lastRetryRequest?.workspaceId).toBe("workspace-alpha");
  });

  it("rejects actor spoofing in retry payload", async () => {
    const backend = new StubAuthoritativeRunMutationBackendApi();
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.retry.2");

    const response = await fetch(`${baseUrl}/api/v1/runtime/runs/${encodeURIComponent("run:1")}/retry?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        requestedByActorId: "user:spoofed",
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid-request");
    expect(backend.lastRetryRequest).toBeUndefined();
  });
});
