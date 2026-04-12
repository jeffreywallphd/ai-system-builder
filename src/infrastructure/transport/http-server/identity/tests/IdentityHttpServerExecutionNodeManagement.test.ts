import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { ExecutionNodeManagementBackendApi } from "../../../../api/nodes/ExecutionNodeManagementBackendApi";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";

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

class StubExecutionNodeManagementBackendApi {
  public lastListRequest: Readonly<Record<string, unknown>> | undefined;
  public lastGetRequest: Readonly<Record<string, unknown>> | undefined;
  public lastAvailabilityOverrideRequest: Readonly<Record<string, unknown>> | undefined;
  public lastReadinessRequest: Readonly<Record<string, unknown>> | undefined;
  public lastEligibilityRequest: Readonly<Record<string, unknown>> | undefined;
  public lastBackendAvailabilityRequest: Readonly<Record<string, unknown>> | undefined;

  public async listNodes(request: Readonly<Record<string, unknown>>) {
    this.lastListRequest = request;
    return {
      ok: true as const,
      data: {
        contractVersion: "execution-node-management-api/v1",
        items: [],
        totalCount: 0,
        asOf: "2026-04-08T00:00:00.000Z",
      },
    };
  }

  public async getNode(request: Readonly<Record<string, unknown>>) {
    this.lastGetRequest = request;
    if (request.nodeId === "node:missing") {
      return {
        ok: false as const,
        error: {
          code: "not-found" as const,
          message: "Execution node was not found.",
        },
      };
    }
    return {
      ok: true as const,
      data: {
        contractVersion: "execution-node-management-api/v1",
        node: {
          nodeId: request.nodeId,
          displayName: "Execution Node",
          nodeType: "compute",
          health: {
            activationStatus: "active",
            healthStatus: "ready",
            stale: false,
          },
          operational: {
            approvalStatus: "approved",
            trustState: "trusted",
            enabledCapabilities: ["executor"],
            supportsRemoteScheduling: true,
            deploymentTags: [],
            certificateAssigned: true,
            availabilityOverrideMode: "enabled",
            availabilityOverrideUpdatedAt: "2026-04-08T00:00:00.000Z",
          },
          backendFamilies: ["adapter.comfyui.image-manipulation"],
          backendCapabilities: [],
          createdAt: "2026-04-08T00:00:00.000Z",
          updatedAt: "2026-04-08T00:00:00.000Z",
        },
        asOf: "2026-04-08T00:00:00.000Z",
      },
    };
  }

  public async setAvailabilityOverride(request: Readonly<Record<string, unknown>>) {
    this.lastAvailabilityOverrideRequest = request;
    return {
      ok: true as const,
      data: {
        contractVersion: "execution-node-management-api/v1",
        node: {
          nodeId: request.nodeId,
          displayName: "Execution Node",
          nodeType: "compute",
          health: {
            activationStatus: "active",
            healthStatus: "ready",
            stale: false,
          },
          operational: {
            approvalStatus: "approved",
            trustState: "trusted",
            enabledCapabilities: ["executor"],
            supportsRemoteScheduling: true,
            deploymentTags: [],
            certificateAssigned: true,
            availabilityOverrideMode: "suppressed",
            availabilitySuppressedUntil: "2026-04-09T00:00:00.000Z",
            availabilityOverrideUpdatedAt: "2026-04-08T00:00:00.000Z",
          },
          backendFamilies: ["adapter.comfyui.image-manipulation"],
        },
        mutation: {
          changed: true,
          wasReplay: false,
        },
        asOf: "2026-04-08T00:00:00.000Z",
      },
    };
  }

  public async checkReadiness(request: Readonly<Record<string, unknown>>) {
    this.lastReadinessRequest = request;
    return {
      ok: true as const,
      data: {
        contractVersion: "execution-node-management-api/v1",
        checkedAt: "2026-04-08T00:00:00.000Z",
        readyForExecution: false,
        readiness: "blocked",
        nodeResults: [],
        issues: [{
          code: "execution-node-candidates-unavailable",
          severity: "error",
          message: "No execution-node candidates are available for this request.",
        }],
      },
    };
  }

  public async checkEligibility(request: Readonly<Record<string, unknown>>) {
    this.lastEligibilityRequest = request;
    return {
      ok: true as const,
      data: {
        contractVersion: "execution-node-management-api/v1",
        checkedAt: "2026-04-08T00:00:00.000Z",
        evaluations: [],
      },
    };
  }

  public async listBackendAvailability(request: Readonly<Record<string, unknown>>) {
    this.lastBackendAvailabilityRequest = request;
    return {
      ok: true as const,
      data: {
        contractVersion: "execution-node-management-api/v1",
        asOf: "2026-04-08T00:00:00.000Z",
        backends: [],
      },
    };
  }
}

async function startServer(
  executionNodeManagementBackendApi: StubExecutionNodeManagementBackendApi,
): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    executionNodeManagementBackendApi: executionNodeManagementBackendApi as unknown as ExecutionNodeManagementBackendApi,
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

async function registerAndLogin(baseUrl: string, username: string): Promise<{ readonly userIdentityId: string; readonly sessionToken: string }> {
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
  const registerBody = await registerResponse.json();

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
  return Object.freeze({
    userIdentityId: registerBody.data.userIdentityId,
    sessionToken: loginBody.data.sessionToken,
  });
}

