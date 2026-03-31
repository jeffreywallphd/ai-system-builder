import { describe, expect, it } from "bun:test";
import { getDataStudioAssetRegistry, listIngestionDataAssets } from "../DataStudioAssetRegistryCatalog";
import { BatchIngestionAssetId } from "../BatchIngestionFramework";

describe("DataStudioAssetRegistryCatalog", () => {
  it("exposes ingestion assets through shared category/specialization discovery", () => {
    const ingestionEntries = listIngestionDataAssets();
    expect(ingestionEntries.length).toBe(5);
    expect(ingestionEntries.every((entry) => entry.descriptor.category === "data-ingestion")).toBeTrue();
    expect(ingestionEntries.some((entry) => entry.descriptor.assetId === BatchIngestionAssetId)).toBeTrue();
  });

  it("supports shared lookup by id/version from the catalog registry", () => {
    const registry = getDataStudioAssetRegistry();
    const csvEntry = registry.get({ assetId: "csv-ingestor", versionId: "1.0.0" });
    expect(csvEntry).toBeDefined();
    expect(csvEntry?.descriptor.inspectability.supportedFileExtensions).toContain(".csv");
  });
});
