import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { registerAssetRegistryApiRoutes, type ExpressAssetRegistryRoutePort } from "../asset-registry/registerAssetRegistryApiRoutes";

function response() {
  const json = testDouble.fn();
  const status = testDouble.fn();
  const res: any = { status: status.mockImplementation(() => res), json };
  return { res, json, status };
}

function appAndHandlers() {
  const handlers = new Map<string, any>();
  const app: ExpressAssetRegistryRoutePort = { get: testDouble.fn((path, handler) => handlers.set(path, handler)) };
  return { app, handlers };
}

function definitionDetail(extra: Record<string, unknown> = {}) {
  return {
    definition: {
      definitionId: "builtin.workflow",
      assetType: "workflow",
      assetFamily: "behavioral",
      version: "1.0.0",
      displayName: "Workflow",
      lifecycleStatus: "published",
      ...extra,
    },
    builtIn: true,
  };
}

describe("registerAssetRegistryApiRoutes", () => {
  it("registers only GET routes for the read-only asset registry surface", () => {
    const { app } = appAndHandlers();
    registerAssetRegistryApiRoutes({ app, assetRegistryRead: { listDefinitionCards: testDouble.fn(), readDefinitionDetail: testDouble.fn() } });
    expect(app.get.mock.calls.map((call: any) => call[0])).toEqual([
      "/api/assets/definitions",
      "/api/assets/definitions/:definitionId",
      "/api/assets/definitions/:definitionId/versions/:version",
    ]);
  });

  it("lists definition cards with validated query mapping and request metadata", async () => {
    const { app, handlers } = appAndHandlers();
    const listDefinitionCards = testDouble.fn(async () => ({ items: [{ definitionId: "builtin.workflow", displayName: "Workflow" }] }));
    registerAssetRegistryApiRoutes({ app, assetRegistryRead: { listDefinitionCards, readDefinitionDetail: testDouble.fn() } as any });

    const { res, status, json } = response();
    await handlers.get("/api/assets/definitions")({
      headers: { "x-request-id": "r1", "x-correlation-id": "c1" },
      query: { q: "flow", assetType: "workflow,tool", assetFamily: "behavioral", lifecycleStatus: "published", builtIn: "built-in", limit: "10", cursor: "abc-123", includeMetadata: "true" },
    }, res);

    expect(listDefinitionCards).toHaveBeenCalledWith({
      searchText: "flow",
      assetTypes: ["workflow", "tool"],
      assetFamilies: ["behavioral"],
      lifecycleStatuses: ["published"],
      includeBuiltIns: undefined,
      includeCustom: false,
      includeMetadata: true,
      limit: 10,
      cursor: "abc-123",
    });
    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0]?.[0]).toMatchObject({ ok: true, operation: "asset.definitions-list", requestId: "r1", correlationId: "c1" });
  });

  it("reads definition details and maps expand/includeValidation options", async () => {
    const { app, handlers } = appAndHandlers();
    const readDefinitionDetail = testDouble.fn(async () => definitionDetail());
    registerAssetRegistryApiRoutes({ app, assetRegistryRead: { listDefinitionCards: testDouble.fn(), readDefinitionDetail } as any });

    const { res, status, json } = response();
    await handlers.get("/api/assets/definitions/:definitionId")({ params: { definitionId: "builtin.workflow" }, query: { version: "1.0.0", expand: "aiContext,metadata,ports", includeValidation: "true" }, headers: {} }, res);

    expect(readDefinitionDetail).toHaveBeenCalledWith(
      { kind: "asset-definition", id: "builtin.workflow", version: "1.0.0" },
      { includeValidation: true, includeAiContext: true, includeConfigurationSchema: false, includePorts: true, includeRequirements: false, includeMetadata: true },
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0]?.[0]).toMatchObject({ ok: true, operation: "asset.definition-read", value: { builtIn: true } });
  });

  it("reads a definition version through the explicit version route", async () => {
    const { app, handlers } = appAndHandlers();
    const readDefinitionDetail = testDouble.fn(async () => definitionDetail());
    registerAssetRegistryApiRoutes({ app, assetRegistryRead: { listDefinitionCards: testDouble.fn(), readDefinitionDetail } as any });
    const { res, status, json } = response();

    await handlers.get("/api/assets/definitions/:definitionId/versions/:version")({ params: { definitionId: "builtin.workflow", version: "2.0.0" }, query: {}, headers: {} }, res);

    expect(readDefinitionDetail).toHaveBeenCalledWith({ kind: "asset-definition", id: "builtin.workflow", version: "2.0.0" }, expect.any(Object));
    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0]?.[0]).toMatchObject({ ok: true, operation: "asset.definition-version-read" });
  });

  it("returns 404 when a definition is missing", async () => {
    const { app, handlers } = appAndHandlers();
    registerAssetRegistryApiRoutes({ app, assetRegistryRead: { listDefinitionCards: testDouble.fn(), readDefinitionDetail: testDouble.fn(async () => undefined) } as any });
    const { res, status, json } = response();

    await handlers.get("/api/assets/definitions/:definitionId")({ params: { definitionId: "missing" }, query: {}, headers: {} }, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json.mock.calls[0]?.[0]).toMatchObject({ ok: false, error: { code: "not-found" } });
  });

  it("rejects invalid public query parameters with validation failures", async () => {
    const invalidCases = [
      { assetType: "bad" },
      { assetFamily: "bad" },
      { lifecycleStatus: "bad" },
      { builtIn: "yes" },
      { includeMetadata: "yes" },
      { limit: "0" },
      { cursor: "/tmp/path" },
    ];

    for (const query of invalidCases) {
      const { app, handlers } = appAndHandlers();
      const listDefinitionCards = testDouble.fn();
      registerAssetRegistryApiRoutes({ app, assetRegistryRead: { listDefinitionCards, readDefinitionDetail: testDouble.fn() } as any });
      const { res, status, json } = response();
      await handlers.get("/api/assets/definitions")({ query, headers: {} }, res);
      expect(listDefinitionCards).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(400);
      expect(json.mock.calls[0]?.[0]).toMatchObject({ ok: false, error: { code: "validation" } });
    }
  });

  it("rejects invalid expansion values", async () => {
    const { app, handlers } = appAndHandlers();
    const readDefinitionDetail = testDouble.fn();
    registerAssetRegistryApiRoutes({ app, assetRegistryRead: { listDefinitionCards: testDouble.fn(), readDefinitionDetail } as any });
    const { res, status, json } = response();

    await handlers.get("/api/assets/definitions/:definitionId")({ params: { definitionId: "builtin.workflow" }, query: { expand: "aiContext,secrets" }, headers: {} }, res);

    expect(readDefinitionDetail).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json.mock.calls[0]?.[0]).toMatchObject({ ok: false, error: { code: "validation" } });
  });

  it("keeps unexpected facade failures sanitized", async () => {
    const { app, handlers } = appAndHandlers();
    registerAssetRegistryApiRoutes({ app, assetRegistryRead: { listDefinitionCards: testDouble.fn(async () => { throw new Error("/tmp/root TOKEN=abc stack"); }), readDefinitionDetail: testDouble.fn() } as any });
    const { res, status, json } = response();

    await handlers.get("/api/assets/definitions")({ query: {}, headers: { "x-request-id": "r-fail" } }, res);

    expect(status).toHaveBeenCalledWith(500);
    const payload = JSON.stringify(json.mock.calls[0]?.[0]);
    expect(payload).toContain("Unable to read asset definitions.");
    expect(payload).not.toContain("/tmp/root");
    expect(payload).not.toContain("TOKEN=abc");
    expect(payload).not.toContain("stack");
  });

  it("does not validate every list item or call resource/runtime/provider scans", async () => {
    const { app, handlers } = appAndHandlers();
    const noScan = testDouble.fn();
    const listDefinitionCards = testDouble.fn(async () => ({ items: [definitionDetail().definition] }));
    registerAssetRegistryApiRoutes({ app, assetRegistryRead: { listDefinitionCards, readDefinitionDetail: testDouble.fn(), noScan } as any });
    const { res } = response();

    await handlers.get("/api/assets/definitions")({ query: {}, headers: {} }, res);

    expect(listDefinitionCards).toHaveBeenCalledTimes(1);
    expect(noScan).not.toHaveBeenCalled();
  });

  it("relies on facade-safe payloads and does not add unsafe error details", async () => {
    const { app, handlers } = appAndHandlers();
    registerAssetRegistryApiRoutes({ app, assetRegistryRead: { listDefinitionCards: testDouble.fn(), readDefinitionDetail: testDouble.fn(async () => definitionDetail({ metadata: { safe: "yes" } })) } as any });
    const { res, json } = response();

    await handlers.get("/api/assets/definitions/:definitionId")({ params: { definitionId: "builtin.workflow" }, query: { expand: "metadata" }, headers: {} }, res);

    const payload = JSON.stringify(json.mock.calls[0]?.[0]);
    expect(payload).toContain("safe");
    expect(payload).not.toContain("/tmp");
    expect(payload).not.toContain("TOKEN=");
  });
});
