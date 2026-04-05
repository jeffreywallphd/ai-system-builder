import { describe, expect, it } from "bun:test";
import { HttpAuthorizationManagementClient } from "../AuthorizationManagementClient";

describe("HttpAuthorizationManagementClient", () => {
  it("calls authorization management endpoints with bearer auth", async () => {
    const requests: ReadonlyArray<{ method: string; url: string; body: string; authorization?: string }> = [];
    (globalThis as typeof globalThis & {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    }).fetch = async (input, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      (requests as Array<{ method: string; url: string; body: string; authorization?: string }>).push({
        method: String(init?.method ?? "GET"),
        url: input,
        body: String(init?.body ?? ""),
        authorization: headers?.authorization,
      });

      return new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = new HttpAuthorizationManagementClient("http://127.0.0.1:8788/");
    await client.readAccessState({
      resourceFamily: "asset",
      resourceType: "asset",
      resourceId: "asset:1",
      includeDenied: true,
      includeRevokedSharingGrants: false,
      asOf: "2026-04-05T12:00:00.000Z",
    }, "token-1");
    await client.updateVisibility({
      resourceFamily: "asset",
      resourceType: "asset",
      resourceId: "asset:1",
      workspaceId: "workspace:1",
      visibility: "shared",
      sharingPolicyMode: "explicit",
      allowResharing: false,
      expectedRevision: 4,
    }, "token-2");
    await client.grantSharingAccess({
      resourceFamily: "asset",
      resourceType: "asset",
      resourceId: "asset:1",
      workspaceId: "workspace:1",
      grant: {
        id: "grant:1",
        target: {
          kind: "user",
          userId: "user:1",
        },
        permissionKeys: ["asset.read"],
      },
    }, "token-3");
    await client.revokeSharingAccess({
      resourceFamily: "asset",
      resourceType: "asset",
      resourceId: "asset:1",
      grantId: "grant:1",
      expectedRevision: 5,
    }, "token-4");

    expect(requests.map((entry) => entry.method)).toEqual(["GET", "PATCH", "POST", "DELETE"]);
    expect(requests.map((entry) => entry.url)).toEqual([
      "http://127.0.0.1:8788/api/v1/authorization/resources/asset/asset/asset%3A1/access-state?asOf=2026-04-05T12%3A00%3A00.000Z&includeDenied=true&includeRevokedSharingGrants=false",
      "http://127.0.0.1:8788/api/v1/authorization/resources/asset/asset/asset%3A1/visibility",
      "http://127.0.0.1:8788/api/v1/authorization/resources/asset/asset/asset%3A1/sharing-grants",
      "http://127.0.0.1:8788/api/v1/authorization/resources/asset/asset/asset%3A1/sharing-grants/grant%3A1",
    ]);
    for (const [index, request] of requests.entries()) {
      expect(request.authorization).toBe(`Bearer token-${index + 1}`);
    }
  });
});
