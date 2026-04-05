import { describe, expect, it } from "bun:test";
import { HttpNodeInventoryClient } from "../NodeInventoryClient";

describe("HttpNodeInventoryClient", () => {
  it("calls node inventory endpoints with query filters and bearer auth", async () => {
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

    const client = new HttpNodeInventoryClient("http://127.0.0.1:8788/");
    await client.listNodeInventory({
      nodeTypes: ["compute"],
      approvalStatuses: ["approved"],
      operationalStates: ["active"],
      enrollmentStatuses: ["approved"],
      presenceStates: ["online"],
      capabilityAnyOf: ["executor"],
      deploymentTagAnyOf: ["prod"],
      lastSeenAfter: "2026-04-01T00:00:00.000Z",
      lastSeenBefore: "2026-04-05T00:00:00.000Z",
      limit: 25,
      offset: 10,
    }, "token-1");
    await client.getNodeInventoryDetail({ nodeId: "node:compute:1" }, "token-2");

    expect(requests.map((entry) => entry.method)).toEqual(["GET", "GET"]);
    expect(requests.map((entry) => entry.url)).toEqual([
      "http://127.0.0.1:8788/api/v1/nodes/inventory?nodeType=compute&approvalStatus=approved&operationalState=active&enrollmentStatus=approved&presenceState=online&capability=executor&deploymentTag=prod&lastSeenAfter=2026-04-01T00%3A00%3A00.000Z&lastSeenBefore=2026-04-05T00%3A00%3A00.000Z&limit=25&offset=10",
      "http://127.0.0.1:8788/api/v1/nodes/inventory/node%3Acompute%3A1",
    ]);
    expect(requests[0]?.authorization).toBe("Bearer token-1");
    expect(requests[1]?.authorization).toBe("Bearer token-2");
  });
});
