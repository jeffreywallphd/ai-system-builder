import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer, type IdentityHttpServerLogEvent, type IdentityHttpServerLogger } from "../IdentityHttpServer";
import type { AuditLedgerBackendApi } from "../../../../api/audit/AuditLedgerBackendApi";
import type { ExecutionNodeManagementBackendApi } from "../../../../api/nodes/ExecutionNodeManagementBackendApi";
import type { StorageManagementBackendApi } from "../../../../api/storage/StorageManagementBackendApi";
import type { AssetManagementBackendApi } from "../../../../api/assets/AssetManagementBackendApi";
import type { ImageAssetManagementBackendApi } from "../../../../api/image-assets/ImageAssetManagementBackendApi";
import type { GeneratedResultManagementBackendApi } from "../../../../api/generated-results/GeneratedResultManagementBackendApi";
import type { DeploymentPolicyReadBackendApi } from "../../../../api/deployment/DeploymentPolicyReadBackendApi";
import type { DeploymentPolicyWriteBackendApi } from "../../../../api/deployment/DeploymentPolicyWriteBackendApi";
import type { AuthoritativeRunSubmissionBackendApi } from "../../../../api/runs/AuthoritativeRunSubmissionBackendApi";
import type { AuthoritativeRunQueryBackendApi } from "../../../../api/runs/AuthoritativeRunQueryBackendApi";
import type { AuthoritativeRunMutationBackendApi } from "../../../../api/runs/AuthoritativeRunMutationBackendApi";
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

class CapturingLogger implements IdentityHttpServerLogger {
  public readonly events: IdentityHttpServerLogEvent[] = [];

  public info(event: IdentityHttpServerLogEvent): void {
    this.events.push(event);
  }

  public warn(event: IdentityHttpServerLogEvent): void {
    this.events.push(event);
  }

  public error(event: IdentityHttpServerLogEvent): void {
    this.events.push(event);
  }
}

