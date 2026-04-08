import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import type { AuthoritativeRunSubmissionBackendApi } from "../../../../api/runs/AuthoritativeRunSubmissionBackendApi";
import type { AuthoritativeRunQueryBackendApi } from "../../../../api/runs/AuthoritativeRunQueryBackendApi";
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

class StubAuthoritativeRunSubmissionBackendApi {
  public lastSubmissionRequest: Readonly<Record<string, unknown>> | undefined;

  public async submitRun(request: Readonly<Record<string, unknown>>) {
    this.lastSubmissionRequest = request;
    return Object.freeze({
      ok: true as const,
      data: Object.freeze({
        run: Object.freeze({
          contractVersion: "run-orchestration-transport/v1",
          runId: "run:1",
          workflowId: "system:system-demo:v1",
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
  }
}

class StubAuthoritativeRunQueryBackendApi {
  public lastListRequest: Readonly<Record<string, unknown>> | undefined;
  public lastDetailRequest: Readonly<Record<string, unknown>> | undefined;

  public async listRuns(request: Readonly<Record<string, unknown>>) {
    this.lastListRequest = request;
    return Object.freeze({
      ok: true as const,
      data: Object.freeze({
        items: Object.freeze([Object.freeze({
          contractVersion: "run-orchestration-transport/v1",
          runId: "run:1",
          workflowId: "system:system-demo:v1",
          workspaceId: "workspace-alpha",
          source: "api",
          state: "running",
          assignmentStatus: "assigned",
          executionOutcome: "none",
          submittedAt: "2026-04-07T10:00:00.000Z",
          updatedAt: "2026-04-07T10:01:00.000Z",
        })]),
        totalCount: 1,
      }),
    });
  }

  public async getRunDetail(request: Readonly<Record<string, unknown>>) {
    this.lastDetailRequest = request;
    return Object.freeze({
      ok: true as const,
      data: Object.freeze({
        contractVersion: "run-orchestration-transport/v1",
        runId: "run:1",
        workflowId: "system:system-demo:v1",
        workspaceId: "workspace-alpha",
        source: "api",
        state: "running",
        assignmentStatus: "assigned",
        executionOutcome: "none",
        submittedAt: "2026-04-07T10:00:00.000Z",
        updatedAt: "2026-04-07T10:01:00.000Z",
        submission: Object.freeze({
          submittedByActorId: "user:owner",
        }),
        assignment: Object.freeze({
          status: "assigned",
        }),
        execution: Object.freeze({
          outcome: "none",
        }),
        retry: Object.freeze({
          attempt: 1,
          maxAttempts: 1,
        }),
      }),
    });
  }
}

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
          workflowId: "system:system-demo:v1",
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

async function startServer(
  runSubmissionBackend: StubAuthoritativeRunSubmissionBackendApi,
  runQueryBackend: StubAuthoritativeRunQueryBackendApi,
  runMutationBackend: StubAuthoritativeRunMutationBackendApi,
): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    authoritativeRunSubmissionBackendApi: runSubmissionBackend as unknown as AuthoritativeRunSubmissionBackendApi,
    authoritativeRunQueryBackendApi: runQueryBackend as unknown as AuthoritativeRunQueryBackendApi,
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

describe("IdentityHttpServer authoritative image run API routes", () => {
  it("submits image runs through the authoritative run-submission backend with system route enforcement", async () => {
    const submissionBackend = new StubAuthoritativeRunSubmissionBackendApi();
    const queryBackend = new StubAuthoritativeRunQueryBackendApi();
    const mutationBackend = new StubAuthoritativeRunMutationBackendApi();
    const baseUrl = await startServer(submissionBackend, queryBackend, mutationBackend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.image.submit.1");

    const response = await fetch(`${baseUrl}/api/v1/image-systems/${encodeURIComponent("system-demo")}/runs?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        runtimeTarget: {
          versionId: "v1",
          async: true,
        },
        source: "api",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.run.runId).toBe("run:1");
    expect(submissionBackend.lastSubmissionRequest?.workspaceId).toBe("workspace-alpha");
    const submission = submissionBackend.lastSubmissionRequest?.submission as Record<string, unknown>;
    const runtimeTarget = submission.runtimeTarget as Record<string, unknown>;
    expect(runtimeTarget.systemId).toBe("system-demo");

    const mismatch = await fetch(`${baseUrl}/api/v1/image-systems/${encodeURIComponent("system-demo")}/runs?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        runtimeTarget: {
          systemId: "system-other",
          versionId: "v1",
          async: true,
        },
      }),
    });

    expect(mismatch.status).toBe(400);
    const mismatchBody = await mismatch.json();
    expect(mismatchBody.ok).toBe(false);
    expect(mismatchBody.error.code).toBe("invalid-request");
  });

  it("supports authoritative image run list and detail reads", async () => {
    const submissionBackend = new StubAuthoritativeRunSubmissionBackendApi();
    const queryBackend = new StubAuthoritativeRunQueryBackendApi();
    const mutationBackend = new StubAuthoritativeRunMutationBackendApi();
    const baseUrl = await startServer(submissionBackend, queryBackend, mutationBackend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.image.read.1");

    const listResponse = await fetch(
      `${baseUrl}/api/v1/image-runs?workspaceId=workspace-alpha&state=running&limit=1&offset=0`,
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
    expect(queryBackend.lastListRequest?.workspaceId).toBe("workspace-alpha");

    const detailResponse = await fetch(
      `${baseUrl}/api/v1/image-runs/${encodeURIComponent("run:1")}?workspaceId=workspace-alpha`,
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
    expect(queryBackend.lastDetailRequest?.runId).toBe("run:1");
  });

  it("supports authoritative image run cancellation", async () => {
    const submissionBackend = new StubAuthoritativeRunSubmissionBackendApi();
    const queryBackend = new StubAuthoritativeRunQueryBackendApi();
    const mutationBackend = new StubAuthoritativeRunMutationBackendApi();
    const baseUrl = await startServer(submissionBackend, queryBackend, mutationBackend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.image.cancel.1");

    const response = await fetch(
      `${baseUrl}/api/v1/image-runs/${encodeURIComponent("run:1")}/cancel?workspaceId=workspace-alpha`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: "operator requested",
        }),
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.action).toBe("cancel");
    expect(mutationBackend.lastCancellationRequest?.workspaceId).toBe("workspace-alpha");
  });
});
