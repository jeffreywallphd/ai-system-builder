import { describe, expect, expectTypeOf, it } from "../../../testing/node-test";
import type { AssetDefinitionCard, AssetDefinitionDetail, AssetRegistryListResult } from "../../../application/services/asset/asset-registry-read-facade.types";
import {
  API_ASSET_DEFINITION_READ_OPERATION,
  API_ASSET_DEFINITION_VERSION_READ_OPERATION,
  API_ASSET_DEFINITIONS_LIST_OPERATION,
  createApiAssetDefinitionReadFailureResponse,
  createApiAssetDefinitionReadRequest,
  createApiAssetDefinitionReadSuccessResponse,
  createApiAssetDefinitionVersionReadRequest,
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

  it("does not export mutation operation identities", async () => {
    const exportedNames = Object.keys(await import("../asset-registry-api-contract"));
    expect(exportedNames.filter((name) => name.includes("OPERATION")).some((name) => /(CREATE|UPDATE|DELETE|REGISTER|SEED|IMPORT|FINALIZE)/.test(name))).toBe(false);
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
