import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  WorkflowDraftStepKinds,
  createEmptyWorkflowDraft,
} from "@domain/workflow-studio/WorkflowStudioDomain";
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
    expect(result.outputDelivery.results).toEqual([]);
    expect(result.outputDelivery.issues).toEqual([]);

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
    expect(result.outputDelivery.results).toEqual([]);
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
    expect(result.outputDelivery.results).toEqual([]);
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
    expect(result.outputDelivery.results).toEqual([]);
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
    expect(result.outputDelivery.results).toEqual([]);
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
    expect(result.outputDelivery.results).toEqual([]);
  });

  it("delivers workflow outputs for viewer/file/system destinations from execution-plan bindings", async () => {
    const runtime = new WorkflowDraftExecutionRuntime();
    const plan = mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      steps: [{
        id: "step-1",
        type: "action",
        kind: WorkflowDraftStepKinds.action,
        order: 1,
      }],
      outputs: [
        {
          id: "output-viewer",
          type: "workflow-output",
          order: 1,
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.markdown,
          sourceStepId: "step-1",
          destination: {
            type: WorkflowDraftOutputDestinationTypes.webViewer,
            target: "in-app-view",
            options: {
              title: "Viewer",
              presentationMode: "embedded",
            },
          },
        },
        {
          id: "output-file",
          type: "workflow-output",
          order: 2,
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.json,
          sourceStepId: "step-1",
          destination: {
            type: WorkflowDraftOutputDestinationTypes.fileExport,
            target: "file-download",
            options: {
              deliveryMode: "download",
            },
          },
        },
        {
          id: "output-system",
          type: "workflow-output",
          order: 3,
          outputType: WorkflowDraftOutputTypes.record,
          format: WorkflowDraftOutputFormats.json,
          sourceStepId: "step-1",
          destination: {
            type: WorkflowDraftOutputDestinationTypes.systemEntry,
            target: "system-record",
            options: {
              entityName: "customer.record",
              writeMode: "upsert",
              recordShape: "single-record",
              includeExecutionMetadata: "true",
            },
          },
        },
      ],
    });

    const result = await runtime.execute({
      plan,
      actionExecutor: () => Object.freeze({ recordId: "record-1" }),
    });

    expect(result.status).toBe(WorkflowDraftRuntimeExecutionStatusKinds.completed);
    expect(result.outputDelivery.results.map((entry) => entry.outputId)).toEqual([
      "output-viewer",
      "output-file",
      "output-system",
    ]);
    expect(result.outputDelivery.issues).toEqual([]);
  });

  it("fails execution with structured output-delivery issue when delivery configuration is incomplete", async () => {
    const runtime = new WorkflowDraftExecutionRuntime();
    const plan = mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      steps: [{
        id: "step-1",
        type: "action",
        kind: WorkflowDraftStepKinds.action,
        order: 1,
      }],
      outputs: [{
        id: "output-file",
        type: "workflow-output",
        order: 1,
        outputType: WorkflowDraftOutputTypes.document,
        format: WorkflowDraftOutputFormats.json,
        sourceStepId: "step-1",
        destination: {
          type: WorkflowDraftOutputDestinationTypes.fileExport,
          target: "workspace-file",
          options: {
            deliveryMode: "workspace-file",
          },
        },
      }],
    });

    const result = await runtime.execute({
      plan,
      actionExecutor: () => Object.freeze({ ok: true }),
    });

    expect(result.status).toBe(WorkflowDraftRuntimeExecutionStatusKinds.failed);
    expect(result.outputDelivery.issues).toContainEqual(expect.objectContaining({
      code: "output-delivery-config-missing",
      outputId: "output-file",
    }));
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "output-delivery-config-missing",
      stepId: "output-file",
    }));
  });
});

