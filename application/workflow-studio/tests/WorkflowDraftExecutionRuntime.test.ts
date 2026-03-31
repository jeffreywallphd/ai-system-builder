import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftStepKinds,
  createEmptyWorkflowDraft,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import { mapWorkflowDraftToExecutionPlan } from "../WorkflowDraftExecutionPlanMapper";
import {
  WorkflowDraftExecutionRuntime,
  WorkflowDraftRuntimeExecutionStatusKinds,
} from "../WorkflowDraftExecutionRuntime";

function buildPlan() {
  return mapWorkflowDraftToExecutionPlan({
    ...createEmptyWorkflowDraft(),
    steps: [
      {
        id: "step-if",
        type: WorkflowDraftBuiltInStepTypes.ifThen,
        kind: WorkflowDraftStepKinds.controlFlow,
        order: 1,
        config: {
          conditionExpression: "inputs.approved === true",
          thenStepIds: ["step-loop"],
          elseStepIds: ["step-delay"],
        },
      },
      {
        id: "step-loop",
        type: WorkflowDraftBuiltInStepTypes.loopIteration,
        kind: WorkflowDraftStepKinds.controlFlow,
        order: 2,
        config: {
          repeatCount: 2,
          bodyStepIds: ["step-action"],
        },
      },
      {
        id: "step-delay",
        type: WorkflowDraftBuiltInStepTypes.delayWait,
        kind: WorkflowDraftStepKinds.controlFlow,
        order: 3,
        config: {
          durationSeconds: 1,
        },
      },
      {
        id: "step-action",
        type: "action",
        kind: WorkflowDraftStepKinds.action,
        order: 4,
      },
      {
        id: "step-manual",
        type: WorkflowDraftBuiltInStepTypes.manualApproval,
        kind: WorkflowDraftStepKinds.controlFlow,
        order: 5,
        config: {
          prompt: "Approve final publish",
          interactionMode: "approval",
          outcomes: {
            approve: {
              stepIds: ["step-publish"],
            },
            reject: {
              stepIds: ["step-rework"],
            },
          },
        },
      },
      {
        id: "step-publish",
        type: "action",
        kind: WorkflowDraftStepKinds.action,
        order: 6,
      },
      {
        id: "step-rework",
        type: "action",
        kind: WorkflowDraftStepKinds.action,
        order: 7,
      },
    ],
  });
}

