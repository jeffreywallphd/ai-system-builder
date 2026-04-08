import { describe, expect, it } from "bun:test";
import {
  GeneratedResultOriginalAccessPurposes,
  GeneratedResultTransportRoutes,
  buildGeneratedResultByRunRoutePath,
  buildGeneratedResultLineageDetailRoutePath,
  buildGeneratedResultLineageSummaryRoutePath,
  buildGeneratedResultOriginalAccessRoutePath,
  buildGeneratedResultPreviewRoutePath,
  buildGeneratedResultRoutePath,
  toListGeneratedResultsByRunQueryParams,
  toListGeneratedResultsQueryParams,
} from "../GeneratedResultTransportContracts";

describe("GeneratedResultTransportContracts", () => {
  it("serializes result-list query params with repeated filter keys", () => {
    const query = toListGeneratedResultsQueryParams({
      contractVersion: "generated-result-transport/v1",
      actorUserId: "user:1",
      workspaceId: "workspace:image",
      runId: "run:image:1",
      statuses: ["available", "preview-ready"],
      visibilities: ["workspace", "shared"],
      mediaTypes: ["image/webp", "image/png"],
      search: "portrait",
      limit: 25,
      offset: 10,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });

    expect(query.toString()).toBe(
      "workspaceId=workspace%3Aimage&runId=run%3Aimage%3A1&status=available&status=preview-ready&visibility=workspace&visibility=shared&mediaType=image%2Fwebp&mediaType=image%2Fpng&search=portrait&sortBy=updatedAt&sortDirection=desc&limit=25&offset=10",
    );
  });

  it("serializes run-scoped list query params", () => {
    const query = toListGeneratedResultsByRunQueryParams({
      contractVersion: "generated-result-transport/v1",
      actorUserId: "user:1",
      workspaceId: "workspace:image",
      runId: "run:image:1",
      limit: 50,
      offset: 5,
    });

    expect(query.toString()).toBe("workspaceId=workspace%3Aimage&limit=50&offset=5");
  });

  it("builds canonical result, run, preview, original, and lineage routes", () => {
    expect(buildGeneratedResultRoutePath({ resultAssetId: "asset:result:1" }))
      .toBe("/api/v1/generated-results/asset%3Aresult%3A1");
    expect(buildGeneratedResultByRunRoutePath({ runId: "run:image:1" }))
      .toBe("/api/v1/image-runs/run%3Aimage%3A1/generated-results");
    expect(buildGeneratedResultPreviewRoutePath({ resultAssetId: "asset:result:1" }))
      .toBe("/api/v1/generated-results/asset%3Aresult%3A1/preview");
    expect(buildGeneratedResultOriginalAccessRoutePath({ resultAssetId: "asset:result:1" }))
      .toBe("/api/v1/generated-results/asset%3Aresult%3A1/original-access");
    expect(buildGeneratedResultLineageSummaryRoutePath({ resultAssetId: "asset:result:1" }))
      .toBe("/api/v1/generated-results/asset%3Aresult%3A1/lineage/summary");
    expect(buildGeneratedResultLineageDetailRoutePath({ resultAssetId: "asset:result:1" }))
      .toBe("/api/v1/generated-results/asset%3Aresult%3A1/lineage");
  });

  it("exposes canonical transport routes and access purposes", () => {
    expect(GeneratedResultTransportRoutes.listResults).toBe("/api/v1/generated-results");
    expect(GeneratedResultTransportRoutes.requestOriginalAccess)
      .toBe("/api/v1/generated-results/:resultAssetId/original-access");
    expect(GeneratedResultOriginalAccessPurposes.downloadOriginal).toBe("download-original");
    expect(GeneratedResultOriginalAccessPurposes.exportOriginal).toBe("export-original");
  });
});
