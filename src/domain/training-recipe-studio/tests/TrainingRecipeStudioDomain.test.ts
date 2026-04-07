import { describe, expect, it } from "bun:test";
import {
  createTrainingRecipeAssetMetadata,
  createTrainingRecipeStudioTaxonomy,
  TrainingRecipeStudioIdentity,
} from "../TrainingRecipeStudioDomain";

describe("TrainingRecipeStudioDomain", () => {
  it("creates composite training-recipe taxonomy with deterministic behavior", () => {
    const taxonomy = createTrainingRecipeStudioTaxonomy();

    expect(taxonomy.structuralKind).toBe("composite");
    expect(taxonomy.semanticRole).toBe("training-recipe");
    expect(taxonomy.behaviorKind).toBe("deterministic");
  });

  it("builds training-recipe metadata with composite taxonomy and generated provenance defaults", () => {
    const metadata = createTrainingRecipeAssetMetadata({
      title: "Training Recipe Draft",
      summary: "Composite recipe coordinating datasets, model baselines, and runtime training configuration",
      tags: ["studio-shell", "fine-tuning", "model-training", "runtime-config"],
      creatorId: "author-1",
      contract: {
        version: "1.0.0",
        input: { kind: "json-schema" },
        output: { kind: "json-schema" },
      },
    });

    expect(metadata.tags).toEqual([
      "training-recipe",
      "studio-shell",
      "fine-tuning",
      "model-training",
      "runtime-config",
    ]);
    expect(metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "training-recipe",
      behaviorKind: "deterministic",
    });
    expect(metadata.provenance?.sourceType).toBe("generated");
    expect(metadata.provenance?.sourceLabel).toBe(TrainingRecipeStudioIdentity.studioType);
    expect(metadata.provenance?.creatorId).toBe("author-1");
  });
});
