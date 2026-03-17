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

  it("throws on non-2xx response", async () => {
    const client = new HttpPythonRuntimeClient(
      new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://runtime" }),
      (async () => new Response(JSON.stringify({ error: "bad" }), { status: 500 })) as typeof fetch
    );

    expect(client.health()).rejects.toThrow();
  });
});
