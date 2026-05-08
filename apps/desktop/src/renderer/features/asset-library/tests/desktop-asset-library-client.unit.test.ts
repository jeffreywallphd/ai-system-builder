import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, testDouble } from "../../../../../../../modules/testing/node-test";
import { createDesktopAssetLibraryClient } from "../api/desktopAssetLibraryClient";

function setDesktopApi(api: Record<string, unknown>): void {
  (globalThis as unknown as { window?: Record<string, unknown> }).window = { desktopApi: api };
}

function success(value: unknown) {
  return { ok: true, value };
}

function failure(code: string, message: string, details?: unknown) {
  return { ok: false, error: { code, message, details }, requestId: "req-1", correlationId: "corr-1" };
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
      provenance: { sourceKind: "system-generated", updatedAt: "2026-05-02T00:00:00.000Z" },
    },
    builtIn: true,
  };
}

describe("desktop asset library client", () => {
  it("calls read-only desktopApi methods and maps successful list responses", async () => {
    const api = {
      listAssetDefinitions: testDouble.fn().mockResolvedValue(success({
        items: [{
          definitionId: "builtin.document",
          version: "1.0.0",
          assetType: "document",
          assetFamily: "resource-backed",
          displayName: "Document",
          lifecycleStatus: "published",
          builtIn: true,
        }],
      })),
      readAssetDefinition: testDouble.fn().mockResolvedValue(success(detailValue())),
      readAssetDefinitionVersion: testDouble.fn().mockResolvedValue(success(detailValue())),
    };
    setDesktopApi(api);

    const client = createDesktopAssetLibraryClient();
    const result = await client.listAssetDefinitions({ searchText: "doc", builtIn: "built-in", limit: 10 });

    expect(api.listAssetDefinitions).toHaveBeenCalledWith({ searchText: "doc", builtIn: "built-in", limit: 10 });
    expect(result).toMatchObject({
      ok: true,
      value: { items: [{ id: "builtin.document@1.0.0", builtIn: true }] },
    });
  });

  it("maps successful detail and version responses", async () => {
    const api = {
      listAssetDefinitions: testDouble.fn().mockResolvedValue(success({ items: [] })),
      readAssetDefinition: testDouble.fn().mockResolvedValue(success(detailValue())),
      readAssetDefinitionVersion: testDouble.fn().mockResolvedValue(success(detailValue())),
    };
    setDesktopApi(api);

    const client = createDesktopAssetLibraryClient();
    const detail = await client.readAssetDefinition({ definitionId: "builtin.document" }, { expand: ["aiContext"] });
    const version = await client.readAssetDefinitionVersion({ definitionId: "builtin.document", version: "1.0.0" }, { includeValidation: true });

    expect(api.readAssetDefinition).toHaveBeenCalledWith({ definitionId: "builtin.document", expand: ["aiContext"], includeValidation: undefined });
    expect(api.readAssetDefinitionVersion).toHaveBeenCalledWith({ definitionId: "builtin.document", version: "1.0.0", expand: undefined, includeValidation: true });
    expect(detail).toMatchObject({ ok: true, value: { definitionId: "builtin.document" } });
    expect(version).toMatchObject({ ok: true, value: { version: "1.0.0" } });
  });

  it("maps validation, not-found, and internal failures safely", async () => {
    const api = {
      listAssetDefinitions: testDouble.fn().mockResolvedValue(failure("validation", "Invalid query.", {
        fieldIssues: [{ field: "limit", message: "Must be under 100." }],
      })),
      readAssetDefinition: testDouble.fn().mockResolvedValue(failure("not-found", "missing /tmp/secret")),
      readAssetDefinitionVersion: testDouble.fn().mockResolvedValue(failure("internal", "stack at C:\\Users\\name\\secret")),
    };
    setDesktopApi(api);

    const client = createDesktopAssetLibraryClient();
    const validation = await client.listAssetDefinitions({ limit: 999 });
    const notFound = await client.readAssetDefinition({ definitionId: "missing" });
    const internal = await client.readAssetDefinitionVersion({ definitionId: "builtin.document", version: "9.9.9" });

    expect(validation).toMatchObject({
      ok: false,
      error: { code: "validation", message: "Invalid query.", fieldIssues: [{ field: "limit", message: "Must be under 100." }] },
    });
    expect(notFound).toMatchObject({ ok: false, error: { code: "not-found", message: "Asset definition was not found." } });
    expect(internal).toMatchObject({ ok: false, error: { code: "internal", message: "Unable to read Asset Library data." } });
    expect(JSON.stringify(internal).includes("C:\\Users\\name\\secret")).toBe(false);
  });

  it("does not expose mutation or execution methods", () => {
    setDesktopApi({
      listAssetDefinitions: testDouble.fn().mockResolvedValue(success({ items: [] })),
      readAssetDefinition: testDouble.fn().mockResolvedValue(success(detailValue())),
      readAssetDefinitionVersion: testDouble.fn().mockResolvedValue(success(detailValue())),
    });
    const client = createDesktopAssetLibraryClient() as unknown as Record<string, unknown>;

    for (const method of ["createAssetDefinition", "updateAssetDefinition", "deleteAssetDefinition", "seedBuiltInAssetDefinitions", "importAsset", "finalizeAsset", "scanResources", "executeAsset"]) {
      expect(client[method]).toBeUndefined();
    }
  });

  it("does not import forbidden application, host, persistence, or transport handler modules", () => {
    const source = readFileSync(join(process.cwd(), "apps/desktop/src/renderer/features/asset-library/api/desktopAssetLibraryClient.ts"), "utf8");

    expect(source).not.toContain("modules/application");
    expect(source).not.toContain("modules/hosts");
    expect(source).not.toContain("adapters/persistence");
    expect(source).not.toContain("ipc-electron");
  });
});
