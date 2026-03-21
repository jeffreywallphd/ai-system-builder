import { describe, expect, it } from "bun:test";
import { PythonRuntimeConfig } from "../../../config/PythonRuntimeConfig";
import { HttpPythonRuntimeClient } from "../HttpPythonRuntimeClient";

describe("HttpPythonRuntimeClient", () => {
  it("calls health endpoint", async () => {
    const client = new HttpPythonRuntimeClient(
      new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://runtime" }),
      (async () => new Response(JSON.stringify({ status: "ok", runtime: "python" }), { status: 200 })) as typeof fetch
    );

    const response = await client.health();
    expect(response.status).toBe("ok");
  });

  it("keeps browser-style fetch injections callable when they rely on the global context", async () => {
    const client = new HttpPythonRuntimeClient(
      new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://runtime" }),
      (async function (this: typeof globalThis) {
        if (this !== globalThis) {
          throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation.");
        }

        return new Response(JSON.stringify({ status: "ok", runtime: "python" }), { status: 200 });
      }) as typeof fetch,
    );

    await expect(client.health()).resolves.toEqual({ status: "ok", runtime: "python" });
  });

  it("throws on non-2xx response", async () => {
    const client = new HttpPythonRuntimeClient(
      new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://runtime" }),
      (async () => new Response(JSON.stringify({ error: "bad" }), { status: 500 })) as typeof fetch
    );

    expect(client.health()).rejects.toThrow();
  });
});