describe("WorkflowDraftExecutionRuntime", () => {
  it("executes planned built-in control flow deterministically", async () => {
    const runtime = new WorkflowDraftExecutionRuntime();
    const sleepCalls: number[] = [];

    const result = await runtime.execute({
      plan: buildPlan(),
      inputs: {
        approved: true,
      },
      manualDecisionsByStepId: {
        "step-manual": {
          outcome: "approve",
        },
      },
      actionExecutor: (element, context) => ({
        ran: element.stepId,
        loopIteration: context.loop?.iteration,
      }),
      sleep: async (milliseconds) => {
        sleepCalls.push(milliseconds);
      },
    });

    expect(result.status).toBe(WorkflowDraftRuntimeExecutionStatusKinds.completed);
    expect(result.issues.some((issue) => issue.code === "workflow-runtime-step-failed")).toBeFalse();
    expect(sleepCalls).toEqual([]);

    const completedStepIds = result.traces
      .filter((entry) => entry.status === "completed")
      .map((entry) => entry.stepId);

    expect(completedStepIds).toEqual([
      "step-if",
      "step-loop",
      "step-action",
      "step-action",
      "step-manual",
      "step-publish",
    ]);

    expect(result.traces.some((entry) => entry.stepId === "step-delay" && entry.status === "skipped")).toBeTrue();
    expect(result.traces.some((entry) => entry.stepId === "step-rework" && entry.status === "skipped")).toBeTrue();
  });

  it("supports wait-delay semantics through an injectable sleep boundary", async () => {
    const runtime = new WorkflowDraftExecutionRuntime();
    const plan = mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "step-delay",
          type: WorkflowDraftBuiltInStepTypes.delayWait,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 1,
          config: {
            durationSeconds: 30,
          },
        },
      ],
    });

    const sleepCalls: number[] = [];
    const result = await runtime.execute({
      plan,
      sleep: async (milliseconds) => {
        sleepCalls.push(milliseconds);
      },
    });

    expect(result.status).toBe(WorkflowDraftRuntimeExecutionStatusKinds.completed);
    expect(sleepCalls).toEqual([30000]);
  });

  it("pauses runtime execution when manual decision input is not available", async () => {
    const runtime = new WorkflowDraftExecutionRuntime();
    const plan = mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "step-manual",
          type: WorkflowDraftBuiltInStepTypes.manualApproval,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 1,
          config: {
            prompt: "Approve release",
            interactionMode: "approval",
            outcomes: {
              approve: {
                stepIds: ["step-next"],
              },
            },
          },
        },
        {
          id: "step-next",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 2,
        },
      ],
    });

    const result = await runtime.execute({ plan });

    expect(result.status).toBe(WorkflowDraftRuntimeExecutionStatusKinds.paused);
    expect(result.pausedAt?.stepId).toBe("step-manual");
    expect(result.traces.some((entry) => entry.stepId === "step-manual" && entry.status === "paused")).toBeTrue();
  });

  it("fails with an explicit issue when manual outcome is invalid", async () => {
    const runtime = new WorkflowDraftExecutionRuntime();
    const plan = mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "step-manual",
          type: WorkflowDraftBuiltInStepTypes.manualApproval,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 1,
          config: {
            prompt: "Review result",
            interactionMode: "review",
            outcomes: {
              continue: {
                stepIds: ["step-next"],
              },
            },
          },
        },
        {
          id: "step-next",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 2,
        },
      ],
    });

    const result = await runtime.execute({
      plan,
      manualDecisionsByStepId: {
        "step-manual": {
          outcome: "approve",
        },
      },
    });

    expect(result.status).toBe(WorkflowDraftRuntimeExecutionStatusKinds.failed);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "manual-outcome-unsupported",
      stepId: "step-manual",
    }));
  });

  it("invokes asset-backed action steps through the aligned asset-step execution seam", async () => {
    const runtime = new WorkflowDraftExecutionRuntime();
    const plan = mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      inputs: [{
        id: "input-prompt",
        type: "runtime-input",
        sourceType: "runtime-parameter",
        parameterKey: "prompt",
        required: true,
      }],
      steps: [{
        id: "step-agent",
        type: "agent-assistant",
        kind: WorkflowDraftStepKinds.assetBacked,
        order: 1,
        config: {
          mode: "analysis",
        },
        assetRef: {
          assetKind: "agent-assistant",
          asset: {
            assetId: "asset:agent:analyst",
          },
        },
      }],
    });

    const result = await runtime.execute({
      plan,
      inputs: {
        prompt: "Analyze churn drivers",
      },
      assetStepExecutor: (binding, context) => Object.freeze({
        invokedStepId: binding.stepId,
        invokedAssetId: binding.asset.assetId,
        resolvedPrompt: binding.inputBinding.resolvedInputValues["input-prompt"],
        runtimePrompt: context.inputs.prompt,
      }),
    });

    expect(result.status).toBe(WorkflowDraftRuntimeExecutionStatusKinds.completed);
    expect(result.stepOutputs["step-agent"]).toEqual({
      invokedStepId: "step-agent",
      invokedAssetId: "asset:agent:analyst",
      resolvedPrompt: "Analyze churn drivers",
      runtimePrompt: "Analyze churn drivers",
    });
  });

  it("fails asset-backed step execution clearly when no asset-step runtime invoker is configured", async () => {
    const runtime = new WorkflowDraftExecutionRuntime();
    const plan = mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      steps: [{
        id: "step-agent",
        type: "agent-assistant",
        kind: WorkflowDraftStepKinds.assetBacked,
        order: 1,
        assetRef: {
          assetKind: "agent-assistant",
          asset: {
            assetId: "asset:agent:analyst",
          },
        },
      }],
    });

    const result = await runtime.execute({ plan });
    expect(result.status).toBe(WorkflowDraftRuntimeExecutionStatusKinds.failed);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "workflow-runtime-step-failed",
      stepId: "step-agent",
      message: expect.stringContaining("asset-step-executor-unavailable"),
    }));
  });
});
