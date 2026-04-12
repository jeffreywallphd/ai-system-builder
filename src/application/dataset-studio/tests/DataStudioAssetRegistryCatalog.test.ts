import { describe, expect, it } from "bun:test";
import {
  getDataStudioAssetRegistry,
  IngestionCatalogVisibilityModes,
  listIngestionDataAssets,
} from "../DataStudioAssetRegistryCatalog";
import { BatchIngestionAssetId } from "../BatchIngestionFramework";
import { UnifiedIngestionAssetId } from "../UnifiedIngestionAsset";

describe("DataStudioAssetRegistryCatalog", () => {
  it("defaults ingestion catalog discovery to the unified ingestion entry point", () => {
    const ingestionEntries = listIngestionDataAssets();
    expect(ingestionEntries.length).toBe(1);
    expect(ingestionEntries[0]?.descriptor.assetId).toBe(UnifiedIngestionAssetId);
  });

  it("exposes low-level ingestors through advanced inspection discovery", () => {
    const ingestionEntries = listIngestionDataAssets({ visibility: IngestionCatalogVisibilityModes.advanced });
    expect(ingestionEntries.length).toBe(6);
    expect(ingestionEntries.every((entry) => entry.descriptor.category === "data-ingestion")).toBeTrue();
    expect(ingestionEntries.some((entry) => entry.descriptor.assetId === BatchIngestionAssetId)).toBeTrue();
    expect(ingestionEntries.some((entry) => entry.descriptor.assetId === UnifiedIngestionAssetId)).toBeTrue();
  });

  it("supports shared lookup by id/version from the catalog registry", () => {
    const registry = getDataStudioAssetRegistry();
    const csvEntry = registry.get({ assetId: "csv-ingestor", versionId: "1.0.0" });
    expect(csvEntry).toBeDefined();
    expect(csvEntry?.descriptor.inspectability.supportedFileExtensions).toContain(".csv");
  });
});
