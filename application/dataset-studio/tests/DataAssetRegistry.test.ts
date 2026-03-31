import { describe, expect, it } from "bun:test";
import { CanonicalDataAsset } from "../../../domain/dataset-studio/CanonicalDataAsset";
import { createCanonicalRecordsShape } from "../../../domain/dataset-studio/CanonicalDataShapes";
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
    expect(entry.descriptor.versionId).toBe("v1");
    expect(entry.descriptor.specialization).toBe("converter");
    expect(entry.descriptor.configSchema.schemaId).toBe("dataset-a.schema");
    expect(registry.get({ assetId: "dataset-a", versionId: "v1" })?.descriptor.assetId).toBe("dataset-a");
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
});
