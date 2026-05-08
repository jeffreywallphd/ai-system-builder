import { describe, expect, expectTypeOf, it } from "../../../testing/node-test";
import type {
  AssetDefinitionCard,
  AssetDefinitionDetail,
  AssetRegistryListResult,
  AssetRegistryResourceBackedViewCard,
} from "../../../application/services/asset/asset-registry-read-facade.types";
import {
  DESKTOP_ASSET_DEFINITIONS_LIST_OPERATION,
  DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL,
  DESKTOP_ASSET_DEFINITIONS_LIST_RESPONSE_CHANNEL,
  DESKTOP_ASSET_DEFINITION_READ_OPERATION,
  DESKTOP_ASSET_DEFINITION_READ_REQUEST_CHANNEL,
  DESKTOP_ASSET_DEFINITION_READ_RESPONSE_CHANNEL,
  DESKTOP_ASSET_DEFINITION_VERSION_READ_OPERATION,
  DESKTOP_ASSET_DEFINITION_VERSION_READ_REQUEST_CHANNEL,
  DESKTOP_ASSET_DEFINITION_VERSION_READ_RESPONSE_CHANNEL,
  DESKTOP_ASSET_RESOURCE_BACKED_VIEW_READ_OPERATION,
  DESKTOP_ASSET_RESOURCE_BACKED_VIEW_READ_REQUEST_CHANNEL,
  DESKTOP_ASSET_RESOURCE_BACKED_VIEW_READ_RESPONSE_CHANNEL,
  DESKTOP_ASSET_RESOURCE_BACKED_VIEWS_LIST_OPERATION,
  DESKTOP_ASSET_RESOURCE_BACKED_VIEWS_LIST_REQUEST_CHANNEL,
  DESKTOP_ASSET_RESOURCE_BACKED_VIEWS_LIST_RESPONSE_CHANNEL,
  createDesktopAssetDefinitionReadRequest,
  createDesktopAssetDefinitionReadSuccessResponse,
  createDesktopAssetDefinitionVersionReadRequest,
  createDesktopAssetResourceBackedViewReadRequest,
  createDesktopAssetResourceBackedViewsListRequest,
  createDesktopAssetResourceBackedViewsListSuccessResponse,
  createDesktopAssetDefinitionsListRequest,
  createDesktopAssetDefinitionsListSuccessResponse,
  getDesktopAssetDefinitionReadChannel,
  getDesktopAssetDefinitionVersionReadChannel,
  getDesktopAssetResourceBackedViewReadChannel,
  getDesktopAssetResourceBackedViewsListChannel,
  getDesktopAssetDefinitionsListChannel,
  type DesktopAssetDefinitionReadResponse,
  type DesktopAssetDefinitionsListResponse,
} from "../desktop-asset-registry-contract";

