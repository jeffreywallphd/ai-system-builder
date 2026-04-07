import { describe, expect, it } from "bun:test";
import { buildDatasetInspectionViewModel } from "../DatasetInspectionViewModel";
import { DataPreviewEngine } from "../DataPreviewEngine";
import { createCanonicalImageMetadataRecordsShape } from "@domain/dataset-studio/CanonicalDataShapes";
import { DatasetSchemaIntentIds } from "@domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import type { DataAssetRegistryDescriptor } from "../../dataset-studio/DataAssetRegistry";

const descriptor: DataAssetRegistryDescriptor = Object.freeze({
  assetId: "asset:dataset:image-ingestor",
  version: { major: 1, minor: 0, patch: 0 },
  versioning: {
    schemaVersion: "1.0.0",
    contractVersion: "1.0.0",
    revision: 1,
    schemaIntentContractVersion: "1.0.0",
  },
  name: "Image Ingestor",
  category: "dataset",
  taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
  specialization: "ingestion",
  outputShapeKind: "image-metadata-records",
  composableInputShapeKinds: Object.freeze(["records"]),
  display: { title: "Image Ingestor" },
  contracts: { inputShapeKind: "records", outputShapeKind: "image-metadata-records", contractVersion: "1.0.0" },
  capabilities: { configurable: true, previewable: true, executable: true, runtimeUsable: true },
  runtime: { usability: "runtime", executionMode: "sync" },
  schemaIntent: {
    id: DatasetSchemaIntentIds.media,
    name: "Media",
    description: "Media schema intent",
    contractVersion: "1.0.0",
    supportedShapeKinds: Object.freeze(["image-metadata-records"]),
    validationIssues: Object.freeze([]),
  },
  configSchema: { version: "1.0.0", fields: Object.freeze([]) },
  inspectability: {
    supportedSourceKinds: Object.freeze([]),
    supportedFileExtensions: Object.freeze([]),
    supportedMediaTypes: Object.freeze([]),
    keyConfigKeys: Object.freeze([]),
    previewModes: Object.freeze([]),
    executionModes: Object.freeze([]),
  },
  discoverability: { scope: "default", defaultEntryPoint: false, inspectable: true },
});

describe("buildDatasetInspectionViewModel", () => {
  it("builds schema-aware inspection details from preview contracts", () => {
    const preview = new DataPreviewEngine().buildFromCanonicalShape(createCanonicalImageMetadataRecordsShape({
      items: [{
        itemId: "img-1",
        attributes: { width: 32, height: 32, format: "png" },
      }],
    }));
    const model = buildDatasetInspectionViewModel({
      descriptor,
      previewModel: preview,
    });

    expect(model.intent.id).toBe("media");
    expect(model.fields.some((field) => field.name === "width")).toBeTrue();
    expect(model.sampleRecords.length).toBe(1);
    expect(model.validationSummary.errors).toBe(0);
  });
});

