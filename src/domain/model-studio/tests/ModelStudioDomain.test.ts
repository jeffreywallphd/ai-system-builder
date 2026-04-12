import { describe, expect, it } from "bun:test";
import { createModelAssetMetadata, createModelStudioTaxonomy, ModelStudioIdentity } from "../ModelStudioDomain";
import { normalizeAssetMetadata } from "../../studio-shell/StudioShellDomain";

describe("ModelStudioDomain", () => {
  it("builds canonical atomic model taxonomy", () => {
    const taxonomy = createModelStudioTaxonomy();

    expect(taxonomy.structuralKind).toBe("atomic");
    expect(taxonomy.semanticRole).toBe("model");
    expect(taxonomy.behaviorKind).toBe("none");
  });

  it("creates model metadata with model taxonomy and generated provenance", () => {
    const metadata = normalizeAssetMetadata(createModelAssetMetadata({
      title: "  Llama Model  ",
      tags: ["model", "llm", "llm"],
      creatorId: " author-1 ",
    }));

    expect(metadata.title).toBe("Llama Model");
    expect(metadata.taxonomy?.semanticRole).toBe("model");
    expect(metadata.provenance?.sourceType).toBe("generated");
    expect(metadata.provenance?.sourceLabel).toBe(ModelStudioIdentity.studioType);
    expect(metadata.tags).toEqual(["model", "llm"]);
  });
});
