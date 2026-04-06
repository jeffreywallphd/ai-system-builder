import { describe, expect, it } from "bun:test";
import { HttpStorageAdministrationClient } from "../StorageAdministrationClient";

describe("HttpStorageAdministrationClient", () => {
  it("calls storage administration endpoints with bearer auth and query filters", async () => {
    const requests: ReadonlyArray<{ method: string; url: string; authorization?: string; body?: string }> = [];
    (globalThis as typeof globalThis & {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    }).fetch = async (input, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      (requests as Array<{ method: string; url: string; authorization?: string; body?: string }>).push({
        method: String(init?.method ?? "GET"),
        url: input,
        authorization: headers?.authorization,
        body: typeof init?.body === "string" ? init.body : undefined,
      });
      return new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = new HttpStorageAdministrationClient("http://127.0.0.1:8788/");
    await client.listStorageInstances({
      workspaceId: "workspace:alpha",
      backendTypes: ["object-storage"],
      lifecycleStates: ["active"],
      accessModes: ["read-write"],
      accessScopes: ["workspace-members"],
      limit: 25,
      offset: 5,
      includeCapabilities: true,
      occurredAt: "2026-04-06T10:00:00.000Z",
    }, "token-1");
    await client.getStorageInstanceDetail({
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage:images:1",
      includeCapabilities: true,
    }, "token-2");
    await client.getStorageInstanceHealth({
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage:images:1",
      occurredAt: "2026-04-06T10:05:00.000Z",
    }, "token-3");
    await client.createStorageInstance({
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage:created:1",
      backendType: "managed-filesystem",
      display: {
        displayName: "Created storage",
      },
      ownerUserIdentityId: "user:owner:1",
      access: {
        mode: "read-write",
        scope: "workspace-members",
      },
      policy: {
        policyId: "policy:storage:created:1",
        immutableWrites: true,
        allowCrossWorkspaceReads: false,
        labels: {
          purpose: "assets",
        },
        encryptionMode: "platform-managed",
        contentEncryptionRequired: true,
        keyScope: "workspace",
        allowPreviewDecryption: false,
        allowWorkerDecryption: false,
        retentionExpiryAction: "none",
        encryptionProfileId: "enc-profile:workspace",
        envelopeRequired: true,
      },
      requestBackendProvisioning: true,
      includeCapabilities: true,
    }, "token-4");
    await client.updateStorageMetadata({
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage:created:1",
      display: {
        displayName: "Created storage updated",
      },
      policy: {
        labels: {
          purpose: "assets-updated",
        },
      },
      occurredAt: "2026-04-06T10:10:00.000Z",
      includeCapabilities: true,
    }, "token-5");

    expect(requests.map((entry) => entry.method)).toEqual(["GET", "GET", "GET", "POST", "PATCH"]);
    expect(requests.map((entry) => entry.url)).toEqual([
      "http://127.0.0.1:8788/api/v1/storage/instances?workspaceId=workspace%3Aalpha&backendType=object-storage&lifecycleState=active&accessMode=read-write&accessScope=workspace-members&occurredAt=2026-04-06T10%3A00%3A00.000Z&includeCapabilities=true&limit=25&offset=5",
      "http://127.0.0.1:8788/api/v1/storage/instances/storage%3Aimages%3A1?workspaceId=workspace%3Aalpha&includeCapabilities=true",
      "http://127.0.0.1:8788/api/v1/storage/instances/storage%3Aimages%3A1/health?workspaceId=workspace%3Aalpha&occurredAt=2026-04-06T10%3A05%3A00.000Z",
      "http://127.0.0.1:8788/api/v1/storage/instances?workspaceId=workspace%3Aalpha",
      "http://127.0.0.1:8788/api/v1/storage/instances/storage%3Acreated%3A1/metadata?workspaceId=workspace%3Aalpha",
    ]);
    expect(requests[0]?.authorization).toBe("Bearer token-1");
    expect(requests[1]?.authorization).toBe("Bearer token-2");
    expect(requests[2]?.authorization).toBe("Bearer token-3");
    expect(requests[3]?.authorization).toBe("Bearer token-4");
    expect(requests[4]?.authorization).toBe("Bearer token-5");
    expect(requests[3]?.body).toContain("\"storageInstanceId\":\"storage:created:1\"");
    expect(requests[4]?.body).toContain("\"displayName\":\"Created storage updated\"");
    expect(requests[4]?.body).toContain("\"occurredAt\":\"2026-04-06T10:10:00.000Z\"");
  });
});
