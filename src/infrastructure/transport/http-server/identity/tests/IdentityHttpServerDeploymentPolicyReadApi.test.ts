import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import type { DeploymentPolicyReadBackendApi } from "../../../../api/deployment/DeploymentPolicyReadBackendApi";

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

class StubDeploymentPolicyReadBackendApi {
  public lastRequest: Readonly<Record<string, unknown>> | undefined;

  public async readPolicyState(request: Readonly<Record<string, unknown>>) {
    this.lastRequest = request;
    return Object.freeze({
      ok: true as const,
      data: Object.freeze({
        scope: Object.freeze({
          kind: "deployment-policy-scope",
          scopeId: "workspace-alpha",
        }),
        activeProfile: Object.freeze({
          profileId: "organization",
          source: "persisted-selection",
        }),
        snapshot: Object.freeze({
          contractVersion: "deployment-policy-administration/v1",
          profileId: "organization",
          evaluatedAt: "2026-04-07T21:00:00.000Z",
          evaluationLayer: "application",
          preset: Object.freeze({
            profileId: "organization",
            parentProfileId: "classroom",
            lineage: Object.freeze(["home", "classroom", "organization"]),
            inheritedFrom: Object.freeze(["home", "classroom"]),
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
        validation: Object.freeze({
          valid: true,
          issues: Object.freeze([]),
          evaluatedAt: "2026-04-07T21:00:00.000Z",
        }),
        overrideRecords: Object.freeze([]),
      }),
    });
  }
}

async function startServer(
  deploymentPolicyReadBackendApi: StubDeploymentPolicyReadBackendApi,
): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    deploymentPolicyReadBackendApi: deploymentPolicyReadBackendApi as unknown as DeploymentPolicyReadBackendApi,
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

describe("IdentityHttpServer deployment policy read routes", () => {
  it("returns authoritative deployment policy state for authenticated workspace requests", async () => {
    const deploymentPolicyReadBackendApi = new StubDeploymentPolicyReadBackendApi();
    const baseUrl = await startServer(deploymentPolicyReadBackendApi);
    const token = await registerAndLogin(baseUrl, "deployment.policy.read.user.1");

    const response = await fetch(
      `${baseUrl}/api/v1/deployment/policy/state?workspaceId=workspace-alpha&profileId=organization&includeCatalog=true`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.activeProfile.profileId).toBe("organization");
    expect(deploymentPolicyReadBackendApi.lastRequest?.workspaceId).toBe("workspace-alpha");
  });

  it("returns invalid request when deployment policy read query is malformed", async () => {
    const deploymentPolicyReadBackendApi = new StubDeploymentPolicyReadBackendApi();
    const baseUrl = await startServer(deploymentPolicyReadBackendApi);
    const token = await registerAndLogin(baseUrl, "deployment.policy.read.user.2");

    const response = await fetch(
      `${baseUrl}/api/v1/deployment/policy/state?workspaceId=workspace-alpha&profileId=invalid`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid-request");
  });
});
