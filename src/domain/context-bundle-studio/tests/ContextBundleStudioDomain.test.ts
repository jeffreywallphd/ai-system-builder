import { describe, expect, it } from "bun:test";
import {
  ContextBundleStudioIdentity,
  createContextBundleAssetMetadata,
  createContextBundleStudioTaxonomy,
} from "../ContextBundleStudioDomain";

describe("ContextBundleStudioDomain", () => {
  it("creates composite context-bundle taxonomy with none default behavior", () => {
    const taxonomy = createContextBundleStudioTaxonomy();

    expect(taxonomy.structuralKind).toBe("composite");
    expect(taxonomy.semanticRole).toBe("context-bundle");
    expect(taxonomy.behaviorKind).toBe("none");
  });

  it("supports valid context-bundle input-preparer behavior kinds", () => {
    expect(createContextBundleStudioTaxonomy("none").behaviorKind).toBe("none");
    expect(createContextBundleStudioTaxonomy("deterministic").behaviorKind).toBe("deterministic");
  });

  it("builds context-bundle metadata with composite taxonomy and generated provenance defaults", () => {
    const metadata = createContextBundleAssetMetadata({
      title: "Context Bundle Draft",
      summary: "Input-preparer bundle",
      tags: ["studio-shell", "context-package", "context-recipe"],
      creatorId: "author-1",
      behaviorKind: "deterministic",
      contract: {
        version: "1.0.0",
        input: { kind: "json-schema" },
        output: { kind: "json-schema" },
      },
    });

    expect(metadata.tags).toEqual(["context-bundle", "studio-shell", "context-package", "context-recipe"]);
    expect(metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "context-bundle",
      behaviorKind: "deterministic",
    });
    expect(metadata.provenance?.sourceType).toBe("generated");
    expect(metadata.provenance?.sourceLabel).toBe(ContextBundleStudioIdentity.studioType);
    expect(metadata.provenance?.creatorId).toBe("author-1");
  });
});
