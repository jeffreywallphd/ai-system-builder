import { describe, expect, it } from "bun:test";
import {
  createToolChainAssetMetadata,
  createToolChainStudioTaxonomy,
  ToolChainStudioIdentity,
} from "../ToolChainStudioDomain";

describe("ToolChainStudioDomain", () => {
  it("creates composite tool-chain taxonomy with deterministic behavior", () => {
    const taxonomy = createToolChainStudioTaxonomy();

    expect(taxonomy.structuralKind).toBe("composite");
    expect(taxonomy.semanticRole).toBe("tool-chain");
    expect(taxonomy.behaviorKind).toBe("deterministic");
  });

  it("builds tool-chain metadata with composite taxonomy and generated provenance defaults", () => {
    const metadata = createToolChainAssetMetadata({
      title: "Tool Chain Draft",
      summary: "Composite chain coordinating sequential tool invocation steps over reusable tool assets",
      tags: ["studio-shell", "tool-orchestration", "mcp", "multi-step"],
      creatorId: "author-1",
      contract: {
        version: "1.0.0",
        input: { kind: "json-schema" },
        output: { kind: "json-schema" },
      },
    });

    expect(metadata.tags).toEqual([
      "tool-chain",
      "studio-shell",
      "tool-orchestration",
      "mcp",
      "multi-step",
    ]);
    expect(metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "tool-chain",
      behaviorKind: "deterministic",
    });
    expect(metadata.provenance?.sourceType).toBe("generated");
    expect(metadata.provenance?.sourceLabel).toBe(ToolChainStudioIdentity.studioType);
    expect(metadata.provenance?.creatorId).toBe("author-1");
  });
});
