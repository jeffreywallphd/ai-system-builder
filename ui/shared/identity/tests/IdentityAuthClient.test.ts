import { describe, expect, it } from "bun:test";
import { HttpIdentityAuthClient } from "../IdentityAuthClient";

describe("HttpIdentityAuthClient", () => {
  it("posts register and login requests to identity API endpoints", async () => {
    const requests: ReadonlyArray<{ url: string; body: string }> = [];
    (globalThis as typeof globalThis & {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    }).fetch = async (input, init) => {
      (requests as Array<{ url: string; body: string }>).push({
        url: input,
        body: String(init?.body ?? ""),
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

    expect(requests.map((entry) => entry.url)).toEqual([
      "http://127.0.0.1:8788/api/v1/identity/register",
      "http://127.0.0.1:8788/api/v1/identity/login",
    ]);
  });
});
