import { CanonicalDataAsset } from "../../domain/dataset-studio/CanonicalDataAsset";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
  createCanonicalTextItemsShape,
  type CanonicalRecordValue,
} from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  DataAssetRegistry,
  DataAssetRegistrySpecializations,
  type DataAssetRegistryEntry,
} from "./DataAssetRegistry";
import {
  DataAssetConfigFieldKinds,
  createDataAssetConfigSchema,
  type DataAssetConfigSchema,
} from "./DataAssetConfiguration";

export interface DataStudioSampleAssetSet {
  readonly registry: DataAssetRegistry;
  readonly entries: ReadonlyArray<DataAssetRegistryEntry>;
}

function toStringConfig(config: Readonly<Record<string, CanonicalRecordValue>>, key: string, fallback: string): string {
  const value = config[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function toNumberConfig(config: Readonly<Record<string, CanonicalRecordValue>>, key: string, fallback: number): number {
  const value = config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function createRecordsConverterConfigSchema(assetId: string): DataAssetConfigSchema {
  return createDataAssetConfigSchema({
    schemaId: `data-asset.${assetId}.config`,
    version: "1.0.0",
    fields: Object.freeze([
      {
        key: "formatHint",
        label: "Input format",
        kind: DataAssetConfigFieldKinds.select,
        required: true,
        defaultValue: "json",
        options: Object.freeze([
          { value: "json", label: "JSON" },
          { value: "csv", label: "CSV" },
          { value: "tsv", label: "TSV" },
        ]),
      },
      {
        key: "delimiter",
        label: "Delimiter",
        kind: DataAssetConfigFieldKinds.select,
        required: true,
        defaultValue: ",",
        options: Object.freeze([
          { value: ",", label: "Comma" },
          { value: "\t", label: "Tab" },
          { value: ";", label: "Semicolon" },
          { value: "|", label: "Pipe" },
        ]),
      },
      {
        key: "hasHeaderRow",
        label: "Header row",
        kind: DataAssetConfigFieldKinds.boolean,
        defaultValue: true,
      },
    ]),
  });
}

function createDocumentConfigSchema(assetId: string): DataAssetConfigSchema {
  return createDataAssetConfigSchema({
    schemaId: `data-asset.${assetId}.config`,
    version: "1.0.0",
    fields: Object.freeze([
      {
        key: "chunkMode",
        label: "Chunk mode",
        kind: DataAssetConfigFieldKinds.select,
        defaultValue: "paragraph",
        options: Object.freeze([
          { value: "line", label: "Line" },
          { value: "paragraph", label: "Paragraph" },
          { value: "fixed-size", label: "Fixed size" },
        ]),
      },
      {
        key: "chunkSize",
        label: "Chunk size",
        kind: DataAssetConfigFieldKinds.number,
        defaultValue: 120,
        min: 1,
      },
      {
        key: "chunkOverlap",
        label: "Chunk overlap",
        kind: DataAssetConfigFieldKinds.number,
        defaultValue: 12,
        min: 0,
      },
    ]),
  });
}

function createImageConfigSchema(assetId: string): DataAssetConfigSchema {
  return createDataAssetConfigSchema({
    schemaId: `data-asset.${assetId}.config`,
    version: "1.0.0",
    fields: Object.freeze([
      {
        key: "imageId",
        label: "Image id",
        kind: DataAssetConfigFieldKinds.string,
        defaultValue: "sample-image-1",
      },
      {
        key: "minConfidence",
        label: "Min confidence",
        kind: DataAssetConfigFieldKinds.number,
        defaultValue: 0.5,
        min: 0,
        max: 1,
      },
    ]),
  });
}

function createRecordsConverterAsset(config: Readonly<Record<string, CanonicalRecordValue>>): CanonicalDataAsset {
  return new CanonicalDataAsset({
    id: "sample-records-converter",
    name: "Sample Records Converter",
    version: "1.0.0",
    source: { type: "generated", workflowId: "dataset-studio-sample-assets" },
    location: { accessMethod: "virtual", location: "dataset://sample-records-converter" },
    outputShape: createCanonicalRecordsShape({
      records: Object.freeze([
        {
          recordId: "seed-1",
          fields: Object.freeze({
            id: "seed-1",
            name: "Seed",
            formatHint: toStringConfig(config, "formatHint", "json"),
            delimiter: toStringConfig(config, "delimiter", ","),
          }),
        },
      ]),
      metadata: {
        schemaVersion: "1.0.0",
      },
    }),
    config,
    versionMetadata: {
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: 2,
      publishedVersionId: "1.0.0",
    },
    semanticMetadata: {
      description: "Sample records converter asset for end-to-end Data Studio harness coverage.",
      tags: ["dataset", "sample", "records", "converter"],
    },
  });
}

function createDocumentTextAsset(config: Readonly<Record<string, CanonicalRecordValue>>): CanonicalDataAsset {
  return new CanonicalDataAsset({
    id: "sample-document-text",
    name: "Sample Document Text",
    version: "1.1.0",
    source: { type: "generated", workflowId: "dataset-studio-sample-assets" },
    location: { accessMethod: "virtual", location: "dataset://sample-document-text" },
    outputShape: createCanonicalTextItemsShape({
      items: Object.freeze([
        {
          itemId: "seed-text-1",
          text: "Alpha paragraph for preview and execution harness coverage.",
          sourceDocumentId: "sample-document-1",
        },
      ]),
      metadata: {
        schemaVersion: "1.0.0",
      },
    }),
    config,
    versionMetadata: {
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: 3,
      publishedVersionId: "1.1.0",
    },
    semanticMetadata: {
      description: "Sample text-item dataset asset validating document conversion and preview surfaces.",
      tags: ["dataset", "sample", "document", "text-items"],
    },
  });
}

function createImageMetadataAsset(config: Readonly<Record<string, CanonicalRecordValue>>): CanonicalDataAsset {
  const minConfidence = toNumberConfig(config, "minConfidence", 0.5);
  return new CanonicalDataAsset({
    id: "sample-image-metadata",
    name: "Sample Image Metadata",
    version: "1.0.1",
    source: { type: "generated", workflowId: "dataset-studio-sample-assets" },
    location: { accessMethod: "virtual", location: "dataset://sample-image-metadata" },
    outputShape: createCanonicalImageMetadataRecordsShape({
      items: Object.freeze([
        {
          itemId: "seed-image-1",
          imageId: toStringConfig(config, "imageId", "sample-image-1"),
          label: "object",
          confidence: minConfidence,
          boundingBox: { x: 10, y: 20, width: 200, height: 140 },
          attributes: { source: "harness" },
        },
      ]),
      metadata: {
        schemaVersion: "1.0.0",
      },
    }),
    config,
    versionMetadata: {
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: 1,
      publishedVersionId: "1.0.1",
    },
    semanticMetadata: {
      description: "Sample image-metadata dataset asset validating structured extraction pathways.",
      tags: ["dataset", "sample", "image", "metadata"],
    },
  });
}

export function registerDataStudioSampleAssets(
  registry: DataAssetRegistry = new DataAssetRegistry(),
): DataStudioSampleAssetSet {
  const recordsSchema = createRecordsConverterConfigSchema("sample-records-converter");
  const documentSchema = createDocumentConfigSchema("sample-document-text");
  const imageSchema = createImageConfigSchema("sample-image-metadata");

  const recordsEntry = registry.register({
    asset: createRecordsConverterAsset({
      formatHint: "json",
      delimiter: ",",
      hasHeaderRow: true,
    }),
    specialization: DataAssetRegistrySpecializations.converter,
    display: {
      title: "Sample Records Converter",
      summary: "Converts source payloads into canonical record shapes.",
      tags: ["sample", "records"],
    },
    configSchema: recordsSchema,
    assetFactory: (config) => createRecordsConverterAsset(config),
  });

  const documentEntry = registry.register({
    asset: createDocumentTextAsset({
      chunkMode: "paragraph",
      chunkSize: 120,
      chunkOverlap: 12,
    }),
    specialization: DataAssetRegistrySpecializations.preview,
    display: {
      title: "Sample Document Text",
      summary: "Builds canonical text items for preview and inspection.",
      tags: ["sample", "text-items"],
    },
    configSchema: documentSchema,
    assetFactory: (config) => createDocumentTextAsset(config),
  });

  const imageEntry = registry.register({
    asset: createImageMetadataAsset({
      imageId: "sample-image-1",
      minConfidence: 0.5,
    }),
    specialization: DataAssetRegistrySpecializations.transformation,
    display: {
      title: "Sample Image Metadata",
      summary: "Produces canonical image metadata records.",
      tags: ["sample", "image"],
    },
    configSchema: imageSchema,
    assetFactory: (config) => createImageMetadataAsset(config),
  });

  return Object.freeze({
    registry,
    entries: Object.freeze([recordsEntry, documentEntry, imageEntry]),
  });
}
