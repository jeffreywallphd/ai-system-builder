import { describe, expect, expectTypeOf, it } from "../../../testing/node-test";
import type { AssetDefinitionCard, AssetDefinitionDetail, AssetRegistryListResult } from "../../../application/services/asset/asset-registry-read-facade.types";
import {
  API_ASSET_DEFINITION_READ_OPERATION,
  API_ASSET_DEFINITION_VERSION_READ_OPERATION,
  API_ASSET_DEFINITIONS_LIST_OPERATION,
  API_ASSET_RESOURCE_BACKED_VIEW_READ_OPERATION,
  API_ASSET_RESOURCE_BACKED_VIEWS_LIST_OPERATION,
  createApiAssetDefinitionReadFailureResponse,
  createApiAssetDefinitionReadRequest,
  createApiAssetDefinitionReadSuccessResponse,
  createApiAssetDefinitionVersionReadRequest,
  createApiAssetResourceBackedViewReadRequest,
  createApiAssetResourceBackedViewsListRequest,
  createApiAssetResourceBackedViewsListSuccessResponse,
  createApiAssetDefinitionsListRequest,
  createApiAssetDefinitionsListSuccessResponse,
  type ApiAssetDefinitionReadResponse,
  type ApiAssetDefinitionsListResponse,
} from "../asset-registry-api-contract";

describe("asset registry API contract", () => {
  it("keeps stable read-only operation identities", () => {
    expect(API_ASSET_DEFINITIONS_LIST_OPERATION).toBe("asset.definitions-list");
    expect(API_ASSET_DEFINITION_READ_OPERATION).toBe("asset.definition-read");
    expect(API_ASSET_DEFINITION_VERSION_READ_OPERATION).toBe("asset.definition-version-read");
    expect(API_ASSET_RESOURCE_BACKED_VIEWS_LIST_OPERATION).toBe("asset.resource-backed-views-list");
    expect(API_ASSET_RESOURCE_BACKED_VIEW_READ_OPERATION).toBe("asset.resource-backed-view-read");
  });

  it("uses the shared API envelope conventions with request metadata", () => {
    const request = createApiAssetDefinitionsListRequest({ q: "workflow", includeMetadata: true }, { requestId: "r1", correlationId: "c1" });
    const response = createApiAssetDefinitionsListSuccessResponse({ items: [] }, { requestId: "r1", correlationId: "c1" });

    expect(request).toMatchObject({ operation: "asset.definitions-list", requestId: "r1", correlationId: "c1", payload: { q: "workflow" } });
    expect(response).toMatchObject({ ok: true, operation: "asset.definitions-list", requestId: "r1", correlationId: "c1", value: { items: [] } });
  });

  it("wraps Asset Registry read-facade read models in API responses", () => {
    expectTypeOf<ApiAssetDefinitionsListResponse>().toExtend<{ value?: AssetRegistryListResult<AssetDefinitionCard> }>();
    expectTypeOf<ApiAssetDefinitionReadResponse>().toExtend<{ value?: AssetDefinitionDetail }>();

    const detail: AssetDefinitionDetail = {
      definition: {
        definitionId: "asset.one" as any,
        assetType: "workflow",
        assetFamily: "behavioral",
        version: "1.0.0",
        displayName: "Asset One",
        lifecycleStatus: "published",
      } as any,
    };
    expect(createApiAssetDefinitionReadSuccessResponse(detail)).toMatchObject({ ok: true, value: detail });
  });

  it("wraps resource-backed view reads in the shared API envelope", () => {
    const request = createApiAssetResourceBackedViewsListRequest({ q: "generated", viewKind: ["generated-output"] }, { requestId: "rv1" });
    const read = createApiAssetResourceBackedViewReadRequest({ viewId: " asset-view.generated-output.internal.1 ", expand: ["metadata"] });
    const response = createApiAssetResourceBackedViewsListSuccessResponse({
      items: [{ viewId: "asset-view.generated-output.internal.1", viewKind: "generated-output", displayName: "Generated output" }],
    });

    expect(request).toMatchObject({ operation: "asset.resource-backed-views-list", requestId: "rv1", payload: { q: "generated" } });
    expect(read).toMatchObject({ operation: "asset.resource-backed-view-read", payload: { viewId: "asset-view.generated-output.internal.1" } });
    expect(response).toMatchObject({ ok: true, operation: "asset.resource-backed-views-list" });
  });

  it("does not export mutation operation identities", async () => {
    const exportedNames = Object.keys(await import("../asset-registry-api-contract"));
    expect(exportedNames.filter((name) => name.includes("OPERATION")).some((name) => /(CREATE|UPDATE|DELETE|REGISTER|SEED|IMPORT|FINALIZE|PUBLISH|EXECUTE|RUN|SCAN|SYNC|REPAIR|INSTALL|START|TRAIN|VALIDATE)/.test(name))).toBe(false);
  });

  it("normalizes definition read requests and returns failure envelopes through shared API helpers", () => {
    expect(createApiAssetDefinitionReadRequest({ definitionId: " builtin.workflow ", version: " 1.0.0 " })).toMatchObject({
      ok: undefined,
      operation: "asset.definition-read",
      payload: { definitionId: "builtin.workflow", version: "1.0.0" },
    });
    expect(createApiAssetDefinitionVersionReadRequest({ definitionId: "builtin.workflow", version: "1.0.0" })).toMatchObject({ operation: "asset.definition-version-read" });
    expect(createApiAssetDefinitionReadFailureResponse("not-found", "Missing.", { requestId: "r404" })).toMatchObject({
      ok: false,
      requestId: "r404",
      error: { code: "not-found", kind: "client", message: "Missing." },
    });
  });
});
