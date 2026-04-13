import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import type { AuthoritativeRunQueryBackendApi } from "../../../../api/runs/AuthoritativeRunQueryBackendApi";
import type { AuthoritativeRunSubmissionBackendApi } from "../../../../api/runs/AuthoritativeRunSubmissionBackendApi";
import { RunOrchestrationTransportRoutes } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";

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
  public lastQueueRequest: Readonly<Record<string, unknown>> | undefined;
  public lastExecutionReadinessRequest: Readonly<Record<string, unknown>> | undefined;

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

  public async listQueueStatus(request: Readonly<Record<string, unknown>>) {
    this.lastQueueRequest = request;
    return {
      ok: true as const,
      data: {
        items: [{
          runId: "run:1",
          workflowId: "workflow:1",
          workspaceId: "workspace-alpha",
          state: "queued",
          queue: {
            queueId: "queue:default",
            enteredAt: "2026-04-07T10:00:00.000Z",
            position: 1,
            positionAsOf: "2026-04-07T10:01:00.000Z",
          },
          assignmentStatus: "unassigned",
          executionOutcome: "none",
          updatedAt: "2026-04-07T10:01:00.000Z",
          actionAvailability: {
            cancel: {
              allowed: true,
            },
            retry: {
              allowed: false,
              reason: "Retry is available only for failed or cancelled runs.",
            },
            dequeue: {
              allowed: true,
            },
          },
        }],
        totalCount: 1,
        asOf: "2026-04-07T10:01:00.000Z",
      },
    };
  }

  public async getExecutionReadiness(request: Readonly<Record<string, unknown>>) {
    this.lastExecutionReadinessRequest = request;
    const runtimeLifecycle = request.runtimeLifecycle as { readonly state?: string; readonly checkedAt?: string } | undefined;
    if (runtimeLifecycle && runtimeLifecycle.state && runtimeLifecycle.state !== "ready") {
      return {
        ok: true as const,
        data: {
          backendFamily: "adapter.image-manipulation.execution",
          checkedAt: runtimeLifecycle.checkedAt ?? "2026-04-08T12:10:00.000Z",
          readiness: "unavailable",
          readyForExecution: false,
          runtimeLifecycle,
          message: `Runtime lifecycle is '${runtimeLifecycle.state}'.`,
          capabilities: {
            backendFamily: "adapter.image-manipulation.execution",
            supportsProgressPolling: false,
            supportsProgressStreaming: false,
            supportsCancellation: false,
            supportsOutputDiscovery: false,
            supportedOperationKinds: [],
            supportedTranslationContractVersions: [],
          },
          nodeAvailability: {
            state: "unknown",
            checkedAt: runtimeLifecycle.checkedAt ?? "2026-04-08T12:10:00.000Z",
            candidateNodeCount: 0,
            eligibleNodeCount: 0,
            unavailableNodeCount: 0,
            incompatibleNodeCount: 0,
            topBlockingReasonCodes: [],
            topTransientAvailabilityReasonCodes: [],
            reasonCode: "runtime-lifecycle-unavailable",
          },
          issues: [{
            code: "runtime-lifecycle-unavailable",
            severity: "error",
            message: `Runtime lifecycle is '${runtimeLifecycle.state}'.`,
          }],
        },
      };
    }
    return {
      ok: true as const,
      data: {
        backendFamily: "adapter.comfyui.image-manipulation",
        checkedAt: "2026-04-08T12:10:00.000Z",
        readiness: "degraded",
        readyForExecution: false,
        message: "backend is reachable but incompatible",
        capabilities: {
          backendFamily: "adapter.comfyui.image-manipulation",
          supportsProgressPolling: true,
          supportsProgressStreaming: false,
          supportsCancellation: true,
          supportsOutputDiscovery: true,
          supportedOperationKinds: ["image-to-image"],
          supportedTranslationContractVersions: ["1.0.0"],
        },
        nodeAvailability: {
          state: "constrained",
          checkedAt: "2026-04-08T12:10:00.000Z",
          candidateNodeCount: 2,
          eligibleNodeCount: 0,
          unavailableNodeCount: 1,
          incompatibleNodeCount: 1,
          topBlockingReasonCodes: ["node-backend-family-unsupported"],
          topTransientAvailabilityReasonCodes: ["node-health-not-routable"],
          reasonCode: "execution-node-no-eligible-match",
        },
        issues: [{
          code: "translation-contract-version-unsupported",
          severity: "error",
          message: "Translation contract version '2.0.0' is not supported.",
        }],
      },
    };
  }
}

