import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import type { AuthoritativeRunExecutionUpdateBackendApi } from "../../../../api/runs/AuthoritativeRunExecutionUpdateBackendApi";
import type { NodeTrustBackendApi } from "../../../../api/nodes/NodeTrustBackendApi";

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

class StubRunExecutionUpdateBackendApi {
  public lastRequest: Readonly<Record<string, unknown>> | undefined;

  public async ingestExecutionUpdate(request: Readonly<Record<string, unknown>>) {
    this.lastRequest = request;
    return Object.freeze({
      ok: true as const,
      data: Object.freeze({
        mutation: Object.freeze({
          action: "lifecycle-update",
          run: Object.freeze({
            contractVersion: "run-orchestration-transport/v1",
            runId: "run:1",
            workflowId: "workflow:demo",
            workspaceId: "workspace-alpha",
            source: "api",
            state: "running",
            assignmentStatus: "assigned",
            executionOutcome: "none",
            submittedAt: "2026-04-07T12:00:00.000Z",
            updatedAt: "2026-04-07T12:01:00.000Z",
            submission: Object.freeze({}),
            assignment: Object.freeze({
              status: "assigned",
              assignedNodeId: "node:trusted-1",
              assignedAt: "2026-04-07T12:00:00.000Z",
            }),
            execution: Object.freeze({
              outcome: "none",
              heartbeatAt: "2026-04-07T12:01:00.000Z",
              progress: Object.freeze({
                updatedAt: "2026-04-07T12:01:00.000Z",
                percent: 55,
              }),
            }),
            retry: Object.freeze({
              attempt: 1,
              maxAttempts: 2,
            }),
          }),
          mutation: Object.freeze({
            changed: true,
            mutationId: "mutation-1",
            occurredAt: "2026-04-07T12:01:00.000Z",
          }),
        }),
        status: Object.freeze({
          runId: "run:1",
          state: "running",
          updatedAt: "2026-04-07T12:01:00.000Z",
          assignmentStatus: "assigned",
          executionOutcome: "none",
          execution: Object.freeze({
            heartbeatAt: "2026-04-07T12:01:00.000Z",
            progress: Object.freeze({
              updatedAt: "2026-04-07T12:01:00.000Z",
              percent: 55,
            }),
          }),
          retry: Object.freeze({
            attempt: 1,
            maxAttempts: 2,
          }),
        }),
      }),
    });
  }
}

class StubNodeTrustBackendApi {}

async function startServer(runExecutionUpdateBackend: StubRunExecutionUpdateBackendApi): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    authoritativeRunExecutionUpdateBackendApi: runExecutionUpdateBackend as unknown as AuthoritativeRunExecutionUpdateBackendApi,
    nodeTrustBackendApi: new StubNodeTrustBackendApi() as unknown as NodeTrustBackendApi,
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

describe("IdentityHttpServer authoritative run execution update route", () => {
  it("accepts node-authenticated lifecycle updates and forwards canonical payload", async () => {
    const backend = new StubRunExecutionUpdateBackendApi();
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "node:trusted-1");

    const response = await fetch(
      `${baseUrl}/api/v1/runtime/runs/${encodeURIComponent("run:1")}/lifecycle`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          senderNodeId: "node:trusted-1",
          heartbeatAt: "2026-04-07T12:01:00.000Z",
          progress: {
            updatedAt: "2026-04-07T12:01:00.000Z",
            percent: 55,
            stage: "sampling",
          },
          execution: {
            outcome: "none",
            heartbeatAt: "2026-04-07T12:01:00.000Z",
          },
        }),
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.status.execution.progress.percent).toBe(55);
    expect(backend.lastRequest?.senderNodeId).toBe("node:trusted-1");
  });

  it("rejects stale or invalid sender identities before ingestion", async () => {
    const backend = new StubRunExecutionUpdateBackendApi();
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "node:trusted-1");

    const response = await fetch(
      `${baseUrl}/api/v1/runtime/runs/${encodeURIComponent("run:1")}/lifecycle`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          senderNodeId: "node:other",
          heartbeatAt: "2026-04-07T12:01:00.000Z",
        }),
      },
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("forbidden");
    expect(backend.lastRequest).toBeUndefined();
  });
});
