import { describe, expect, it } from "bun:test";
import { HttpIdentityAuthClient } from "../IdentityAuthClient";

describe("HttpIdentityAuthClient", () => {
  it("calls register/login/session/logout/revoke identity API endpoints", async () => {
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

    const client = new HttpIdentityAuthClient("http://127.0.0.1:8788/");
    await client.registerLocalAccount({
      username: "alice",
      credential: { candidate: "password-1" },
    });
    await client.loginLocalAccount({
      providerSubject: "alice",
      credential: { candidate: "password-1" },
    });
    await client.resolveAuthenticatedSession("token-0");
    await client.logoutAuthenticatedSession("token-1");
    await client.revokeIdentitySession({ sessionId: "identity-session:1", reason: "security" }, "token-2");

    expect(requests.map((entry) => entry.method)).toEqual([
      "POST",
      "POST",
      "GET",
      "POST",
      "POST",
    ]);
    expect(requests.map((entry) => entry.url)).toEqual([
      "http://127.0.0.1:8788/api/v1/identity/register",
      "http://127.0.0.1:8788/api/v1/identity/login",
      "http://127.0.0.1:8788/api/v1/identity/session",
      "http://127.0.0.1:8788/api/v1/identity/logout",
      "http://127.0.0.1:8788/api/v1/identity/session/revoke",
    ]);
    expect(requests[2]?.authorization).toBe("Bearer token-0");
    expect(requests[3]?.authorization).toBe("Bearer token-1");
    expect(requests[4]?.authorization).toBe("Bearer token-2");
  });
});
