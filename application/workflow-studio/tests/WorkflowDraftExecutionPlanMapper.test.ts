import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftStepKinds,
  WorkflowDraftStepTypes,
  createEmptyWorkflowDraft,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  mapWorkflowDraftToExecutionPlan,
  WorkflowDraftExecutionPlanSchemaVersion,
} from "../WorkflowDraftExecutionPlanMapper";

describe("WorkflowDraftExecutionPlanMapper", () => {
  it("maps canonical built-in workflow steps into explicit execution-plan elements", () => {
    const plan = mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "step-1",
          type: WorkflowDraftStepTypes.agentAssistant,
          kind: WorkflowDraftStepKinds.assetBacked,
          order: 1,
          assetRef: {
            assetKind: "agent-assistant",
            asset: {
              assetId: "asset:agent-reviewer",
            },
          },
        },
        {
          id: "step-2",
          type: WorkflowDraftBuiltInStepTypes.ifThen,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 2,
          config: {
            conditionExpression: "inputs.score > 0.8",
            thenStepIds: ["step-3"],
            elseStepIds: ["step-4"],
          },
        },
        {
          id: "step-3",
          type: WorkflowDraftBuiltInStepTypes.loopIteration,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 3,
          config: {
            repeatCount: 2,
            bodyStepIds: ["step-5"],
          },
        },
        {
          id: "step-4",
          type: WorkflowDraftBuiltInStepTypes.delayWait,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 4,
          config: {
            durationSeconds: 30,
          },
        },
        {
          id: "step-5",
          type: WorkflowDraftBuiltInStepTypes.manualApproval,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 5,
          config: {
            prompt: "Approve output",
            interactionMode: "approval",
            outcomes: {
              approve: {
                stepIds: ["step-6"],
              },
            },
          },
        },
        {
          id: "step-6",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 6,
        },
      ],
    });

    expect(plan.schemaVersion).toBe(WorkflowDraftExecutionPlanSchemaVersion);
    expect(plan.orderedStepIds).toEqual(["step-1", "step-2", "step-3", "step-4", "step-5", "step-6"]);
    expect(plan.elements.map((element) => element.elementType)).toEqual([
      "action-step",
      "built-in.if-then",
      "built-in.loop-iteration",
      "built-in.delay-wait",
      "built-in.manual-approval",
      "action-step",
    ]);
  });

  it("produces deterministic plan output for the same canonical workflow draft", () => {
    const draft = {
      ...createEmptyWorkflowDraft(),
      steps: [
        { id: "step-a", type: "action", kind: WorkflowDraftStepKinds.action, order: 1 },
        { id: "step-b", type: "action", kind: WorkflowDraftStepKinds.action, order: 2, dependsOnStepIds: ["step-a"] },
      ],
    };

    const first = mapWorkflowDraftToExecutionPlan(draft);
    const second = mapWorkflowDraftToExecutionPlan(draft);
    expect(first).toEqual(second);
  });

  it("fails planning for invalid built-in step references before execution-plan mapping succeeds", () => {
    expect(() => mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "step-if",
          type: WorkflowDraftBuiltInStepTypes.ifThen,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 1,
          config: {
            conditionExpression: "inputs.ready",
            thenStepIds: ["step-missing"],
          },
        },
      ],
    })).toThrow("built-in-step-reference-missing");

    expect(() => mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "step-manual",
          type: WorkflowDraftBuiltInStepTypes.manualApproval,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 2,
          config: {
            prompt: "Approve",
            interactionMode: "approval",
            outcomes: {
              approve: {
                stepIds: ["step-action"],
              },
            },
          },
        },
        {
          id: "step-action",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        },
      ],
    })).toThrow("built-in-step-reference-order-invalid");
  });
});
