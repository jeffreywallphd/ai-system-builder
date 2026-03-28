import { describe, expect, it } from "bun:test";
import {
  createWorkflowAssetMetadata,
  createWorkflowStudioTaxonomy,
  WorkflowStudioIdentity,
} from "../WorkflowStudioDomain";

describe("WorkflowStudioDomain", () => {
  it("creates composite workflow taxonomy with deterministic default behavior", () => {
    const taxonomy = createWorkflowStudioTaxonomy();

    expect(taxonomy.structuralKind).toBe("composite");
    expect(taxonomy.semanticRole).toBe("workflow");
    expect(taxonomy.behaviorKind).toBe("deterministic");
  });

  it("supports valid workflow orchestrator behavior kinds", () => {
    expect(createWorkflowStudioTaxonomy("deterministic").behaviorKind).toBe("deterministic");
    expect(createWorkflowStudioTaxonomy("conditional").behaviorKind).toBe("conditional");
    expect(createWorkflowStudioTaxonomy("iterative").behaviorKind).toBe("iterative");
  });

  it("builds workflow metadata with composite taxonomy and generated provenance defaults", () => {
    const metadata = createWorkflowAssetMetadata({
      title: "Workflow Draft",
      summary: "Workflow orchestrator asset",
      tags: ["studio-shell"],
      creatorId: "author-1",
      behaviorKind: "conditional",
      contract: {
        version: "1.0.0",
        input: { kind: "json-schema" },
        output: { kind: "json-schema" },
      },
    });

    expect(metadata.tags).toEqual(["workflow", "studio-shell"]);
    expect(metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "conditional",
    });
    expect(metadata.provenance?.sourceType).toBe("generated");
    expect(metadata.provenance?.sourceLabel).toBe(WorkflowStudioIdentity.studioType);
    expect(metadata.provenance?.creatorId).toBe("author-1");
  });
});
