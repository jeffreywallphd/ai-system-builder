import { describe, expect, it } from "bun:test";
import { CanonicalDataAsset } from "../../../domain/dataset-studio/CanonicalDataAsset";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
} from "../../../domain/dataset-studio/CanonicalDataShapes";
import {
  DataAssetRegistry,
  DataAssetRegistrySpecializations,
} from "../DataAssetRegistry";
import {
  DataAssetConfigFieldKinds,
  createDataAssetConfigSchema,
} from "../DataAssetConfiguration";

function createAsset(input: {
  readonly id: string;
  readonly version?: string;
  readonly delimiter?: string;
  readonly previewable?: boolean;
}) {
  return new CanonicalDataAsset({
    id: input.id,
    name: input.id,
    version: input.version,
    source: { type: "generated", workflowId: "wf-1" },
    location: { accessMethod: "virtual", location: `dataset://${input.id}` },
    outputShape: createCanonicalRecordsShape({ records: [] }),
    config: {
      delimiter: input.delimiter ?? ",",
    },
    supportsPreview: input.previewable,
  });
}

describe("DataAssetRegistry", () => {
  it("registers data assets with explicit schema and supports deterministic lookup", () => {
    const registry = new DataAssetRegistry();
    const asset = createAsset({ id: "dataset-a", version: "v1" });

    const schema = createDataAssetConfigSchema({
      schemaId: "dataset-a.schema",
      fields: [{
        key: "delimiter",
        label: "Delimiter",
        kind: DataAssetConfigFieldKinds.string,
        defaultValue: ",",
      }],
    });

    const entry = registry.register({
      asset,
      specialization: DataAssetRegistrySpecializations.converter,
      configSchema: schema,
    });

    expect(entry.descriptor.assetId).toBe("dataset-a");
    expect(entry.descriptor.category).toBe("dataset");
    expect(entry.descriptor.versionId).toBe("v1");
    expect(entry.descriptor.version.scheme).toBe("label");
    expect(entry.descriptor.specialization).toBe("converter");
    expect(entry.descriptor.schemaIntent.id).toBe("tabular");
    expect(entry.descriptor.configSchema.schemaId).toBe("dataset-a.schema");
    expect(entry.descriptor.discoverability.scope).toBe("default");
    expect(entry.descriptor.discoverability.defaultEntryPoint).toBeFalse();
    expect(registry.get({ assetId: "dataset-a", versionId: "v1" })?.descriptor.assetId).toBe("dataset-a");
  });

  it("supports category and inspectability metadata for ingestion discovery", () => {
    const registry = new DataAssetRegistry();
    const entry = registry.register({
      asset: createAsset({ id: "dataset-ingestor", version: "1.0.0" }),
      specialization: DataAssetRegistrySpecializations.ingestion,
      category: "data-ingestion",
      inspectability: {
        supportedSourceKinds: ["in-memory", "local-file"],
        supportedFileExtensions: [".csv"],
        keyConfigKeys: ["delimiter", "header"],
        previewModes: ["sample-records"],
        executionModes: ["execute", "preview"],
      },
      discoverability: {
        scope: "advanced",
        defaultEntryPoint: false,
        inspectable: true,
      },
    });

    expect(entry.descriptor.inspectability.supportedSourceKinds).toEqual(["in-memory", "local-file"]);
    expect(entry.descriptor.discoverability.scope).toBe("advanced");
    expect(registry.list({ category: "data-ingestion" })).toHaveLength(1);
    expect(registry.list({ category: "dataset" })).toHaveLength(0);
  });

  it("supports config-based loading with an asset factory", () => {
    const registry = new DataAssetRegistry();
    const base = createAsset({ id: "dataset-loader", version: "v1", delimiter: "," });

    registry.register({
      asset: base,
      specialization: DataAssetRegistrySpecializations.preview,
      assetFactory: (config) => createAsset({
        id: "dataset-loader",
        version: "v1",
        delimiter: String(config.delimiter ?? ","),
      }),
    });

    const loaded = registry.resolveAsset({
      assetId: "dataset-loader",
      versionId: "v1",
      configOverride: {
        delimiter: "|",
      },
    });

    expect(loaded?.config.values.delimiter).toBe("|");
  });

  it("supports query filters for preview/capability discovery", () => {
    const registry = new DataAssetRegistry();
    registry.register({
      asset: createAsset({ id: "dataset-preview", previewable: true }),
      specialization: DataAssetRegistrySpecializations.preview,
    });
    registry.register({
      asset: createAsset({ id: "dataset-ingest", previewable: false }),
      specialization: DataAssetRegistrySpecializations.ingestion,
    });

    const previewEntries = registry.list({ previewable: true });
    const ingestionEntries = registry.list({ specialization: DataAssetRegistrySpecializations.ingestion });

    expect(previewEntries).toHaveLength(1);
    expect(previewEntries[0]?.descriptor.assetId).toBe("dataset-preview");
    expect(ingestionEntries).toHaveLength(1);
    expect(ingestionEntries[0]?.descriptor.assetId).toBe("dataset-ingest");
    expect(registry.list({ schemaIntentId: "tabular" }).length).toBeGreaterThanOrEqual(2);
  });

  it("rejects duplicate registration keys and unsupported config overrides", () => {
    const registry = new DataAssetRegistry();
    registry.register({
      asset: createAsset({ id: "dataset-dup", version: "v1" }),
    });

    expect(() => registry.register({
      asset: createAsset({ id: "dataset-dup", version: "v1" }),
    })).toThrow("already registered");

    expect(() => registry.resolveAsset({
      assetId: "dataset-dup",
      versionId: "v1",
      configOverride: { delimiter: "|" },
    })).toThrow("does not support config-based loading");
  });

  it("resolves latest by semantic version precedence when versionId is omitted", () => {
    const registry = new DataAssetRegistry();
    registry.register({
      asset: createAsset({ id: "dataset-versioned", version: "1.2.0" }),
    });
    registry.register({
      asset: createAsset({ id: "dataset-versioned", version: "1.10.0" }),
    });
    registry.register({
      asset: createAsset({ id: "dataset-versioned", version: "v1" }),
    });

    const resolved = registry.resolveAsset({ assetId: "dataset-versioned" });
    expect(resolved?.version).toBe("1.10.0");
  });

  it("registers image metadata shapes under media schema intent", () => {
    const registry = new DataAssetRegistry();
    const asset = new CanonicalDataAsset({
      id: "dataset-image-media",
      name: "dataset-image-media",
      source: { type: "generated", workflowId: "wf-image" },
      location: { accessMethod: "virtual", location: "dataset://dataset-image-media" },
      outputShape: createCanonicalImageMetadataRecordsShape({
        items: [{
          itemId: "item-1",
          imageId: "asset:image:sample",
          metadata: {
            width: 512,
            height: 512,
            format: "png",
          },
          attributes: {
            assetId: "asset:image:sample",
          },
        }],
      }),
    });

    const entry = registry.register({ asset });
    expect(entry.descriptor.schemaIntent.id).toBe("media");
    expect(entry.descriptor.schemaIntent.validationIssues).toEqual([]);
    expect(registry.list({ schemaIntentId: "media" })).toHaveLength(1);
  });

  it("rejects invalid records when explicitly registered as media schema intent", () => {
    const registry = new DataAssetRegistry();
    const asset = new CanonicalDataAsset({
      id: "dataset-media-invalid",
      name: "dataset-media-invalid",
      source: { type: "generated", workflowId: "wf-invalid-image" },
      location: { accessMethod: "virtual", location: "dataset://dataset-media-invalid" },
      outputShape: createCanonicalRecordsShape({
        records: [{
          recordId: "img-1",
          fields: {
            assetRef: {
              assetId: "asset:image:sample",
            },
            width: -1,
            height: 256,
            format: "png",
          },
        }],
      }),
    });

    expect(() => registry.register({
      asset,
      schemaIntentId: "media",
    })).toThrow("schema intent 'media' validation failed");
  });
});
