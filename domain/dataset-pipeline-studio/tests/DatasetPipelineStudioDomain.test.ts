import { describe, expect, it } from "bun:test";
import {
  createDatasetPipelineAssetMetadata,
  createDatasetPipelineStudioTaxonomy,
  DatasetPipelineStudioIdentity,
} from "../DatasetPipelineStudioDomain";

describe("DatasetPipelineStudioDomain", () => {
  it("creates composite dataset-pipeline taxonomy with deterministic default behavior", () => {
    const taxonomy = createDatasetPipelineStudioTaxonomy();

    expect(taxonomy.structuralKind).toBe("composite");
    expect(taxonomy.semanticRole).toBe("dataset-pipeline");
    expect(taxonomy.behaviorKind).toBe("deterministic");
  });

  it("supports valid dataset-pipeline behavior kinds", () => {
    expect(createDatasetPipelineStudioTaxonomy("deterministic").behaviorKind).toBe("deterministic");
    expect(createDatasetPipelineStudioTaxonomy("iterative").behaviorKind).toBe("iterative");
  });

  it("builds dataset-pipeline metadata with composite taxonomy and generated provenance defaults", () => {
    const metadata = createDatasetPipelineAssetMetadata({
      title: "Dataset Pipeline Draft",
      summary: "Composite dataset preparation and validation pipeline",
      tags: ["studio-shell", "source-ingestion", "data-cleaning", "data-validation", "dataset-transformation"],
      creatorId: "author-1",
      behaviorKind: "iterative",
      contract: {
        version: "1.0.0",
        input: { kind: "json-schema" },
        output: { kind: "json-schema" },
      },
    });

    expect(metadata.tags).toEqual([
      "dataset-pipeline",
      "studio-shell",
      "source-ingestion",
      "data-cleaning",
      "data-validation",
      "dataset-transformation",
    ]);
    expect(metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "dataset-pipeline",
      behaviorKind: "iterative",
    });
    expect(metadata.provenance?.sourceType).toBe("generated");
    expect(metadata.provenance?.sourceLabel).toBe(DatasetPipelineStudioIdentity.studioType);
    expect(metadata.provenance?.creatorId).toBe("author-1");
  });
});
