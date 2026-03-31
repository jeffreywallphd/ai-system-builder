import { describe, expect, it } from "bun:test";
import { AssetContractShapeKinds } from "../../contracts/AssetContract";
import { createCanonicalRecordsShape } from "../CanonicalDataShapes";
import { CanonicalDataAsset } from "../CanonicalDataAsset";

describe("DataAssetBase", () => {
  function createSampleAsset() {
    return new CanonicalDataAsset({
      id: "dataset-asset-1",
      name: "Customer Dataset",
      version: "v1",
      source: {
        type: "generated",
        workflowId: "workflow-1",
      },
      location: {
        accessMethod: "virtual",
        location: "dataset://customer/v1",
        format: "json",
      },
      outputShape: createCanonicalRecordsShape({
        records: [
          { recordId: "record-1", fields: { id: "1", name: "Ada" } },
          { recordId: "record-2", fields: { id: "2", name: "Lin" } },
        ],
      }),
      contracts: {
        version: "1.1.0",
        input: {
          kind: AssetContractShapeKinds.jsonSchema,
          description: "Input record payload.",
        },
        output: {
          kind: AssetContractShapeKinds.jsonSchema,
          description: "Output record payload.",
        },
      },
      config: {
        delimiter: ",",
        hasHeaderRow: true,
      },
      versionMetadata: {
        schemaVersion: "1.0.0",
        revision: 3,
        publishedVersionId: "dataset-published-v1",
      },
      composableInputShapeKinds: ["records", "table"],
      dependencies: [
        { assetId: "source-asset", versionId: "v2", relationship: "input" },
      ],
    });
  }

  it("standardizes input/output contracts, config, and version metadata", () => {
    const asset = createSampleAsset();

    expect(asset.kind).toBe("dataset");
    expect(asset.getInputContract().kind).toBe("json-schema");
    expect(asset.getOutputContract().kind).toBe("json-schema");
    expect(asset.versionMetadata.contractVersion).toBe("1.1.0");
    expect(asset.versionMetadata.revision).toBe(3);
    expect(asset.config.values.delimiter).toBe(",");
  });

  it("supports inspectability and composability checks", () => {
    const asset = createSampleAsset();
    const inspection = asset.inspect();

    expect(inspection.metadata.identity.assetId).toBe("dataset-asset-1");
    expect(inspection.metadata.version.scheme).toBe("label");
    expect(inspection.outputShapeKind).toBe("records");
    expect(inspection.metadata.dependencies).toHaveLength(1);

    expect(asset.canComposeFrom({ outputShapeKind: "table" })).toBe(true);
    expect(asset.canComposeFrom({ outputShapeKind: "text-items" })).toBe(false);
  });

  it("requires explicit input/output contracts", () => {
    expect(() => new CanonicalDataAsset({
      id: "broken",
      name: "Broken",
      source: { type: "generated", workflowId: "wf-1" },
      location: { accessMethod: "virtual" },
      outputShape: createCanonicalRecordsShape({ records: [{ recordId: "record-1", fields: { a: 1 } }] }),
      contracts: {
        input: {
          kind: AssetContractShapeKinds.jsonSchema,
        },
      } as never,
    })).toThrow("explicit input and output contracts");
  });

  it("rejects invalid version metadata conventions", () => {
    expect(() => new CanonicalDataAsset({
      id: "invalid-version-asset",
      name: "Invalid Version Asset",
      version: "release-candidate",
      source: { type: "generated", workflowId: "wf-1" },
      location: { accessMethod: "virtual", location: "dataset://invalid-version-asset" },
      outputShape: createCanonicalRecordsShape({
        records: [{ recordId: "record-1", fields: { id: "1" } }],
      }),
      versionMetadata: {
        schemaVersion: "schema-v1",
      },
    })).toThrow("DataAssetVersionMetadata.schemaVersion");
  });
});

