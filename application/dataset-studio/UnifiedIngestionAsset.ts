import { AssetContractShapeKinds } from "../../domain/contracts/AssetContract";
import { CanonicalDataAsset } from "../../domain/dataset-studio/CanonicalDataAsset";
import { createCanonicalRecordsShape, type CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionSourceKinds,
  UnifiedIngestionStrategyKinds,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";
import {
  DataAssetConfigFieldKinds,
  DataAssetConfigFieldVisibilities,
  createDataAssetConfigSchema,
  type DataAssetConfigSchema,
} from "./DataAssetConfiguration";

export const UnifiedIngestionAssetId = "unified-ingestion";
export const UnifiedIngestionAssetVersion = "1.0.0";

export function createUnifiedIngestionConfigSchema(assetId: string): DataAssetConfigSchema {
  return createDataAssetConfigSchema({
    schemaId: `data-asset.${assetId}.config`,
    version: "1.0.0",
    fields: Object.freeze([
      {
        key: "outputTarget",
        label: "Output target",
        kind: DataAssetConfigFieldKinds.select,
        visibility: DataAssetConfigFieldVisibilities.simple,
        required: true,
        defaultValue: UnifiedIngestionOutputTargetKinds.records,
        options: Object.freeze([
          { value: UnifiedIngestionOutputTargetKinds.records, label: "Records (CSV/JSON)" },
          { value: UnifiedIngestionOutputTargetKinds.textItems, label: "Text items (Document/PDF)" },
          { value: UnifiedIngestionOutputTargetKinds.imageMetadataRecords, label: "Image metadata records" },
        ]),
      },
      {
        key: "previewSampleLimit",
        label: "Preview sample limit",
        kind: DataAssetConfigFieldKinds.number,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: 25,
        min: 1,
        max: 100,
      },
      {
        key: "strategy",
        label: "Routing strategy",
        kind: DataAssetConfigFieldKinds.select,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        required: true,
        defaultValue: UnifiedIngestionStrategyKinds.auto,
        options: Object.freeze([
          { value: UnifiedIngestionStrategyKinds.auto, label: "Auto detect and route" },
          { value: UnifiedIngestionStrategyKinds.csv, label: "Force CSV ingestor" },
          { value: UnifiedIngestionStrategyKinds.json, label: "Force JSON ingestor" },
          { value: UnifiedIngestionStrategyKinds.document, label: "Force document ingestor" },
          { value: UnifiedIngestionStrategyKinds.image, label: "Force image ingestor" },
        ]),
      },
      {
        key: "explicitSourceKind",
        label: "Detected source override",
        kind: DataAssetConfigFieldKinds.select,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        options: Object.freeze([
          { value: UnifiedIngestionSourceKinds.csv, label: "CSV" },
          { value: UnifiedIngestionSourceKinds.json, label: "JSON" },
          { value: UnifiedIngestionSourceKinds.document, label: "Document/PDF" },
          { value: UnifiedIngestionSourceKinds.image, label: "Image" },
        ]),
      },
      {
        key: "enableContentSniffing",
        label: "Enable content sniffing",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: true,
      },
      {
        key: "delimiterHint",
        label: "CSV delimiter hint",
        kind: DataAssetConfigFieldKinds.string,
        visibility: DataAssetConfigFieldVisibilities.advanced,
      },
      {
        key: "textEncoding",
        label: "Text encoding",
        kind: DataAssetConfigFieldKinds.string,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: "utf-8",
      },
      {
        key: "normalizeHeadersToLowercase",
        label: "Lowercase CSV headers",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: false,
      },
      {
        key: "flattenJson",
        label: "Flatten nested JSON",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: false,
      },
      {
        key: "flattenJsonDepth",
        label: "Flatten max depth",
        kind: DataAssetConfigFieldKinds.number,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        min: 1,
        max: 16,
      },
      {
        key: "documentMaxPages",
        label: "Document max pages",
        kind: DataAssetConfigFieldKinds.number,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        min: 1,
        max: 500,
      },
      {
        key: "imageExtractExif",
        label: "Extract EXIF metadata",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
      },
      {
        key: "imageNormalizeOrientation",
        label: "Normalize image orientation",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
      },
    ]),
  });
}

export function createUnifiedIngestionDataAsset(
  config: Readonly<Record<string, CanonicalRecordValue>>,
): CanonicalDataAsset {
  return new CanonicalDataAsset({
    id: UnifiedIngestionAssetId,
    name: "Unified Ingestion",
    version: UnifiedIngestionAssetVersion,
    source: { type: "generated", workflowId: "dataset-studio-ingestors" },
    location: { accessMethod: "virtual", location: "dataset://unified-ingestion" },
    outputShape: createCanonicalRecordsShape({
      records: Object.freeze([]),
      metadata: {
        schemaVersion: "1.0.0",
        source: {
          format: "unified-ingestion",
        },
      },
    }),
    contracts: {
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Unified source reference with shared simple/advanced ingestion configuration.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Canonical output routed to records, text-items, or image-metadata-records.",
      },
    },
    config,
    versionMetadata: {
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: 1,
      publishedVersionId: UnifiedIngestionAssetVersion,
    },
    semanticMetadata: {
      description: "Default unified ingestion entry point with optional advanced routing overrides.",
      tags: ["dataset", "ingestion", "unified", "routing"],
    },
  });
}
