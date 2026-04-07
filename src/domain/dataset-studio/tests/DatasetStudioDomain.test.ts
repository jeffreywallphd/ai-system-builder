import { describe, expect, it } from "bun:test";
import { createDatasetAssetMetadata, createDatasetStudioTaxonomy, DatasetStudioIdentity } from "../DatasetStudioDomain";
import { normalizeAssetMetadata } from "../../studio-shell/StudioShellDomain";

describe("DatasetStudioDomain", () => {
  it("builds canonical atomic dataset taxonomy", () => {
    const taxonomy = createDatasetStudioTaxonomy();

    expect(taxonomy.structuralKind).toBe("atomic");
    expect(taxonomy.semanticRole).toBe("dataset");
    expect(taxonomy.behaviorKind).toBe("none");
  });

  it("creates dataset metadata with dataset taxonomy and generated provenance", () => {
    const metadata = normalizeAssetMetadata(createDatasetAssetMetadata({
      title: "  Product Support Dataset  ",
      tags: ["dataset", "support", "support"],
      creatorId: " curator-1 ",
    }));

    expect(metadata.title).toBe("Product Support Dataset");
    expect(metadata.taxonomy?.semanticRole).toBe("dataset");
    expect(metadata.provenance?.sourceType).toBe("generated");
    expect(metadata.provenance?.sourceLabel).toBe(DatasetStudioIdentity.studioType);
    expect(metadata.tags).toEqual(["dataset", "support"]);
  });
});
