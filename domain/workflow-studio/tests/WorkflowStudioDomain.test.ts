import { describe, expect, it } from "bun:test";
import {
  createEmptyWorkflowDraft,
  createWorkflowEntity,
  createWorkflowAssetMetadata,
  createWorkflowStudioTaxonomy,
  deserializeWorkflowDraft,
  normalizeWorkflowDraft,
  serializeWorkflowDraft,
  WorkflowStudioIdentity,
} from "../WorkflowStudioDomain";

describe("WorkflowStudioDomain", () => {
  it("creates a core workflow entity with stable identity, lifecycle metadata, and draft linkage", () => {
    const createdAt = new Date("2026-03-29T13:00:00.000Z");
    const entity = createWorkflowEntity({
      id: " workflow-entity-1 ",
      name: "  Automation Workflow  ",
      metadata: {
        summary: "  Canonical workflow draft holder  ",
        tags: ["core", "core", "workflow"],
      },
      draft: {
        triggers: [{ id: "trigger-1", type: "manual" }],
        inputs: [{ id: "input-1", type: "text" }],
        steps: [{ id: "step-1", type: "action", order: 1 }],
        outputs: [{ id: "output-1", type: "json" }],
      },
      now: createdAt,
    });

    expect(entity.id).toBe("workflow-entity-1");
    expect(entity.name).toBe("Automation Workflow");
    expect(entity.metadata.summary).toBe("Canonical workflow draft holder");
    expect(entity.metadata.tags).toEqual(["core", "workflow"]);
    expect(entity.draftRevision).toBe(1);
    expect(entity.createdAt).toBe("2026-03-29T13:00:00.000Z");
    expect(entity.updatedAt).toBe("2026-03-29T13:00:00.000Z");
    expect(entity.draft.steps[0]?.id).toBe("step-1");
  });

  it("requires workflow entity identity and name", () => {
    expect(() => createWorkflowEntity({ id: " ", name: "Workflow" })).toThrow("Workflow entity id is required.");
    expect(() => createWorkflowEntity({ id: "workflow-1", name: " " })).toThrow("Workflow entity name is required.");
  });

  it("supports minimal canonical workflow draft with required sections", () => {
    const empty = createEmptyWorkflowDraft();
    const normalized = normalizeWorkflowDraft(empty);

    expect(normalized.triggers).toEqual([]);
    expect(normalized.inputs).toEqual([]);
    expect(normalized.steps).toEqual([]);
    expect(normalized.outputs).toEqual([]);
  });

  it("preserves and enforces explicit step ordering", () => {
    const normalized = normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [
        { id: "step-b", type: "transform", order: 2 },
        { id: "step-a", type: "load", order: 1 },
      ],
      outputs: [],
    });

    expect(normalized.steps.map((step) => `${step.id}:${step.order}`)).toEqual([
      "step-a:1",
      "step-b:2",
    ]);

    expect(() => normalizeWorkflowDraft({
      triggers: [],
      inputs: [],
      steps: [
        { id: "step-a", type: "load", order: 1 },
        { id: "step-b", type: "transform", order: 1 },
      ],
      outputs: [],
    })).toThrow("Workflow draft step order '1' is duplicated.");
  });

  it("round-trips canonical workflow draft serialization and deserialization", () => {
    const draft = normalizeWorkflowDraft({
      triggers: [{ id: "trigger-manual", type: "manual", title: "Manual Start" }],
      inputs: [{ id: "input-query", type: "text", title: "Query" }],
      steps: [{ id: "step-run", type: "run-tool", order: 1, dependsOnStepIds: [] }],
      outputs: [{ id: "output-result", type: "text" }],
    });

    const serialized = serializeWorkflowDraft(draft);
    const rehydrated = deserializeWorkflowDraft(serialized);

    expect(rehydrated).toEqual(draft);
  });

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
