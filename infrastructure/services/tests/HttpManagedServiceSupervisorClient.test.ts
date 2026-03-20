import { describe, expect, it } from "bun:test";
import { HttpManagedServiceSupervisorClient } from "../HttpManagedServiceSupervisorClient";

describe("HttpManagedServiceSupervisorClient", () => {
  it("issues typed supervisor requests with encoded service ids and auth headers", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const client = new HttpManagedServiceSupervisorClient({
      baseUrl: "http://supervisor/",
      timeoutMs: 1_000,
      authToken: "token",
    }, (async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({
        ok: true,
        service: {
          serviceId: "python runtime",
          name: "Python runtime",
          args: [],
          pid: null,
          startedAt: null,
          lastHealthCheckAt: "2026-03-20T00:00:00.000Z",
          state: "healthy",
          ownership: "external",
          recentLogs: [],
        },
      }), { status: 200 });
    }) as typeof fetch);

    const response = await client.ensureRunning("python runtime");

    expect(response.service.state).toBe("healthy");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("http://supervisor/services/python%20runtime/ensure-running");
    expect(requests[0]?.init?.method).toBe("POST");
    expect(requests[0]?.init?.headers).toMatchObject({
      "content-type": "application/json",
      authorization: "Bearer token",
    });
    expect(requests[0]?.init?.body).toBe("{}");
  });

  it("surfaces supervisor error payload messages", async () => {
    const client = new HttpManagedServiceSupervisorClient(
      { baseUrl: "http://supervisor" },
      (async () => new Response(JSON.stringify({ message: "Unknown service 'python-runtime'." }), { status: 404 })) as typeof fetch,
    );

    await expect(client.getService("python-runtime")).rejects.toThrow("Unknown service 'python-runtime'.");
  });
});
