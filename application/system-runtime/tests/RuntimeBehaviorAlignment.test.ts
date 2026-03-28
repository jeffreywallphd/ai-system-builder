import { describe, expect, it } from "bun:test";
import type { Agent } from "../../../domain/agents/Agent";
import { TaxonomyBehaviorKinds } from "../../../domain/taxonomy/CompositionTaxonomy";
import type { IWorkflow } from "../../../domain/workflows/interfaces/IWorkflow";
import { CompositionTaxonomyClassifier } from "../../taxonomy/CompositionTaxonomyClassifier";
import {
  classifyExecutableBehavior,
  resolveRuntimeBehaviorForTaxonomy,
  RuntimeBehaviorAlignmentService,
} from "../RuntimeBehaviorAlignment";

describe("RuntimeBehaviorAlignment", () => {
  it("maps deterministic/conditional/iterative/autonomous behaviors into truthful runtime profiles", () => {
    const deterministic = classifyExecutableBehavior({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "deterministic",
    });
    const conditional = classifyExecutableBehavior({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "conditional",
    });
    const iterative = classifyExecutableBehavior({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "iterative",
    });
    const autonomous = classifyExecutableBehavior({
      structuralKind: "system",
      semanticRole: "system",
      behaviorKind: "autonomous",
    });

    expect(deterministic.executionPattern).toBe("fixed");
    expect(conditional.supportsBranching).toBe(true);
    expect(iterative.supportsIteration).toBe(true);
    expect(autonomous.supportsPlanning).toBe(true);
  });

  it("returns undefined for non-executable taxonomy while keeping taxonomy truth authoritative", () => {
    const profile = resolveRuntimeBehaviorForTaxonomy({
      structuralKind: "atomic",
      semanticRole: "model",
      behaviorKind: "none",
    });

    expect(profile).toBeUndefined();
    expect(() => classifyExecutableBehavior({
      structuralKind: "atomic",
      semanticRole: "model",
      behaviorKind: "none",
    })).toThrow("non-executable");
  });

  it("aligns workflow, agent, and system runtime behavior through the shared taxonomy classifier seam", () => {
    const alignment = new RuntimeBehaviorAlignmentService(new CompositionTaxonomyClassifier());

    const workflowProfile = alignment.resolveWorkflowRuntimeBehavior({ id: "wf-1" } as IWorkflow, TaxonomyBehaviorKinds.iterative);
    const agentProfile = alignment.resolveAgentRuntimeBehavior({ id: "agent-1" } as Agent);
    const systemProfile = alignment.resolveSystemRuntimeBehavior("system", TaxonomyBehaviorKinds.conditional);

    expect(workflowProfile.executionPattern).toBe("loop-capable");
    expect(agentProfile.executionPattern).toBe("planner-capable");
    expect(systemProfile.executionPattern).toBe("branch-capable");
  });

  it("rejects unsupported taxonomy/behavior combinations instead of inventing a parallel runtime taxonomy", () => {
    expect(() => resolveRuntimeBehaviorForTaxonomy({
      structuralKind: "atomic",
      semanticRole: "model",
      behaviorKind: "autonomous",
    })).toThrow("invalid");
  });
});
