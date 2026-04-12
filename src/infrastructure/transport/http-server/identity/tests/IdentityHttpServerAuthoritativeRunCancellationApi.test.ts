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
  public lastCancellationRequest: Readonly<Record<string, unknown>> | undefined;

  public async cancelRun(request: Readonly<Record<string, unknown>>) {
    this.lastCancellationRequest = request;
    return Object.freeze({
      ok: true as const,
      data: Object.freeze({
        action: "cancel",
        run: Object.freeze({
          contractVersion: "run-orchestration-transport/v1",
          runId: "run:1",
          workflowId: "workflow:demo",
          workspaceId: "workspace-alpha",
          source: "api",
          state: "cancelling",
          assignmentStatus: "assigned",
          executionOutcome: "none",
          submittedAt: "2026-04-07T12:00:00.000Z",
          updatedAt: "2026-04-07T12:10:00.000Z",
          submission: Object.freeze({
            submittedByActorId: "user:owner",
          }),
          assignment: Object.freeze({
            status: "assigned",
            assignedNodeId: "node:trusted-1",
            assignedAt: "2026-04-07T12:01:00.000Z",
          }),
          execution: Object.freeze({
            outcome: "none",
          }),
          cancellation: Object.freeze({
            requestedAt: "2026-04-07T12:10:00.000Z",
            requestedByActorId: "user:ops",
          }),
          retry: Object.freeze({
            attempt: 1,
            maxAttempts: 3,
          }),
        }),
        mutation: Object.freeze({
          changed: true,
          mutationId: "run:cancel:run:1:cancel:1",
          occurredAt: "2026-04-07T12:10:00.000Z",
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

describe("IdentityHttpServer authoritative run cancellation route", () => {
  it("accepts authenticated cancellation requests and forwards canonical payload", async () => {
    const backend = new StubAuthoritativeRunMutationBackendApi();
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.cancel.1");

    const response = await fetch(`${baseUrl}/api/v1/runtime/runs/${encodeURIComponent("run:1")}/cancel?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        reason: "operator requested",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.action).toBe("cancel");
    expect(body.data.run.state).toBe("cancelling");
    expect(backend.lastCancellationRequest?.workspaceId).toBe("workspace-alpha");
  });

  it("rejects actor spoofing in cancellation payload", async () => {
    const backend = new StubAuthoritativeRunMutationBackendApi();
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.cancel.2");

    const response = await fetch(`${baseUrl}/api/v1/runtime/runs/${encodeURIComponent("run:1")}/cancel?workspaceId=workspace-alpha`, {
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
    expect(backend.lastCancellationRequest).toBeUndefined();
  });
});
