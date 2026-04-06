import { describe, expect, it } from "bun:test";
import { HttpStorageAdministrationClient } from "../StorageAdministrationClient";

describe("HttpStorageAdministrationClient", () => {
  it("calls storage administration endpoints with bearer auth and query filters", async () => {
    const requests: ReadonlyArray<{ method: string; url: string; authorization?: string }> = [];
    (globalThis as typeof globalThis & {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    }).fetch = async (input, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      (requests as Array<{ method: string; url: string; authorization?: string }>).push({
        method: String(init?.method ?? "GET"),
        url: input,
        authorization: headers?.authorization,
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

    expect(requests.map((entry) => entry.method)).toEqual(["GET", "GET", "GET"]);
    expect(requests.map((entry) => entry.url)).toEqual([
      "http://127.0.0.1:8788/api/v1/storage/instances?workspaceId=workspace%3Aalpha&backendType=object-storage&lifecycleState=active&accessMode=read-write&accessScope=workspace-members&occurredAt=2026-04-06T10%3A00%3A00.000Z&includeCapabilities=true&limit=25&offset=5",
      "http://127.0.0.1:8788/api/v1/storage/instances/storage%3Aimages%3A1?workspaceId=workspace%3Aalpha&includeCapabilities=true",
      "http://127.0.0.1:8788/api/v1/storage/instances/storage%3Aimages%3A1/health?workspaceId=workspace%3Aalpha&occurredAt=2026-04-06T10%3A05%3A00.000Z",
    ]);
    expect(requests[0]?.authorization).toBe("Bearer token-1");
    expect(requests[1]?.authorization).toBe("Bearer token-2");
    expect(requests[2]?.authorization).toBe("Bearer token-3");
  });
});
