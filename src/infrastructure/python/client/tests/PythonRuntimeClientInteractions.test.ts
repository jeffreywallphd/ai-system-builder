import { describe, expect, it } from "bun:test";
import { PythonRuntimeConfig } from "../../../config/PythonRuntimeConfig";
import { HttpPythonRuntimeClient } from "../HttpPythonRuntimeClient";

describe("python runtime client interactions", () => {
  it("sends execute node payload", async () => {
    let body = "";
    const client = new HttpPythonRuntimeClient(
      new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://runtime", authToken: "token" }),
      (async (_url, init) => {
        body = String(init?.body ?? "");
        return new Response(
          JSON.stringify({ executionId: "e1", nodeId: "n1", status: "completed", outputs: { ok: true } }),
          { status: 200 }
        );
      }) as typeof fetch
    );

    const result = await client.executeNode({ nodeId: "n1", nodeType: "langchain.prompt_template", inputs: { a: 1 } });
    expect(result.outputs.ok).toBe(true);
    expect(body).toContain("langchain.prompt_template");
  });
});
