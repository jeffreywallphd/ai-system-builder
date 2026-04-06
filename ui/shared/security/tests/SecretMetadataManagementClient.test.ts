import { describe, expect, it } from "bun:test";
import { HttpSecretMetadataManagementClient } from "../SecretMetadataManagementClient";

describe("HttpSecretMetadataManagementClient", () => {
  it("calls secret metadata API endpoints with bearer auth and expected payload shape", async () => {
    const requests: Array<{ method: string; url: string; body: string; authorization?: string }> = [];
    (globalThis as typeof globalThis & {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    }).fetch = async (input, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      requests.push({
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

    const client = new HttpSecretMetadataManagementClient("http://127.0.0.1:8788/");
    await client.createSecret({
      secretId: "secret:user:openai",
      name: "personal.openai.api-key",
      owner: { scope: "user", userIdentityId: "user:alpha" },
      kind: "api-key",
      plaintext: "sk-live-input",
    }, "token-1");
    await client.listSecrets({
      owner: { scope: "workspace", workspaceId: "workspace:alpha" },
      includeDisabled: true,
      limit: 25,
      offset: 5,
    }, "token-2");
    await client.getSecret({
      secretId: "secret:user:openai",
      actorWorkspaceId: "workspace:alpha",
    }, "token-3");
    await client.rotateSecret({
      secretId: "secret:user:openai",
      plaintext: "sk-live-rotated",
      expectedCurrentVersionId: "secret:user:openai:v1",
    }, "token-4");
    await client.disableSecret({
      secretId: "secret:user:openai",
      operationKey: "op:disable:secret:user:openai",
    }, "token-5");

    expect(requests.map((entry) => entry.method)).toEqual(["POST", "GET", "GET", "POST", "POST"]);
    expect(requests.map((entry) => entry.url)).toEqual([
      "http://127.0.0.1:8788/api/v1/security/secrets",
      "http://127.0.0.1:8788/api/v1/security/secrets?scope=workspace&workspaceId=workspace%3Aalpha&includeDisabled=true&limit=25&offset=5",
      "http://127.0.0.1:8788/api/v1/security/secrets/secret%3Auser%3Aopenai?actorWorkspaceId=workspace%3Aalpha",
      "http://127.0.0.1:8788/api/v1/security/secrets/secret%3Auser%3Aopenai/rotate",
      "http://127.0.0.1:8788/api/v1/security/secrets/secret%3Auser%3Aopenai/disable",
    ]);
    for (const [index, request] of requests.entries()) {
      expect(request.authorization).toBe(`Bearer token-${index + 1}`);
    }
    const createPayload = JSON.parse(requests[0]?.body ?? "{}") as Record<string, unknown>;
    expect(createPayload.actorUserIdentityId).toBeUndefined();
    expect(createPayload.plaintext).toBe("sk-live-input");
    const rotatePayload = JSON.parse(requests[3]?.body ?? "{}") as Record<string, unknown>;
    expect(rotatePayload.plaintext).toBe("sk-live-rotated");
    const disablePayload = JSON.parse(requests[4]?.body ?? "{}") as Record<string, unknown>;
    expect(disablePayload.secretId).toBeUndefined();
  });
});
