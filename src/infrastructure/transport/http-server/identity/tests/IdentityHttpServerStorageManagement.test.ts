import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { StorageManagementBackendApi } from "../../../../api/storage/StorageManagementBackendApi";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import type {
  IStorageManagementService,
  StorageManagementResult,
} from "@application/storage/use-cases/StorageManagementServiceContracts";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  StorageManagedActions,
  createStorageInstance,
  type StorageInstance,
} from "@domain/storage/StorageDomain";

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

class StubStorageManagementService implements IStorageManagementService {
  private readonly storageInstance: StorageInstance = createStorageInstance({
    id: "storage-alpha",
    displayName: "Storage Alpha",
    backendType: StorageBackendTypes.managedFilesystem,
    lifecycleState: StorageLifecycleStates.active,
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    },
    access: {
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    policy: {
      policyId: "policy-alpha",
      labels: {
        purpose: "tests",
      },
      encryption: {
        profileId: "enc-profile-alpha",
        envelopeRequired: true,
      },
    },
    createdBy: "user-owner",
    createdAt: "2026-04-06T12:00:00.000Z",
    lastModifiedBy: "user-owner",
    lastModifiedAt: "2026-04-06T12:00:00.000Z",
    lastCorrelationId: "corr-storage-alpha",
  });

  public async createStorageInstance(): Promise<StorageManagementResult<any>> {
    return this.okResult(this.storageInstance);
  }

  public async updateStorageMetadata(): Promise<StorageManagementResult<any>> {
    return this.okResult(this.storageInstance);
  }

  public async activateStorageInstance(): Promise<StorageManagementResult<any>> {
    return {
      ok: false,
      error: {
        code: "storage-policy-violation",
        message: "Forbidden storage action.",
      },
    };
  }

  public async deactivateStorageInstance(): Promise<StorageManagementResult<any>> {
    return this.okResult({
      ...this.storageInstance,
      lifecycleState: StorageLifecycleStates.suspended,
      lastModifiedAt: "2026-04-06T12:30:00.000Z",
      lastCorrelationId: "corr-storage-suspend",
    });
  }

  public async listAccessibleStorageInstances(): Promise<StorageManagementResult<any>> {
    return {
      ok: true,
      value: {
        items: [{
          storageInstance: this.storageInstance,
          accessSummary: this.accessSummary(),
        }],
      },
    };
  }

  public async getStorageInstanceDetails(): Promise<StorageManagementResult<any>> {
    return this.okResult(this.storageInstance);
  }

  public async inspectStorageInstanceStatus(): Promise<StorageManagementResult<any>> {
    return {
      ok: true,
      value: {
        storageInstance: this.storageInstance,
        accessSummary: this.accessSummary(),
        capabilities: {
          backendType: this.storageInstance.backendType,
          supportsManagedLifecycle: true,
          supportsAsyncReplication: false,
          supportsSyncReplication: false,
          supportsReadOnlyActive: true,
          supportsCrossWorkspaceReads: false,
        },
        lifecycleState: this.storageInstance.lifecycleState,
        operationalStatus: "healthy",
        lastCheckedAt: "2026-04-06T12:40:00.000Z",
        reasonCode: "binding-health-healthy",
        operationalNotes: ["binding-health:healthy"],
      },
    };
  }

  private okResult(storageInstance: StorageInstance): StorageManagementResult<any> {
    return {
      ok: true,
      value: {
        storageInstance,
        accessSummary: this.accessSummary(),
      },
    };
  }

  private accessSummary() {
    return Object.freeze({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
      isOwner: true,
      source: "authorization-policy" as const,
      effectivePermissions: Object.freeze(Object.values(StorageManagedActions).map((action) => Object.freeze({
        action,
        effect: "allowed" as const,
      }))),
      allowedActions: Object.freeze(Object.values(StorageManagedActions)),
      policyRestrictedCapabilities: Object.freeze([]),
    });
  }
}

