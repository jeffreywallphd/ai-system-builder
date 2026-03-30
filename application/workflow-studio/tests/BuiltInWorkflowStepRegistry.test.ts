import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftBuiltInStepCategories,
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftStepKinds,
  createEmptyWorkflowDraft,
  validateWorkflowDraft,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  BuiltInWorkflowStepRegistry,
  createDefaultBuiltInWorkflowStepRegistry,
} from "../BuiltInWorkflowStepRegistry";

describe("BuiltInWorkflowStepRegistry", () => {
  it("enumerates canonical built-in steps with stable metadata", () => {
    const registry = createDefaultBuiltInWorkflowStepRegistry();
    const entries = registry.list();

    expect(entries.map((entry) => entry.type)).toEqual([
      WorkflowDraftBuiltInStepTypes.ifThen,
      WorkflowDraftBuiltInStepTypes.loopIteration,
      WorkflowDraftBuiltInStepTypes.delayWait,
      WorkflowDraftBuiltInStepTypes.manualApproval,
    ]);
    expect(entries.map((entry) => entry.category)).toEqual([
      WorkflowDraftBuiltInStepCategories.controlFlow,
      WorkflowDraftBuiltInStepCategories.controlFlow,
      WorkflowDraftBuiltInStepCategories.temporal,
      WorkflowDraftBuiltInStepCategories.humanInteraction,
    ]);
    expect(entries.every((entry) => entry.label.trim().length > 0)).toBeTrue();
    expect(entries.every((entry) => entry.description.trim().length > 0)).toBeTrue();
    expect(entries.every((entry) => entry.configSchemaId.startsWith("workflow.builtin."))).toBeTrue();
    expect(entries.every((entry) => entry.validationEntryPoint === "normalizeWorkflowDraftBuiltInStepConfig")).toBeTrue();
  });

  it("supports stable lookup, support checks, and category filtering", () => {
    const registry = createDefaultBuiltInWorkflowStepRegistry();

    expect(registry.isSupported(WorkflowDraftBuiltInStepTypes.ifThen)).toBeTrue();
    expect(registry.isSupported("future-step")).toBeFalse();
    expect(registry.get("future-step")).toBeUndefined();
    expect(registry.get(WorkflowDraftBuiltInStepTypes.manualApproval)?.category).toBe("human-interaction");
    expect(registry.listByCategory(WorkflowDraftBuiltInStepCategories.controlFlow).map((entry) => entry.type)).toEqual([
      WorkflowDraftBuiltInStepTypes.ifThen,
      WorkflowDraftBuiltInStepTypes.loopIteration,
    ]);
  });

  it("creates default configs and validates them through domain entry points", () => {
    const registry = createDefaultBuiltInWorkflowStepRegistry();

    const builtInSteps = registry.list().map((entry, index) => Object.freeze({
      id: `step-${index + 1}`,
      order: index + 1,
      kind: WorkflowDraftStepKinds.controlFlow,
      type: entry.type,
      config: registry.validateConfig(entry.type, registry.createDefaultConfig(entry.type)),
    }));

    const validation = validateWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      steps: builtInSteps,
    });

    expect(validation.valid).toBeTrue();
  });

  it("rejects malformed built-in configs and duplicate registrations", () => {
    const registry = createDefaultBuiltInWorkflowStepRegistry();
    expect(() => registry.validateConfig(WorkflowDraftBuiltInStepTypes.delayWait, { durationSeconds: 0 })).toThrow("durationSeconds");

    expect(() => new BuiltInWorkflowStepRegistry([
      {
        type: WorkflowDraftBuiltInStepTypes.ifThen,
        category: WorkflowDraftBuiltInStepCategories.controlFlow,
        label: "If / Then",
        description: "Branch",
        configSchemaId: "workflow.builtin.if-then.v1",
        defaultConfig: { conditionExpression: "true" },
        validateConfig: (config) => config as { conditionExpression: string },
      },
      {
        type: WorkflowDraftBuiltInStepTypes.ifThen,
        category: WorkflowDraftBuiltInStepCategories.controlFlow,
        label: "If / Then duplicate",
        description: "Branch duplicate",
        configSchemaId: "workflow.builtin.if-then.v1",
        defaultConfig: { conditionExpression: "true" },
        validateConfig: (config) => config as { conditionExpression: string },
      },
    ])).toThrow("already registered");
  });
});
