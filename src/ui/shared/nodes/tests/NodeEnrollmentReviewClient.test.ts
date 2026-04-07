import { describe, expect, it } from "bun:test";
import { HttpNodeEnrollmentReviewClient } from "../NodeEnrollmentReviewClient";

describe("HttpNodeEnrollmentReviewClient", () => {
  it("calls node enrollment review endpoints with bearer auth", async () => {
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

    const client = new HttpNodeEnrollmentReviewClient("http://127.0.0.1:8788/");
    await client.listPendingNodeEnrollments({
      nodeId: "node:compute:1",
      statuses: ["submitted", "under-review"],
      limit: 50,
      offset: 10,
    }, "token-1");
    await client.getNodeEnrollmentDetail({
      requestId: "enrollment:1",
    }, "token-2");
    await client.approveNodeEnrollment({
      requestId: "enrollment:1",
      reviewedAt: "2026-04-05T18:00:00.000Z",
      decisionNote: "Approved",
    }, "token-3");
    await client.rejectNodeEnrollment({
      requestId: "enrollment:2",
      decisionNote: "Rejected",
    }, "token-4");

    expect(requests.map((entry) => entry.method)).toEqual(["GET", "GET", "POST", "POST"]);
    expect(requests.map((entry) => entry.url)).toEqual([
      "http://127.0.0.1:8788/api/v1/nodes/enrollments/pending?nodeId=node%3Acompute%3A1&status=submitted&status=under-review&limit=50&offset=10",
      "http://127.0.0.1:8788/api/v1/nodes/enrollments/enrollment%3A1",
      "http://127.0.0.1:8788/api/v1/nodes/enrollments/enrollment%3A1/approve",
      "http://127.0.0.1:8788/api/v1/nodes/enrollments/enrollment%3A2/reject",
    ]);
    for (const [index, request] of requests.entries()) {
      expect(request.authorization).toBe(`Bearer token-${index + 1}`);
    }
  });
});
