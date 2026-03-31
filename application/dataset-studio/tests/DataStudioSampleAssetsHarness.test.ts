import { describe, expect, it } from "bun:test";
import { DataConverterOperationKinds, DataSourceReferenceKinds } from "../DataConverterContracts";
import { DefaultDataAssetExecutionFramework } from "../DataAssetExecutionFramework";
import { registerDataStudioSampleAssets } from "../DataStudioSampleAssets";
import { validateDataAssetConfigValues } from "../DataStudioValidation";

describe("DataStudio sample assets harness", () => {
  it("registers sample assets with metadata/version descriptors and config schemas", () => {
    const { entries, registry } = registerDataStudioSampleAssets();

    expect(entries).toHaveLength(7);
    expect(entries.every((entry) => entry.descriptor.version.scheme === "semantic")).toBeTrue();
    expect(entries.every((entry) => entry.descriptor.contracts.contractVersion === "1.0.0")).toBeTrue();
    expect(entries.every((entry) => entry.descriptor.capabilities.previewable)).toBeTrue();
    expect(registry.list({ executable: true })).toHaveLength(7);
    expect(registry.list({ specialization: "ingestion" }).map((entry) => entry.descriptor.assetId))
      .toEqual(["csv-ingestor", "image-ingestor-v1", "json-ingestor", "document-pdf-ingestor"]);
  });

  it("executes source-reference -> records flow with lineage + preview + source locator integration", async () => {
    const framework = new DefaultDataAssetExecutionFramework({
      now: () => new Date("2026-03-31T15:00:00.000Z"),
      executionIdFactory: () => "sample-exec-records",
    });
    const { registry } = registerDataStudioSampleAssets();
    const asset = registry.resolveAsset({
      assetId: "sample-records-converter",
      versionId: "1.0.0",
      configOverride: {
        formatHint: "json",
        delimiter: ",",
        hasHeaderRow: true,
      },
    });

    expect(asset).toBeDefined();

    const result = await framework.execute({
      asset: asset!,
      requestedBy: "sample-harness",
      context: {
        requestId: "sample-harness-req-1",
        operationId: "sample-harness-op-1",
      },
      input: {
        kind: "source-reference",
        source: {
          kind: DataSourceReferenceKinds.inMemory,
          payload: JSON.stringify([
            { id: "1", name: "Ada" },
            { id: "2", name: "Lin" },
          ]),
          formatHint: "json",
          sourceAssetId: "source-users",
          sourceVersionId: "4.0.0",
        },
        formatHint: "json",
      },
      previewOptions: {
        maxItems: 10,
      },
    });

    expect(result.ok).toBeTrue();
    expect(result.output?.kind).toBe("records");
    expect(result.preview.kind).toBe("records");
    expect(result.lineage.inputs.some((entry) => entry.kind === "source-reference")).toBeTrue();
    expect(result.lineage.steps.some((entry) => entry.kind === "resolve-source")).toBeTrue();
  });

  it("executes converter-request flows for text-items and image-metadata sample assets", async () => {
    const framework = new DefaultDataAssetExecutionFramework({
      now: () => new Date("2026-03-31T15:10:00.000Z"),
      executionIdFactory: () => "sample-exec-converter-requests",
    });
    const { registry } = registerDataStudioSampleAssets();
    const textAsset = registry.resolveAsset({ assetId: "sample-document-text", versionId: "1.1.0" });
    const imageAsset = registry.resolveAsset({ assetId: "sample-image-metadata", versionId: "1.0.1" });

    expect(textAsset).toBeDefined();
    expect(imageAsset).toBeDefined();

    const textResult = await framework.execute({
      asset: textAsset!,
      input: {
        kind: "converter-request",
        request: {
          operation: DataConverterOperationKinds.documentToTextItems,
          documentId: "sample-doc-1",
          text: "Alpha paragraph.\n\nBeta paragraph.",
          chunking: {
            mode: "paragraph",
          },
        },
      },
    });

    const imageResult = await framework.execute({
      asset: imageAsset!,
      input: {
        kind: "converter-request",
        request: {
          operation: DataConverterOperationKinds.imageMetadataToRecords,
          imageId: "sample-image-1",
          metadata: {
            regions: [{ id: "r1", label: "object", confidence: 0.8, x: 10, y: 10, width: 20, height: 20 }],
          },
        },
      },
    });

    expect(textResult.ok).toBeTrue();
    expect(textResult.output?.kind).toBe("text-items");
    expect(imageResult.ok).toBeTrue();
    expect(imageResult.output?.kind).toBe("image-metadata-records");
  });

  it("validates schema-driven config errors for sample assets", () => {
    const { entries } = registerDataStudioSampleAssets();
    const recordsSchema = entries.find((entry) => entry.descriptor.assetId === "sample-records-converter")?.descriptor.configSchema;
    expect(recordsSchema).toBeDefined();

    const issues = validateDataAssetConfigValues(
      {
        formatHint: "xml",
        delimiter: 123,
      },
      recordsSchema!,
    );

    expect(issues.some((issue) => issue.code === "data-asset-config-select-option-invalid")).toBeTrue();
    expect(issues.some((issue) => issue.code === "data-asset-config-type-string-expected")).toBeFalse();
    expect(issues.some((issue) => issue.code === "data-asset-config-type-number-expected")).toBeFalse();
  });
});