describe("IdentityHttpServer execution node management routes", () => {
  it("enforces authentication and parses execution-node list queries", async () => {
    const backend = new StubExecutionNodeManagementBackendApi();
    const baseUrl = await startServer(backend);
    const principal = await registerAndLogin(baseUrl, "execution.node.management.read.1");

    const unauthenticated = await fetch(`${baseUrl}/api/v1/execution-nodes`);
    expect(unauthenticated.status).toBe(401);

    const response = await fetch(
      `${baseUrl}/api/v1/execution-nodes?nodeType=compute&backendFamily=adapter.comfyui.image-manipulation&supportsRemoteScheduling=true&limit=25&offset=5`,
      {
        headers: {
          authorization: `Bearer ${principal.sessionToken}`,
        },
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(backend.lastListRequest?.actorUserIdentityId).toBe(principal.userIdentityId);
    expect(backend.lastListRequest?.nodeTypes).toEqual(["compute"]);
    expect(backend.lastListRequest?.backendFamilies).toEqual(["adapter.comfyui.image-manipulation"]);
    expect(backend.lastListRequest?.supportsRemoteScheduling).toBe(true);
    expect(backend.lastListRequest?.limit).toBe(25);
    expect(backend.lastListRequest?.offset).toBe(5);
  });

  it("supports detail reads and maps not-found responses", async () => {
    const backend = new StubExecutionNodeManagementBackendApi();
    const baseUrl = await startServer(backend);
    const principal = await registerAndLogin(baseUrl, "execution.node.management.get.1");

    const success = await fetch(`${baseUrl}/api/v1/execution-nodes/${encodeURIComponent("node:available")}`, {
      headers: {
        authorization: `Bearer ${principal.sessionToken}`,
      },
    });
    expect(success.status).toBe(200);
    const successBody = await success.json();
    expect(successBody.ok).toBe(true);
    expect(backend.lastGetRequest?.nodeId).toBe("node:available");

    const notFound = await fetch(`${baseUrl}/api/v1/execution-nodes/${encodeURIComponent("node:missing")}`, {
      headers: {
        authorization: `Bearer ${principal.sessionToken}`,
      },
    });
    expect(notFound.status).toBe(404);
    const notFoundBody = await notFound.json();
    expect(notFoundBody.ok).toBe(false);
    expect(notFoundBody.error.code).toBe("not-found");
  });

  it("supports availability override mutation and rejects malformed payloads", async () => {
    const backend = new StubExecutionNodeManagementBackendApi();
    const baseUrl = await startServer(backend);
    const principal = await registerAndLogin(baseUrl, "execution.node.management.mutate.1");

    const invalid = await fetch(
      `${baseUrl}/api/v1/execution-nodes/${encodeURIComponent("node:availability-1")}/availability`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${principal.sessionToken}`,
        },
        body: JSON.stringify({
          action: "invalid-action",
        }),
      },
    );
    expect(invalid.status).toBe(400);

    const update = await fetch(
      `${baseUrl}/api/v1/execution-nodes/${encodeURIComponent("node:availability-1")}/availability`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${principal.sessionToken}`,
        },
        body: JSON.stringify({
          actorUserIdentityId: "spoofed-actor",
          nodeId: "spoofed-node",
          action: "suppress",
          changedAt: "2026-04-08T00:00:00.000Z",
          suppressedUntil: "2026-04-09T00:00:00.000Z",
          reason: "maintenance-window",
        }),
      },
    );
    expect(update.status).toBe(200);
    const updateBody = await update.json();
    expect(updateBody.ok).toBe(true);
    expect(backend.lastAvailabilityOverrideRequest?.actorUserIdentityId).toBe(principal.userIdentityId);
    expect(backend.lastAvailabilityOverrideRequest?.nodeId).toBe("node:availability-1");
    expect(backend.lastAvailabilityOverrideRequest?.action).toBe("suppress");
  });

  it("supports readiness, eligibility, and backend availability queries", async () => {
    const backend = new StubExecutionNodeManagementBackendApi();
    const baseUrl = await startServer(backend);
    const principal = await registerAndLogin(baseUrl, "execution.node.management.readiness.1");

    const readiness = await fetch(
      `${baseUrl}/api/v1/execution-nodes/readiness?requiredBackendFamily=adapter.comfyui.image-manipulation&requiredNodeCapability=executor`,
      {
        headers: {
          authorization: `Bearer ${principal.sessionToken}`,
        },
      },
    );
    expect(readiness.status).toBe(200);
    expect(backend.lastReadinessRequest?.requiredBackendFamilies).toEqual(["adapter.comfyui.image-manipulation"]);
    expect(backend.lastReadinessRequest?.requiredNodeCapabilities).toEqual(["executor"]);

    const eligibility = await fetch(
      `${baseUrl}/api/v1/execution-nodes/eligibility?requiredBackendFamily=adapter.comfyui.image-manipulation&requiredNodeCapability=executor`,
      {
        headers: {
          authorization: `Bearer ${principal.sessionToken}`,
        },
      },
    );
    expect(eligibility.status).toBe(200);
    expect(backend.lastEligibilityRequest?.requiredBackendFamilies).toEqual(["adapter.comfyui.image-manipulation"]);
    expect(backend.lastEligibilityRequest?.requiredNodeCapabilities).toEqual(["executor"]);

    const availability = await fetch(
      `${baseUrl}/api/v1/execution-nodes/backends/availability?backendFamily=adapter.comfyui.image-manipulation&includeUnavailable=true`,
      {
        headers: {
          authorization: `Bearer ${principal.sessionToken}`,
        },
      },
    );
    expect(availability.status).toBe(200);
    expect(backend.lastBackendAvailabilityRequest?.backendFamilies).toEqual(["adapter.comfyui.image-manipulation"]);
    expect(backend.lastBackendAvailabilityRequest?.includeUnavailable).toBe(true);
  });
});
