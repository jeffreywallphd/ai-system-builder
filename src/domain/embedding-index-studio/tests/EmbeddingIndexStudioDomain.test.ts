import { describe, expect, it } from "bun:test";
import {
  createEmbeddingIndexAssetMetadata,
  createEmbeddingIndexStudioTaxonomy,
  EmbeddingIndexStudioIdentity,
} from "../EmbeddingIndexStudioDomain";
import { normalizeAssetMetadata } from "../../studio-shell/StudioShellDomain";

describe("EmbeddingIndexStudioDomain", () => {
  it("builds canonical atomic embedding-index taxonomy", () => {
    const taxonomy = createEmbeddingIndexStudioTaxonomy();

    expect(taxonomy.structuralKind).toBe("atomic");
    expect(taxonomy.semanticRole).toBe("embedding-index");
    expect(taxonomy.behaviorKind).toBe("none");
  });

  it("creates embedding-index metadata with taxonomy and generated provenance", () => {
    const metadata = normalizeAssetMetadata(createEmbeddingIndexAssetMetadata({
      title: "  Product Knowledge Embeddings  ",
      tags: ["embedding-index", "knowledge", "knowledge"],
      creatorId: " indexer-1 ",
    }));

    expect(metadata.title).toBe("Product Knowledge Embeddings");
    expect(metadata.taxonomy?.semanticRole).toBe("embedding-index");
    expect(metadata.provenance?.sourceType).toBe("generated");
    expect(metadata.provenance?.sourceLabel).toBe(EmbeddingIndexStudioIdentity.studioType);
    expect(metadata.tags).toEqual(["embedding-index", "knowledge"]);
  });
});
