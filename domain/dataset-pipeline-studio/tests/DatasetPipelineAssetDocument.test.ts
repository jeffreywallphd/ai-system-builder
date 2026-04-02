import { describe, expect, it } from "bun:test";
import {
  deserializeDatasetPipelineAssetDocumentForEditing,
  resolveDatasetPipelineSchemaReferenceStatus,
  serializeDatasetPipelineAssetDocument,
  updateDatasetPipelineSchemaReference,
} from "../DatasetPipelineAssetDocument";

describe("DatasetPipelineAssetDocument", () => {
  it("normalizes schema references and preserves pipeline flow content", () => {
    const parsed = deserializeDatasetPipelineAssetDocumentForEditing(JSON.stringify({
      datasetPipelineSpec: {
        sources: [{ datasetRef: "dataset:raw:v1", ingestionMode: "batch" }],
        steps: [{ id: "clean", kind: "data-cleaning" }],
        schemas: {
          input: { assetId: "asset:schema:input" },
          output: { inlineDefinition: { type: "object", properties: { id: { type: "string" } } } },
        },
      },
    }));

    expect(parsed.issues).toEqual([]);
    expect(parsed.document.datasetPipelineSpec.schemas?.input?.assetId).toBe("asset:schema:input");
    expect(parsed.document.datasetPipelineSpec.steps[0]?.kind).toBe("data-cleaning");

    const serialized = serializeDatasetPipelineAssetDocument(parsed.document);
    expect(serialized).toContain('"schemaVersion": "ai-loom.dataset-pipeline-draft.v1"');
  });

  it("supports adding and removing linked schema references", () => {
    const parsed = deserializeDatasetPipelineAssetDocumentForEditing("{}");
    const withInput = updateDatasetPipelineSchemaReference({
      document: parsed.document,
      shape: "input",
      reference: { assetId: "asset:schema:customer", versionId: "asset:schema:customer:v1" },
    });
    expect(withInput.datasetPipelineSpec.schemas?.input?.assetId).toBe("asset:schema:customer");

    const removed = updateDatasetPipelineSchemaReference({
      document: withInput,
      shape: "input",
      reference: undefined,
    });
    expect(removed.datasetPipelineSpec.schemas?.input).toBeUndefined();
  });

  it("classifies unresolved schema links safely", () => {
    expect(resolveDatasetPipelineSchemaReferenceStatus({
      reference: undefined,
      availableSchemaAssetIds: new Set<string>(),
    })).toBe("not-linked");

    expect(resolveDatasetPipelineSchemaReferenceStatus({
      reference: { inlineDefinition: { type: "object" } },
      availableSchemaAssetIds: new Set<string>(),
    })).toBe("inline");

    expect(resolveDatasetPipelineSchemaReferenceStatus({
      reference: { assetId: "asset:schema:known" },
      availableSchemaAssetIds: new Set(["asset:schema:known"]),
    })).toBe("resolved");

    expect(resolveDatasetPipelineSchemaReferenceStatus({
      reference: { assetId: "asset:schema:missing" },
      availableSchemaAssetIds: new Set(["asset:schema:known"]),
    })).toBe("unresolved");
  });
});