async function startServer(): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const storageManagementBackendApi = new StorageManagementBackendApi({
    storageManagementService: new StubStorageManagementService(),
  });

  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    storageManagementBackendApi,
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

describe("IdentityHttpServer storage management routes", () => {
  it("serves authenticated storage create/list/detail/update/deactivate/health flows", async () => {
    const baseUrl = await startServer();
    const token = await registerAndLogin(baseUrl, "storage.http.owner");

    const unauthenticatedList = await fetch(`${baseUrl}/api/v1/storage/instances?workspaceId=workspace-alpha`);
    expect(unauthenticatedList.status).toBe(401);

    const createResponse = await fetch(`${baseUrl}/api/v1/storage/instances?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        storageInstanceId: "storage-alpha",
        backendType: "managed-filesystem",
        display: {
          displayName: "Storage Alpha",
        },
        ownerUserIdentityId: "user-owner",
        access: {
          mode: "read-write",
          scope: "workspace-members",
        },
        policy: {
          policyId: "policy-alpha",
          labels: {
            purpose: "tests",
          },
          encryptionProfileId: "enc-profile-alpha",
          envelopeRequired: true,
        },
      }),
    });
    expect(createResponse.status).toBe(200);
    const createBody = await createResponse.json();
    expect(createBody.ok).toBe(true);
    expect(createBody.data.storage.storageInstanceId).toBe("storage-alpha");
    expect(createBody.data.storage.sensitiveRedaction.contractVersion).toBe("storage-transport/v1");

    const listResponse = await fetch(`${baseUrl}/api/v1/storage/instances?workspaceId=workspace-alpha&includeCapabilities=true`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.data.items).toHaveLength(1);

    const detailResponse = await fetch(`${baseUrl}/api/v1/storage/instances/storage-alpha?workspaceId=workspace-alpha&includeCapabilities=true`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.ok).toBe(true);
    expect(detailBody.data.storage.storageInstanceId).toBe("storage-alpha");

    const updateResponse = await fetch(`${baseUrl}/api/v1/storage/instances/storage-alpha/metadata?workspaceId=workspace-alpha`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        display: {
          displayName: "Storage Alpha Updated",
        },
        policy: {
          labels: {
            purpose: "tests-updated",
          },
        },
      }),
    });
    expect(updateResponse.status).toBe(200);
    const updateBody = await updateResponse.json();
    expect(updateBody.ok).toBe(true);

    const deactivateResponse = await fetch(`${baseUrl}/api/v1/storage/instances/storage-alpha/deactivate?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    expect(deactivateResponse.status).toBe(200);
    const deactivateBody = await deactivateResponse.json();
    expect(deactivateBody.ok).toBe(true);

    const healthResponse = await fetch(`${baseUrl}/api/v1/storage/instances/storage-alpha/health?workspaceId=workspace-alpha`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(healthResponse.status).toBe(200);
    const healthBody = await healthResponse.json();
    expect(healthBody.ok).toBe(true);
    expect(healthBody.data.storage.storageInstanceId).toBe("storage-alpha");
    expect(healthBody.data.synchronizationStatus).toBe("disabled");
    expect(healthBody.data.operationalStatus).toBe("healthy");
    expect(healthBody.data.lastCheckedAt).toBe("2026-04-06T12:40:00.000Z");
  });

  it("maps policy violations and invalid query input to stable HTTP responses", async () => {
    const baseUrl = await startServer();
    const token = await registerAndLogin(baseUrl, "storage.http.owner.2");

    const activationResponse = await fetch(`${baseUrl}/api/v1/storage/instances/storage-alpha/activate?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    expect(activationResponse.status).toBe(403);
    const activationBody = await activationResponse.json();
    expect(activationBody.ok).toBe(false);
    expect(activationBody.error.code).toBe("forbidden");

    const invalidListResponse = await fetch(
      `${baseUrl}/api/v1/storage/instances?workspaceId=workspace-alpha&backendType=not-a-backend`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );
    expect(invalidListResponse.status).toBe(400);
  });
});