class ParityBackends {
  public readonly audit = {
    listAuditEvents: async (request: Readonly<Record<string, unknown>>) => {
      this.lastAuditListRequest = request;
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          events: Object.freeze([]),
          totalCount: 0,
        }),
      });
    },
    listGovernanceAuditEvents: async () => Object.freeze({ ok: true, data: Object.freeze({ events: Object.freeze([]), totalCount: 0 }) }),
    getAuditEventDetail: async () => Object.freeze({ ok: false, error: Object.freeze({ code: "not-found", message: "not found" }) }),
    getGovernanceAuditEventDetail: async () => Object.freeze({ ok: false, error: Object.freeze({ code: "not-found", message: "not found" }) }),
  } satisfies Partial<AuditLedgerBackendApi>;

  public readonly executionNodeManagement = {
    listNodes: async (request: Readonly<Record<string, unknown>>) => {
      this.lastExecutionNodeListRequest = request;
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          contractVersion: "execution-node-management-api/v1",
          items: Object.freeze([]),
          totalCount: 0,
          asOf: "2026-04-12T00:00:00.000Z",
        }),
      });
    },
    checkReadiness: async () => Object.freeze({ ok: true, data: Object.freeze({ checkedAt: "2026-04-12T00:00:00.000Z", readyForExecution: true, readiness: "ready", nodeResults: Object.freeze([]), issues: Object.freeze([]) }) }),
    checkEligibility: async () => Object.freeze({ ok: true, data: Object.freeze({ checkedAt: "2026-04-12T00:00:00.000Z", evaluations: Object.freeze([]) }) }),
    listBackendAvailability: async () => Object.freeze({ ok: true, data: Object.freeze({ asOf: "2026-04-12T00:00:00.000Z", backends: Object.freeze([]) }) }),
    setAvailabilityOverride: async () => Object.freeze({ ok: true, data: Object.freeze({ mutation: Object.freeze({ changed: true, wasReplay: false }) }) }),
    getNode: async () => Object.freeze({ ok: false, error: Object.freeze({ code: "not-found", message: "not found" }) }),
  } satisfies Partial<ExecutionNodeManagementBackendApi>;

  public readonly storage = {
    listStorageInstances: async (request: Readonly<Record<string, unknown>>) => {
      this.lastStorageListRequest = request;
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          items: Object.freeze([]),
          totalCount: 0,
        }),
      });
    },
  } satisfies Partial<StorageManagementBackendApi>;

  public readonly assets = {
    listAssets: async (request: Readonly<Record<string, unknown>>) => {
      this.lastAssetListRequest = request;
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          items: Object.freeze([]),
          totalCount: 0,
        }),
      });
    },
  } satisfies Partial<AssetManagementBackendApi>;

  public readonly imageAssets = {
    openImageAssetOriginalContentStream: async (request: Readonly<Record<string, unknown>>) => {
      this.lastImageAssetOriginalRequest = request;
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          assetId: "image-asset:1",
          workspaceId: String(request.workspaceId ?? "workspace-alpha"),
          mimeType: "image/png",
          sizeBytes: 5,
          contentDisposition: "attachment",
          contentDispositionFileName: "route-parity.png",
          stream: (async function* stream() {
            yield Buffer.from("hello", "utf8");
          })(),
        }),
      });
    },
  } satisfies Partial<ImageAssetManagementBackendApi>;

  public readonly generatedResults = {
    listGeneratedResults: async (request: Readonly<Record<string, unknown>>) => {
      this.lastGeneratedResultListRequest = request;
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          items: Object.freeze([]),
          totalCount: 0,
        }),
      });
    },
  } satisfies Partial<GeneratedResultManagementBackendApi>;

  public readonly deploymentRead = {
    readPolicyState: async (request: Readonly<Record<string, unknown>>) => {
      this.lastDeploymentReadRequest = request;
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          scope: Object.freeze({
            kind: "deployment-policy-scope",
            scopeId: "workspace-alpha",
          }),
        }),
      });
    },
  } satisfies Partial<DeploymentPolicyReadBackendApi>;

  public readonly deploymentWrite = {
    updateActiveProfile: async (
      context: Readonly<Record<string, unknown>>,
      request: Readonly<Record<string, unknown>>,
    ) => {
      this.lastDeploymentWriteRequest = Object.freeze({
        ...context,
        ...request,
      });
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          result: Object.freeze({
            snapshot: Object.freeze({
              profileId: String(request.profileId),
            }),
          }),
        }),
      });
    },
    applyOverrideOperations: async () => Object.freeze({
      ok: false,
      error: Object.freeze({
        code: "forbidden",
        message: "forbidden",
      }),
    }),
  } satisfies Partial<DeploymentPolicyWriteBackendApi>;

  public readonly runSubmission = {
    submitRun: async (request: Readonly<Record<string, unknown>>) => {
      this.lastRunSubmissionRequest = request;
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          run: Object.freeze({
            runId: "run:1",
            state: "submitted",
          }),
          mutation: Object.freeze({
            changed: true,
          }),
        }),
      });
    },
  } satisfies Partial<AuthoritativeRunSubmissionBackendApi>;

  public readonly runRead = {
    listRuns: async (request: Readonly<Record<string, unknown>>) => {
      this.lastRunListRequest = request;
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          items: Object.freeze([]),
          totalCount: 0,
        }),
      });
    },
    getExecutionReadiness: async () => Object.freeze({ ok: true, data: Object.freeze({}) }),
    getRunDetail: async () => Object.freeze({ ok: false, error: Object.freeze({ code: "not-found", message: "not found" }) }),
    getRunStatus: async () => Object.freeze({ ok: true, data: Object.freeze({}) }),
    listQueueStatus: async () => Object.freeze({ ok: true, data: Object.freeze({ items: Object.freeze([]), totalCount: 0 }) }),
    listStaleSchedulingReservations: async () => Object.freeze({ ok: true, data: Object.freeze({ items: Object.freeze([]), totalCount: 0 }) }),
  } satisfies Partial<AuthoritativeRunQueryBackendApi>;

  public readonly runMutation = {
    cancelRun: async (request: Readonly<Record<string, unknown>>) => {
      this.lastRunCancelRequest = request;
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          runId: "run:1",
          cancelled: true,
        }),
      });
    },
    retryRun: async () => Object.freeze({ ok: true, data: Object.freeze({}) }),
    releaseStaleSchedulingReservation: async () => Object.freeze({ ok: true, data: Object.freeze({}) }),
    reevaluateDeferredSchedulingRuns: async () => Object.freeze({ ok: true, data: Object.freeze({}) }),
  } satisfies Partial<AuthoritativeRunMutationBackendApi>;

  public readonly runExecutionUpdate = {
    ingestExecutionUpdate: async (request: Readonly<Record<string, unknown>>) => {
      this.lastRunExecutionUpdateRequest = request;
      return Object.freeze({
        ok: true,
        data: Object.freeze({
          mutation: Object.freeze({
            action: "lifecycle-update",
          }),
          status: Object.freeze({
            runId: "run:1",
            state: "running",
          }),
        }),
      });
    },
  } satisfies Partial<AuthoritativeRunExecutionUpdateBackendApi>;

  public readonly nodeTrust = {} satisfies Partial<NodeTrustBackendApi>;

  public lastStorageListRequest: Readonly<Record<string, unknown>> | undefined;
  public lastAssetListRequest: Readonly<Record<string, unknown>> | undefined;
  public lastAuditListRequest: Readonly<Record<string, unknown>> | undefined;
  public lastExecutionNodeListRequest: Readonly<Record<string, unknown>> | undefined;
  public lastGeneratedResultListRequest: Readonly<Record<string, unknown>> | undefined;
  public lastImageAssetOriginalRequest: Readonly<Record<string, unknown>> | undefined;
  public lastDeploymentReadRequest: Readonly<Record<string, unknown>> | undefined;
  public lastDeploymentWriteRequest: Readonly<Record<string, unknown>> | undefined;
  public lastRunSubmissionRequest: Readonly<Record<string, unknown>> | undefined;
  public lastRunListRequest: Readonly<Record<string, unknown>> | undefined;
  public lastRunCancelRequest: Readonly<Record<string, unknown>> | undefined;
  public lastRunExecutionUpdateRequest: Readonly<Record<string, unknown>> | undefined;
}

