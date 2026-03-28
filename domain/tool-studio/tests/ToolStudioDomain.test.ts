import { describe, expect, it } from "bun:test";
import { normalizeAssetMetadata } from "../../studio-shell/StudioShellDomain";
import { createToolAssetMetadata, createToolStudioTaxonomy, ToolStudioIdentity } from "../ToolStudioDomain";

describe("ToolStudioDomain", () => {
  it("builds canonical atomic tool taxonomy with conditional default behavior", () => {
    const taxonomy = createToolStudioTaxonomy();

    expect(taxonomy.structuralKind).toBe("atomic");
    expect(taxonomy.semanticRole).toBe("tool");
    expect(taxonomy.behaviorKind).toBe("conditional");
  });

  it("supports deterministic tool behavior when explicitly requested", () => {
    const taxonomy = createToolStudioTaxonomy("deterministic");

    expect(taxonomy.structuralKind).toBe("atomic");
    expect(taxonomy.semanticRole).toBe("tool");
    expect(taxonomy.behaviorKind).toBe("deterministic");
  });

  it("creates tool metadata with tool taxonomy and generated provenance", () => {
    const metadata = normalizeAssetMetadata(createToolAssetMetadata({
      title: "  Web Search Tool  ",
      tags: ["tool", "mcp", "mcp"],
      creatorId: " tool-author-1 ",
    }));

    expect(metadata.title).toBe("Web Search Tool");
    expect(metadata.taxonomy?.semanticRole).toBe("tool");
    expect(metadata.taxonomy?.behaviorKind).toBe("conditional");
    expect(metadata.provenance?.sourceType).toBe("generated");
    expect(metadata.provenance?.sourceLabel).toBe(ToolStudioIdentity.studioType);
    expect(metadata.tags).toEqual(["tool", "mcp"]);
  });
});
