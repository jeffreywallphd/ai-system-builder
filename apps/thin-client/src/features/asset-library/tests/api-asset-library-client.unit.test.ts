import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, testDouble } from "../../../../../../modules/testing/node-test";
import { createApiAssetLibraryClient } from "../api/apiAssetLibraryClient";

function installBrowserStubs(fetchMock: (...args: any[]) => unknown): void {
  (globalThis as { localStorage?: any }).localStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  };
  (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as typeof fetch;
}

function response(status: number, body: unknown) {
  return {
    status,
    json: testDouble.fn().mockResolvedValue(body),
  };
}

function queuedFetch(responses: readonly unknown[]) {
  const queue = [...responses];
  return testDouble.fn((..._args: any[]) => Promise.resolve(queue.shift()));
}

function detailValue() {
  return {
    definition: {
      definitionId: "builtin.document",
      version: "1.0.0",
      assetType: "document",
      assetFamily: "resource-backed",
      displayName: "Document",
      description: "Document descriptor",
      lifecycleStatus: "published",
      provenance: { sourceKind: "system-generated" },
    },
    builtIn: true,
  };
}

describe("api asset library client", () => {
  it("calls GET-only asset definition routes and serializes query params", async () => {
    const fetchMock = testDouble.fn().mockResolvedValue(response(200, { ok: true, value: { items: [] } }));
    installBrowserStubs(fetchMock);

    const client = createApiAssetLibraryClient({ apiBaseUrl: "/api" });
    await client.listAssetDefinitions({
      searchText: "doc",
      assetTypes: ["document"],
      assetFamilies: ["resource-backed"],
      lifecycleStatuses: ["published"],
      builtIn: "built-in",
      limit: 25,
      cursor: "next",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/assets/definitions?q=doc&assetType=document&assetFamily=resource-backed&lifecycleStatus=published&builtIn=built-in&limit=25&cursor=next");
    expect((init as RequestInit).method).toBe("GET");
  });

  it("maps successful list and detail responses", async () => {
    const fetchMock = queuedFetch([
      response(200, {
        ok: true,
        value: {
          items: [{
            definitionId: "builtin.document",
            version: "1.0.0",
            assetType: "document",
            assetFamily: "resource-backed",
            displayName: "Document",
            lifecycleStatus: "published",
            builtIn: true,
          }],
        },
      }),
      response(200, { ok: true, value: detailValue() }),
      response(200, { ok: true, value: detailValue() }),
    ]);
    installBrowserStubs(fetchMock);

    const client = createApiAssetLibraryClient({ apiBaseUrl: "/api" });
    const list = await client.listAssetDefinitions();
    const detail = await client.readAssetDefinition({ definitionId: "builtin.document" }, { expand: ["aiContext", "metadata"] });
    const version = await client.readAssetDefinitionVersion({ definitionId: "builtin.document", version: "1.0.0" }, { includeValidation: true });

    expect(list).toMatchObject({ ok: true, value: { items: [{ id: "builtin.document@1.0.0" }] } });
    expect(detail).toMatchObject({ ok: true, value: { builtIn: true, definitionId: "builtin.document" } });
    expect(version).toMatchObject({ ok: true, value: { version: "1.0.0" } });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/assets/definitions/builtin.document?expand=aiContext%2Cmetadata");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/assets/definitions/builtin.document/versions/1.0.0?includeValidation=true");
    for (const call of fetchMock.mock.calls) {
      expect((call[1] as RequestInit).method).toBe("GET");
    }
  });

  it("maps validation, not-found, and internal failures safely", async () => {
    const fetchMock = queuedFetch([
      response(400, {
        ok: false,
        error: { code: "validation", message: "Invalid asset definitions query.", details: { fieldIssues: [{ field: "limit", message: "Must be under 100." }] } },
      }),
      response(404, {
        ok: false,
        error: { code: "not-found", message: "Asset definition was not found at /tmp/secret." },
      }),
      response(500, {
        ok: false,
        error: { code: "internal", message: "stack C:\\Users\\name\\secret" },
      }),
    ]);
    installBrowserStubs(fetchMock);

    const client = createApiAssetLibraryClient({ apiBaseUrl: "/api" });
    const validation = await client.listAssetDefinitions({ limit: 999 });
    const notFound = await client.readAssetDefinition({ definitionId: "missing" });
    const internal = await client.readAssetDefinitionVersion({ definitionId: "missing", version: "9.9.9" });

    expect(validation).toMatchObject({
      ok: false,
      error: { code: "validation", message: "Invalid asset definitions query.", status: 400 },
    });
    expect(notFound).toMatchObject({
      ok: false,
      error: { code: "not-found", message: "Asset definition was not found.", status: 404 },
    });
    expect(internal).toMatchObject({
      ok: false,
      error: { code: "internal", message: "Unable to read Asset Library data.", status: 500 },
    });
    expect(JSON.stringify(internal).includes("C:\\Users\\name\\secret")).toBe(false);
  });

  it("does not expose mutation or execution methods", () => {
    const fetchMock = testDouble.fn().mockResolvedValue(response(200, { ok: true, value: { items: [] } }));
    installBrowserStubs(fetchMock);
    const client = createApiAssetLibraryClient() as unknown as Record<string, unknown>;

    for (const method of ["createAssetDefinition", "updateAssetDefinition", "deleteAssetDefinition", "seedBuiltInAssetDefinitions", "importAsset", "finalizeAsset", "scanResources", "executeAsset"]) {
      expect(client[method]).toBeUndefined();
    }
  });

  it("does not import server handlers, application services, host composition, or persistence adapters", () => {
    const source = readFileSync(join(process.cwd(), "apps/thin-client/src/features/asset-library/api/apiAssetLibraryClient.ts"), "utf8");

    expect(source).not.toContain("modules/application");
    expect(source).not.toContain("api-express");
    expect(source).not.toContain("modules/hosts");
    expect(source).not.toContain("adapters/persistence");
  });
});