class StubAuthoritativeRunSubmissionBackendApi {
  public async submitRun(request: Readonly<Record<string, unknown>>) {
    return {
      ok: true as const,
      data: {
        run: {
          contractVersion: "run-orchestration-transport/v1",
          runId: "run:submission:1",
          workflowId: String(request.workflowId ?? "workflow:submission:1"),
          workspaceId: String(request.workspaceId ?? "workspace-alpha"),
          source: "api" as const,
          state: "submitted" as const,
          assignmentStatus: "unassigned" as const,
          executionOutcome: "none" as const,
          submittedAt: "2026-04-13T12:00:00.000Z",
          updatedAt: "2026-04-13T12:00:00.000Z",
          submission: {
            submittedByActorId: "user:submission",
          },
          assignment: {
            status: "unassigned" as const,
          },
          execution: {
            outcome: "none" as const,
          },
          retry: {
            attempt: 1,
            maxAttempts: 1,
          },
        },
        mutation: {
          changed: true,
          mutationId: "mutation:submission:1",
          occurredAt: "2026-04-13T12:00:00.000Z",
        },
      },
    };
  }
}

async function startServer(
  runQueryBackend: StubAuthoritativeRunQueryBackendApi,
  serverOptions: Partial<Parameters<typeof createIdentityHttpServer>[0]> = {},
): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    authoritativeRunQueryBackendApi: runQueryBackend as unknown as AuthoritativeRunQueryBackendApi,
    ...serverOptions,
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

    const queueResponse = await fetch(
      `${baseUrl}/api/v1/runtime/queue?workspaceId=workspace-alpha&status=queued`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    expect(queueResponse.status).toBe(200);
    const queueBody = await queueResponse.json();
    expect(queueBody.ok).toBe(true);
    expect(queueBody.data.items[0].runId).toBe("run:1");
    expect(backend.lastQueueRequest?.workspaceId).toBe("workspace-alpha");

    const readinessResponse = await fetch(
      `${baseUrl}/api/v1/runtime/execution/readiness?workspaceId=workspace-alpha&operationKind=image-to-image&translationContractVersion=2.0.0`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    expect(readinessResponse.status).toBe(200);
    const readinessBody = await readinessResponse.json();
    expect(readinessBody.ok).toBe(true);
    expect(readinessBody.data.backendFamily).toBe("adapter.comfyui.image-manipulation");
    expect(readinessBody.data.readiness).toBe("degraded");
    expect(backend.lastExecutionReadinessRequest?.operationKind).toBe("image-to-image");
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

  it("keeps execution readiness reachable across pre-login, warming, failed, and ready lifecycle phases", async () => {
    const backend = new StubAuthoritativeRunQueryBackendApi();
    let lifecycleState: "pre-login" | "warming" | "failed" | "ready" = "pre-login";
    const baseUrl = await startServer(backend, {
      routeFamilyAvailability: Object.freeze({
        isRouteFamilyAvailable: (routeFamilyId: string) => {
          if (routeFamilyId !== "run-read") {
            return true;
          }
          return lifecycleState === "ready";
        },
        resolveRouteFamilyAvailability: (routeFamilyId: string) => Object.freeze({
          routeFamilyId,
          capabilityId: "deferred-runtime-features",
          state: lifecycleState,
          available: lifecycleState === "ready",
        }),
      }),
    });

    const preLoginResponse = await fetch(
      `${baseUrl}${RunOrchestrationTransportRoutes.getExecutionReadiness}?workspaceId=workspace-alpha`,
    );
    expect(preLoginResponse.status).toBe(200);
    const preLoginBody = await preLoginResponse.json();
    expect(preLoginBody.ok).toBe(true);
    expect(preLoginBody.data.runtimeLifecycle.state).toBe("unavailable");
    expect(backend.lastExecutionReadinessRequest?.runtimeLifecycle).toBeDefined();

    lifecycleState = "warming";
    const warmingResponse = await fetch(
      `${baseUrl}${RunOrchestrationTransportRoutes.getExecutionReadiness}?workspaceId=workspace-alpha`,
    );
    expect(warmingResponse.status).toBe(200);
    const warmingBody = await warmingResponse.json();
    expect(warmingBody.ok).toBe(true);
    expect(warmingBody.data.runtimeLifecycle.state).toBe("warming");

    lifecycleState = "failed";
    const failedResponse = await fetch(
      `${baseUrl}${RunOrchestrationTransportRoutes.getExecutionReadiness}?workspaceId=workspace-alpha`,
    );
    expect(failedResponse.status).toBe(200);
    const failedBody = await failedResponse.json();
    expect(failedBody.ok).toBe(true);
    expect(failedBody.data.runtimeLifecycle.state).toBe("failed");

    lifecycleState = "ready";
    const unauthenticatedReadyResponse = await fetch(
      `${baseUrl}${RunOrchestrationTransportRoutes.getExecutionReadiness}?workspaceId=workspace-alpha`,
    );
    expect(unauthenticatedReadyResponse.status).toBe(401);

    const token = await registerAndLogin(baseUrl, "runtime.authoritative.read.lifecycle.1");
    const readyResponse = await fetch(
      `${baseUrl}${RunOrchestrationTransportRoutes.getExecutionReadiness}?workspaceId=workspace-alpha`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    expect(readyResponse.status).toBe(200);
    const readyBody = await readyResponse.json();
    expect(readyBody.ok).toBe(true);
    expect(readyBody.data.readiness).toBe("degraded");
    expect(readyBody.data.runtimeLifecycle).toBeUndefined();
  });

  it("regression: runtime readiness and submission routes do not connection-refuse during pre-login and warmup", async () => {
    const queryBackend = new StubAuthoritativeRunQueryBackendApi();
    const submissionBackend = new StubAuthoritativeRunSubmissionBackendApi();
    let lifecycleState: "pre-login" | "warming" | "ready" = "pre-login";
    const baseUrl = await startServer(queryBackend, {
      authoritativeRunSubmissionBackendApi: submissionBackend as unknown as AuthoritativeRunSubmissionBackendApi,
      routeFamilyAvailability: Object.freeze({
        isRouteFamilyAvailable: (routeFamilyId: string) => {
          if (routeFamilyId !== "run-read" && routeFamilyId !== "run-submission") {
            return true;
          }
          return lifecycleState === "ready";
        },
        resolveRouteFamilyAvailability: (routeFamilyId: string) => Object.freeze({
          routeFamilyId,
          capabilityId: "deferred-runtime-features",
          state: lifecycleState,
          available: lifecycleState === "ready",
        }),
      }),
    });

    const assertNoConnectionRefusal = async (request: () => Promise<Response>): Promise<Response> => {
      try {
        return await request();
      } catch (error) {
        throw new Error(
          `Expected stable listener continuity during runtime startup transition, but request threw: ${String(error)}`,
        );
      }
    };

    const preLoginReadinessResponse = await assertNoConnectionRefusal(() =>
      fetch(`${baseUrl}${RunOrchestrationTransportRoutes.getExecutionReadiness}?workspaceId=workspace-alpha`)
    );
    expect(preLoginReadinessResponse.status).toBe(200);
    const preLoginReadinessBody = await preLoginReadinessResponse.json();
    expect(preLoginReadinessBody.ok).toBe(true);
    expect(preLoginReadinessBody.data.runtimeLifecycle.state).toBe("unavailable");

    const preLoginSubmissionResponse = await assertNoConnectionRefusal(() =>
      fetch(`${baseUrl}/api/v1/runtime/runs/start?workspaceId=workspace-alpha`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          runtimeTarget: {
            systemId: "system:startup-transition",
            versionId: "version:1",
            async: true,
          },
        }),
      })
    );
    expect(preLoginSubmissionResponse.status).toBe(503);
    const preLoginSubmissionBody = await preLoginSubmissionResponse.json();
    expect(preLoginSubmissionBody.runtime.state).toBe("unavailable");

    lifecycleState = "warming";

    const warmingReadinessResponse = await assertNoConnectionRefusal(() =>
      fetch(`${baseUrl}${RunOrchestrationTransportRoutes.getExecutionReadiness}?workspaceId=workspace-alpha`)
    );
    expect(warmingReadinessResponse.status).toBe(200);
    const warmingReadinessBody = await warmingReadinessResponse.json();
    expect(warmingReadinessBody.ok).toBe(true);
    expect(warmingReadinessBody.data.runtimeLifecycle.state).toBe("warming");

    const warmingSubmissionResponse = await assertNoConnectionRefusal(() =>
      fetch(`${baseUrl}/api/v1/runtime/runs/start?workspaceId=workspace-alpha`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          runtimeTarget: {
            systemId: "system:startup-transition",
            versionId: "version:1",
            async: true,
          },
        }),
      })
    );
    expect(warmingSubmissionResponse.status).toBe(503);
    const warmingSubmissionBody = await warmingSubmissionResponse.json();
    expect(warmingSubmissionBody.runtime.state).toBe("warming");
  });
});

