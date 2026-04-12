import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftBuiltInStepCategories,
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftStepKinds,
  createEmptyWorkflowDraft,
  validateWorkflowDraft,
} from "@domain/workflow-studio/WorkflowStudioDomain";
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
    expect(() => registry.validateConfig(WorkflowDraftBuiltInStepTypes.delayWait, {
      mode: "until-time",
      until: {
        timestamp: "not-a-time",
      },
    })).toThrow("timestamp");
    expect(() => registry.validateConfig(WorkflowDraftBuiltInStepTypes.ifThen, {
      condition: { kind: "expression", expression: "x > 0" },
      branches: { then: {} },
    })).toThrow("branches.then");
    expect(() => registry.validateConfig(WorkflowDraftBuiltInStepTypes.loopIteration, {
      mode: "collection",
    })).toThrow("config.collection");
    expect(() => registry.validateConfig(WorkflowDraftBuiltInStepTypes.manualApproval, {
      prompt: "Review this",
      interactionMode: "review",
      outcomes: {
        reject: {
          label: "stop",
        },
      },
    })).toThrow("review mode only allows");

    expect(() => new BuiltInWorkflowStepRegistry([
      {
        type: WorkflowDraftBuiltInStepTypes.ifThen,
        category: WorkflowDraftBuiltInStepCategories.controlFlow,
        label: "If / Then",
        description: "Branch",
        configSchemaId: "workflow.builtin.if-then.v2",
        defaultConfig: {
          condition: { kind: "expression", expression: "true" },
          branches: { then: { label: "then" } },
        },
        validateConfig: (config) => config as never,
      },
      {
        type: WorkflowDraftBuiltInStepTypes.ifThen,
        category: WorkflowDraftBuiltInStepCategories.controlFlow,
        label: "If / Then duplicate",
        description: "Branch duplicate",
        configSchemaId: "workflow.builtin.if-then.v2",
        defaultConfig: {
          condition: { kind: "expression", expression: "true" },
          branches: { then: { label: "then" } },
        },
        validateConfig: (config) => config as never,
      },
    ])).toThrow("already registered");
  });

  it("validates canonical delay and manual interaction step modes", () => {
    const registry = createDefaultBuiltInWorkflowStepRegistry();

    const untilTime = registry.validateConfig(WorkflowDraftBuiltInStepTypes.delayWait, {
      mode: "until-time",
      until: {
        timestamp: "2026-04-02T15:45:00.000Z",
        timezone: "America/New_York",
      },
      note: "Pause until review window",
    });
    expect(untilTime).toMatchObject({
      mode: "until-time",
      until: {
        timestamp: "2026-04-02T15:45:00.000Z",
        timezone: "America/New_York",
      },
      waitUntil: "2026-04-02T15:45:00.000Z",
    });

    const review = registry.validateConfig(WorkflowDraftBuiltInStepTypes.manualApproval, {
      prompt: "Manual verification required",
      interactionMode: "review",
      outcomes: {
        continue: {
          label: "continue",
        },
      },
      onTimeout: "continue",
    });
    expect(review).toMatchObject({
      prompt: "Manual verification required",
      interactionMode: "review",
      outcomes: {
        continue: {
          label: "continue",
        },
      },
      onTimeout: "continue",
    });
  });
});

