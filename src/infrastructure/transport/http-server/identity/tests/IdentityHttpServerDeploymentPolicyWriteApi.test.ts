import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import type { DeploymentPolicyWriteBackendApi } from "../../../../api/deployment/DeploymentPolicyWriteBackendApi";

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

class StubDeploymentPolicyWriteBackendApi {
  public lastActiveProfileRequest: Readonly<Record<string, unknown>> | undefined;
  public lastOverrideRequest: Readonly<Record<string, unknown>> | undefined;

  public async updateActiveProfile(
    context: Readonly<Record<string, unknown>>,
    request: Readonly<Record<string, unknown>>,
  ) {
    this.lastActiveProfileRequest = Object.freeze({
      ...context,
      ...request,
    });
    return Object.freeze({
      ok: true as const,
      data: Object.freeze({
        result: Object.freeze({
          scope: Object.freeze({
            kind: "deployment-policy-scope",
            scopeId: String(context.workspaceId),
          }),
          dryRun: false,
          validation: Object.freeze({
            valid: true,
            issues: Object.freeze([]),
            evaluatedAt: "2026-04-08T00:00:00.000Z",
          }),
          overrideMutations: Object.freeze([]),
          snapshot: Object.freeze({
            contractVersion: "deployment-policy-administration/v1",
            profileId: String(request.profileId),
            evaluatedAt: "2026-04-08T00:00:00.000Z",
            evaluationLayer: "application",
            preset: Object.freeze({
              profileId: String(request.profileId),
              lineage: Object.freeze(["home", "classroom", String(request.profileId)]),
              inheritedFrom: Object.freeze(["home", "classroom"]),
              parentProfileId: "classroom",
            }),
            families: Object.freeze({}),
            summary: Object.freeze({
              familyCount: 0,
              settingCount: 0,
              sourceCounts: Object.freeze({
                "profile-preset": 0,
                "policy-default": 0,
                "admin-state": 0,
              }),
              controlModeCounts: Object.freeze({
                "profile-fixed": 0,
                "profile-default-admin-overridable": 0,
                "runtime-admin": 0,
              }),
            }),
          }),
        }),
      }),
    });
  }

  public async applyOverrideOperations(
    context: Readonly<Record<string, unknown>>,
    request: Readonly<Record<string, unknown>>,
  ) {
    this.lastOverrideRequest = Object.freeze({
      ...context,
      ...request,
    });
    return Object.freeze({
      ok: false as const,
      error: Object.freeze({
        code: "forbidden",
        message: "Actor is not authorized.",
      }),
    });
  }
}

async function startServer(
  deploymentPolicyWriteBackendApi: StubDeploymentPolicyWriteBackendApi,
): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    deploymentPolicyWriteBackendApi: deploymentPolicyWriteBackendApi as unknown as DeploymentPolicyWriteBackendApi,
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

describe("IdentityHttpServer deployment policy write routes", () => {
  it("updates active deployment profile through authenticated authoritative route", async () => {
    const backendApi = new StubDeploymentPolicyWriteBackendApi();
    const baseUrl = await startServer(backendApi);
    const token = await registerAndLogin(baseUrl, "deployment.policy.write.user.1");

    const response = await fetch(
      `${baseUrl}/api/v1/deployment/policy/active-profile?workspaceId=workspace-alpha`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-correlation-id": "corr-policy-write-1",
        },
        body: JSON.stringify({
          profileId: "organization",
          reason: "Promote governance baseline",
        }),
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.result.snapshot.profileId).toBe("organization");
    expect(backendApi.lastActiveProfileRequest?.workspaceId).toBe("workspace-alpha");
    expect(backendApi.lastActiveProfileRequest?.correlationId).toBe("corr-policy-write-1");
  });

  it("returns invalid request when write payload fails schema validation", async () => {
    const backendApi = new StubDeploymentPolicyWriteBackendApi();
    const baseUrl = await startServer(backendApi);
    const token = await registerAndLogin(baseUrl, "deployment.policy.write.user.2");

    const response = await fetch(
      `${baseUrl}/api/v1/deployment/policy/active-profile?workspaceId=workspace-alpha`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileId: "invalid-profile",
        }),
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid-request");
  });

  it("returns authentication failed for unauthenticated write attempts", async () => {
    const backendApi = new StubDeploymentPolicyWriteBackendApi();
    const baseUrl = await startServer(backendApi);

    const response = await fetch(
      `${baseUrl}/api/v1/deployment/policy/active-profile?workspaceId=workspace-alpha`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileId: "home",
        }),
      },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("authentication-failed");
  });

  it("maps forbidden override updates to 403", async () => {
    const backendApi = new StubDeploymentPolicyWriteBackendApi();
    const baseUrl = await startServer(backendApi);
    const token = await registerAndLogin(baseUrl, "deployment.policy.write.user.3");

    const response = await fetch(
      `${baseUrl}/api/v1/deployment/policy/overrides?workspaceId=workspace-alpha`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileId: "home",
          operations: [{
            operation: "upsert",
            familyId: "sharing-governance",
            settingKey: "workspaceDefaultVisibility",
            value: "workspace-members",
            valueType: "string",
          }],
        }),
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("forbidden");
  });
});