interface ParityFixture {
  readonly baseUrl: string;
  readonly logger: CapturingLogger;
  readonly backends: ParityBackends;
}

async function startParityFixture(): Promise<ParityFixture> {
  const identityHarness = await createIdentityAuthTestHarness();
  const logger = new CapturingLogger();
  const backends = new ParityBackends();
  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    logger,
    storageManagementBackendApi: backends.storage as unknown as StorageManagementBackendApi,
    assetManagementBackendApi: backends.assets as unknown as AssetManagementBackendApi,
    imageAssetManagementBackendApi: backends.imageAssets as unknown as ImageAssetManagementBackendApi,
    generatedResultManagementBackendApi: backends.generatedResults as unknown as GeneratedResultManagementBackendApi,
    auditLedgerBackendApi: backends.audit as unknown as AuditLedgerBackendApi,
    executionNodeManagementBackendApi: backends.executionNodeManagement as unknown as ExecutionNodeManagementBackendApi,
    deploymentPolicyReadBackendApi: backends.deploymentRead as unknown as DeploymentPolicyReadBackendApi,
    deploymentPolicyWriteBackendApi: backends.deploymentWrite as unknown as DeploymentPolicyWriteBackendApi,
    authoritativeRunSubmissionBackendApi: backends.runSubmission as unknown as AuthoritativeRunSubmissionBackendApi,
    authoritativeRunQueryBackendApi: backends.runRead as unknown as AuthoritativeRunQueryBackendApi,
    authoritativeRunMutationBackendApi: backends.runMutation as unknown as AuthoritativeRunMutationBackendApi,
    authoritativeRunExecutionUpdateBackendApi: backends.runExecutionUpdate as unknown as AuthoritativeRunExecutionUpdateBackendApi,
    nodeTrustBackendApi: backends.nodeTrust as unknown as NodeTrustBackendApi,
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

  return Object.freeze({
    baseUrl: `http://127.0.0.1:${address.port}`,
    logger,
    backends,
  });
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

type ParitySuccessCase = {
  readonly routeFamilyId: string;
  readonly expectedPath: string;
  readonly requiresWorkspace: boolean;
  readonly makeSuccessRequest: (input: { readonly baseUrl: string; readonly token: string; readonly nodeToken: string }) => Promise<Response>;
};

const parityCases: ReadonlyArray<ParitySuccessCase> = Object.freeze([
  {
    routeFamilyId: "storage-management",
    expectedPath: "/api/v1/storage/instances",
    requiresWorkspace: true,
    makeSuccessRequest: ({ baseUrl, token }) => fetch(`${baseUrl}/api/v1/storage/instances?workspaceId=workspace-alpha`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  },
  {
    routeFamilyId: "asset-management",
    expectedPath: "/api/v1/assets",
    requiresWorkspace: true,
    makeSuccessRequest: ({ baseUrl, token }) => fetch(`${baseUrl}/api/v1/assets?workspaceId=workspace-alpha`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  },
  {
    routeFamilyId: "image-asset-management",
    expectedPath: "/api/v1/image-assets/image-asset%3A1/original",
    requiresWorkspace: true,
    makeSuccessRequest: ({ baseUrl, token }) => fetch(
      `${baseUrl}/api/v1/image-assets/image-asset%3A1/original?workspaceId=workspace-alpha`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    ),
  },
  {
    routeFamilyId: "audit-ledger",
    expectedPath: "/api/v1/audit/events",
    requiresWorkspace: true,
    makeSuccessRequest: ({ baseUrl, token }) => fetch(`${baseUrl}/api/v1/audit/events?workspaceId=workspace-alpha`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  },
  {
    routeFamilyId: "execution-node-management",
    expectedPath: "/api/v1/execution-nodes",
    requiresWorkspace: false,
    makeSuccessRequest: ({ baseUrl, token }) => fetch(`${baseUrl}/api/v1/execution-nodes`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  },
  {
    routeFamilyId: "deployment-policy-read",
    expectedPath: "/api/v1/deployment/policy/state",
    requiresWorkspace: true,
    makeSuccessRequest: ({ baseUrl, token }) => fetch(`${baseUrl}/api/v1/deployment/policy/state?workspaceId=workspace-alpha`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  },
  {
    routeFamilyId: "deployment-policy-write",
    expectedPath: "/api/v1/deployment/policy/active-profile",
    requiresWorkspace: true,
    makeSuccessRequest: ({ baseUrl, token }) => fetch(`${baseUrl}/api/v1/deployment/policy/active-profile?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        profileId: "organization",
        reason: "route parity",
      }),
    }),
  },
  {
    routeFamilyId: "run-submission",
    expectedPath: "/api/v1/runtime/runs/start",
    requiresWorkspace: true,
    makeSuccessRequest: ({ baseUrl, token }) => fetch(`${baseUrl}/api/v1/runtime/runs/start?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        runtimeTarget: {
          systemId: "system-demo",
          versionId: "version-1",
          async: true,
        },
      }),
    }),
  },
  {
    routeFamilyId: "run-read",
    expectedPath: "/api/v1/runtime/runs",
    requiresWorkspace: true,
    makeSuccessRequest: ({ baseUrl, token }) => fetch(`${baseUrl}/api/v1/runtime/runs?workspaceId=workspace-alpha`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  },
  {
    routeFamilyId: "run-mutation",
    expectedPath: "/api/v1/runtime/runs/run%3A1/cancel",
    requiresWorkspace: true,
    makeSuccessRequest: ({ baseUrl, token }) => fetch(`${baseUrl}/api/v1/runtime/runs/run%3A1/cancel?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    }),
  },
  {
    routeFamilyId: "run-execution-update",
    expectedPath: "/api/v1/runtime/runs/run%3A1/lifecycle",
    requiresWorkspace: false,
    makeSuccessRequest: ({ baseUrl, nodeToken }) => fetch(`${baseUrl}/api/v1/runtime/runs/run%3A1/lifecycle`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${nodeToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        senderNodeId: "node:trusted-1",
        heartbeatAt: "2026-04-12T00:00:00.000Z",
      }),
    }),
  },
  {
    routeFamilyId: "image-run-api",
    expectedPath: "/api/v1/generated-results",
    requiresWorkspace: true,
    makeSuccessRequest: ({ baseUrl, token }) => fetch(`${baseUrl}/api/v1/generated-results?workspaceId=workspace-alpha`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  },
]);

describe("IdentityHttpServer migrated route-family parity regression", () => {
  it("enforces representative authentication and workspace-scoping gates across migrated modular route families", async () => {
    const fixture = await startParityFixture();
    const token = await registerAndLogin(fixture.baseUrl, "route.parity.user");
    const nodeToken = await registerAndLogin(fixture.baseUrl, "node:trusted-1");

    for (const parityCase of parityCases) {
      const unauthenticated = await parityCase.makeSuccessRequest({
        baseUrl: fixture.baseUrl,
        token: "invalid",
        nodeToken: "invalid",
      });
      expect(unauthenticated.status).toBe(401);

      if (!parityCase.requiresWorkspace) {
        continue;
      }

      const missingWorkspaceUrl = parityCase.expectedPath;
      const missingWorkspace = await fetch(`${fixture.baseUrl}${missingWorkspaceUrl}`, {
        method: parityCase.routeFamilyId === "deployment-policy-write" || parityCase.routeFamilyId === "run-submission" || parityCase.routeFamilyId === "run-mutation"
          ? "POST"
          : "GET",
        headers: {
          authorization: `Bearer ${parityCase.routeFamilyId === "run-execution-update" ? nodeToken : token}`,
          "content-type": "application/json",
        },
        body: parityCase.routeFamilyId === "deployment-policy-write"
          ? JSON.stringify({ profileId: "organization" })
          : parityCase.routeFamilyId === "run-submission"
            ? JSON.stringify({ runtimeTarget: { systemId: "system-demo", versionId: "version-1", async: true } })
            : parityCase.routeFamilyId === "run-mutation"
              ? JSON.stringify({})
              : undefined,
      });
      expect(missingWorkspace.status).toBe(400);
      const missingWorkspaceBody = await missingWorkspace.json();
      expect(missingWorkspaceBody.ok).toBe(false);
      expect(missingWorkspaceBody.error.code).toBe("invalid-request");
    }
  });

  it("keeps representative migrated-family success responses and modular transport dispatch shapes stable", async () => {
    const fixture = await startParityFixture();
    const token = await registerAndLogin(fixture.baseUrl, "route.parity.success.user");
    const nodeToken = await registerAndLogin(fixture.baseUrl, "node:trusted-1");

    for (const parityCase of parityCases) {
      const response = await parityCase.makeSuccessRequest({
        baseUrl: fixture.baseUrl,
        token,
        nodeToken,
      });
      expect(response.status).toBe(200);

      if (parityCase.routeFamilyId === "image-asset-management") {
        expect(response.headers.get("content-type")).toBe("image/png");
        expect(response.headers.get("content-disposition")).toContain("attachment");
        expect(await response.text()).toBe("hello");
      } else {
        const body = await response.json();
        expect(body.ok).toBe(true);
      }

      const modularHandled = fixture.logger.events.some((event) => (
        event.event === "identity-http.route-family.modular-handled"
        && event.path === parityCase.expectedPath
        && event.details?.routeFamilyId === parityCase.routeFamilyId
      ));
      expect(modularHandled).toBeTrue();
    }

    expect(fixture.backends.lastStorageListRequest?.workspaceId).toBe("workspace-alpha");
    expect(fixture.backends.lastAssetListRequest?.workspaceId).toBe("workspace-alpha");
    expect(fixture.backends.lastAuditListRequest?.workspaceId).toBe("workspace-alpha");
    expect(fixture.backends.lastExecutionNodeListRequest?.actorUserIdentityId).toBeDefined();
    expect(fixture.backends.lastGeneratedResultListRequest?.workspaceId).toBe("workspace-alpha");
    expect(fixture.backends.lastImageAssetOriginalRequest?.workspaceId).toBe("workspace-alpha");
    expect(fixture.backends.lastDeploymentReadRequest?.workspaceId).toBe("workspace-alpha");
    expect(fixture.backends.lastDeploymentWriteRequest?.workspaceId).toBe("workspace-alpha");
    expect(fixture.backends.lastRunSubmissionRequest?.workspaceId).toBe("workspace-alpha");
    expect(fixture.backends.lastRunListRequest?.workspaceId).toBe("workspace-alpha");
    expect(fixture.backends.lastRunCancelRequest?.workspaceId).toBe("workspace-alpha");
    expect(fixture.backends.lastRunExecutionUpdateRequest?.senderNodeId).toBe("node:trusted-1");

    for (const parityCase of parityCases) {
      const legacyFallback = fixture.logger.events.some((event) => (
        event.event === "identity-http.route-family.legacy-fallback"
        && event.details?.routeFamilyId === parityCase.routeFamilyId
      ));
      expect(legacyFallback).toBeFalse();
    }
  });

  it("enforces trust-bound sender identity checks for run-execution-update parity", async () => {
    const fixture = await startParityFixture();
    const nodeToken = await registerAndLogin(fixture.baseUrl, "node:trusted-1");

    const response = await fetch(`${fixture.baseUrl}/api/v1/runtime/runs/run%3A1/lifecycle`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${nodeToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        senderNodeId: "node:other",
        heartbeatAt: "2026-04-12T00:00:00.000Z",
      }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("forbidden");
  });
});