describe("desktop asset registry IPC contract", () => {
  it("uses stable operation identities", () => {
    expect(DESKTOP_ASSET_DEFINITIONS_LIST_OPERATION).toBe("asset.definitions-list");
    expect(DESKTOP_ASSET_DEFINITION_READ_OPERATION).toBe("asset.definition-read");
    expect(DESKTOP_ASSET_DEFINITION_VERSION_READ_OPERATION).toBe("asset.definition-version-read");
    expect(DESKTOP_ASSET_RESOURCE_BACKED_VIEWS_LIST_OPERATION).toBe("asset.resource-backed-views-list");
    expect(DESKTOP_ASSET_RESOURCE_BACKED_VIEW_READ_OPERATION).toBe("asset.resource-backed-view-read");
  });

  it("derives request and response channels from operation identities", () => {
    expect(DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL.value).toBe("ipc.asset.definitions-list.request");
    expect(DESKTOP_ASSET_DEFINITIONS_LIST_RESPONSE_CHANNEL.value).toBe("ipc.asset.definitions-list.response");
    expect(DESKTOP_ASSET_DEFINITION_READ_REQUEST_CHANNEL.value).toBe("ipc.asset.definition-read.request");
    expect(DESKTOP_ASSET_DEFINITION_READ_RESPONSE_CHANNEL.value).toBe("ipc.asset.definition-read.response");
    expect(DESKTOP_ASSET_DEFINITION_VERSION_READ_REQUEST_CHANNEL.value).toBe("ipc.asset.definition-version-read.request");
    expect(DESKTOP_ASSET_DEFINITION_VERSION_READ_RESPONSE_CHANNEL.value).toBe("ipc.asset.definition-version-read.response");
    expect(DESKTOP_ASSET_RESOURCE_BACKED_VIEWS_LIST_REQUEST_CHANNEL.value).toBe("ipc.asset.resource-backed-views-list.request");
    expect(DESKTOP_ASSET_RESOURCE_BACKED_VIEWS_LIST_RESPONSE_CHANNEL.value).toBe("ipc.asset.resource-backed-views-list.response");
    expect(DESKTOP_ASSET_RESOURCE_BACKED_VIEW_READ_REQUEST_CHANNEL.value).toBe("ipc.asset.resource-backed-view-read.request");
    expect(DESKTOP_ASSET_RESOURCE_BACKED_VIEW_READ_RESPONSE_CHANNEL.value).toBe("ipc.asset.resource-backed-view-read.response");
    expect(getDesktopAssetDefinitionsListChannel("request")).toBe(DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL);
    expect(getDesktopAssetDefinitionReadChannel("response")).toBe(DESKTOP_ASSET_DEFINITION_READ_RESPONSE_CHANNEL);
    expect(getDesktopAssetDefinitionVersionReadChannel("request")).toBe(DESKTOP_ASSET_DEFINITION_VERSION_READ_REQUEST_CHANNEL);
    expect(getDesktopAssetResourceBackedViewsListChannel("request")).toBe(DESKTOP_ASSET_RESOURCE_BACKED_VIEWS_LIST_REQUEST_CHANNEL);
    expect(getDesktopAssetResourceBackedViewReadChannel("response")).toBe(DESKTOP_ASSET_RESOURCE_BACKED_VIEW_READ_RESPONSE_CHANNEL);
  });

  it("uses existing IPC request and response envelope conventions", () => {
    const request = createDesktopAssetDefinitionsListRequest(
      {
        searchText: "workflow",
        builtIn: "built-in",
        boundary: { host: "desktop", source: "desktop.renderer.asset-registry" },
      },
      { requestId: "req-assets", correlationId: "corr-assets" },
    );
    const response = createDesktopAssetDefinitionsListSuccessResponse({ items: [] }, {
      requestId: request.requestId,
      correlationId: request.correlationId,
    });

    expect(request).toMatchObject({
      ok: undefined,
      operation: "asset.definitions-list",
      channel: "ipc.asset.definitions-list.request",
      requestId: "req-assets",
      correlationId: "corr-assets",
    });
    expect(response).toMatchObject({
      ok: true,
      operation: "asset.definitions-list",
      channel: "ipc.asset.definitions-list.response",
      requestId: "req-assets",
      correlationId: "corr-assets",
      value: { items: [] },
    });
  });

  it("wraps Asset Registry read facade models instead of redefining asset semantics", () => {
    expectTypeOf<DesktopAssetDefinitionsListResponse>().toEqualTypeOf<import("../ipc-response").IpcResponse<
      AssetRegistryListResult<AssetDefinitionCard>,
      Record<string, unknown>,
      typeof DESKTOP_ASSET_DEFINITIONS_LIST_OPERATION,
      Record<string, never>,
      typeof DESKTOP_ASSET_DEFINITIONS_LIST_RESPONSE_CHANNEL.value
    >>();
    expectTypeOf<DesktopAssetDefinitionReadResponse>().toEqualTypeOf<import("../ipc-response").IpcResponse<
      AssetDefinitionDetail,
      Record<string, unknown>,
      typeof DESKTOP_ASSET_DEFINITION_READ_OPERATION,
      Record<string, never>,
      typeof DESKTOP_ASSET_DEFINITION_READ_RESPONSE_CHANNEL.value
    >>();
  });

  it("preserves request metadata for read and version-read helpers", () => {
    const read = createDesktopAssetDefinitionReadRequest(
      { definitionId: "builtin.workflow", expand: ["metadata"], boundary: { host: "desktop", source: "renderer" } },
      { requestId: "read-1", correlationId: "corr-1" },
    );
    const version = createDesktopAssetDefinitionVersionReadRequest(
      { definitionId: "builtin.workflow", version: "1.0.0", boundary: { host: "desktop", source: "renderer" } },
      { requestId: "read-version-1", correlationId: "corr-version-1" },
    );
    const response = createDesktopAssetDefinitionReadSuccessResponse({
      definition: {
        definitionId: "builtin.workflow",
        assetType: "workflow",
        assetFamily: "behavioral",
        version: "1.0.0",
        displayName: "Workflow",
        description: "Workflow definition",
        lifecycleStatus: "published",
        provenance: { sourceKind: "system-generated", createdAt: "2026-05-08T00:00:00.000Z" },
      },
    }, { requestId: read.requestId, correlationId: read.correlationId });

    expect(read.requestId).toBe("read-1");
    expect(version.correlationId).toBe("corr-version-1");
    expect(response).toMatchObject({ requestId: "read-1", correlationId: "corr-1" });
  });

  it("wraps resource-backed read helpers without mutation channels", () => {
    const request = createDesktopAssetResourceBackedViewsListRequest({
      searchText: "generated",
      viewKinds: ["generated-output"],
      boundary: { host: "desktop", source: "renderer" },
    }, { requestId: "rv-list" });
    const read = createDesktopAssetResourceBackedViewReadRequest({
      viewId: " asset-view.generated-output.internal.1 ",
      expand: ["metadata"],
      boundary: { host: "desktop", source: "renderer" },
    });
    const response = createDesktopAssetResourceBackedViewsListSuccessResponse({
      items: [{ viewId: "asset-view.generated-output.internal.1", viewKind: "generated-output" }],
    });

    expect(request).toMatchObject({
      operation: "asset.resource-backed-views-list",
      channel: "ipc.asset.resource-backed-views-list.request",
      requestId: "rv-list",
    });
    expect(read).toMatchObject({
      operation: "asset.resource-backed-view-read",
      payload: { viewId: "asset-view.generated-output.internal.1" },
    });
    expect(response).toMatchObject({ ok: true, operation: "asset.resource-backed-views-list" });
    expectTypeOf<typeof response>().toExtend<import("../ipc-response").IpcResponse<
      AssetRegistryListResult<AssetRegistryResourceBackedViewCard>,
      Record<string, unknown>,
      typeof DESKTOP_ASSET_RESOURCE_BACKED_VIEWS_LIST_OPERATION,
      Record<string, never>,
      typeof DESKTOP_ASSET_RESOURCE_BACKED_VIEWS_LIST_RESPONSE_CHANNEL.value
    >>();
  });

  it("does not export mutation operation identities", () => {
    const exportedNames = Object.keys({
      DESKTOP_ASSET_DEFINITIONS_LIST_OPERATION,
      DESKTOP_ASSET_DEFINITION_READ_OPERATION,
      DESKTOP_ASSET_DEFINITION_VERSION_READ_OPERATION,
      DESKTOP_ASSET_RESOURCE_BACKED_VIEWS_LIST_OPERATION,
      DESKTOP_ASSET_RESOURCE_BACKED_VIEW_READ_OPERATION,
    });
    expect(/CREATE|UPDATE|DELETE|REGISTER|SEED|IMPORT|FINALIZE|PUBLISH|EXECUTE|RUN|SCAN|SYNC|REPAIR|INSTALL|START|TRAIN|VALIDATE/i.test(exportedNames.join(" "))).toBe(false);
  });
});
