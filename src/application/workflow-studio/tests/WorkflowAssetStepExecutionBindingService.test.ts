import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftStepKinds,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  createEmptyWorkflowDraft,
} from "@domain/workflow-studio/WorkflowStudioDomain";
import { translateWorkflowDefinitionToExecutionPlan } from "../WorkflowDefinitionExecutionPlanTranslator";

describe("WorkflowAssetStepExecutionBindingService", () => {
  it("builds execution-ready bindings for agent-assistant asset-backed steps", () => {
    const result = translateWorkflowDefinitionToExecutionPlan({
      context: {
        inputValues: {
          prompt: "Summarize quarterly revenue",
          locale: "en-US",
        },
      },
      draft: {
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-manual",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        }],
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
            instruction: "Return an executive summary",
          },
          assetRef: {
            assetKind: "agent-assistant",
            asset: {
              assetId: "asset:agent:finance-analyst",
              versionId: "asset:agent:finance-analyst:v2",
            },
          },
        }],
      },
    });

    expect(result.success).toBeTrue();
    expect(result.plan?.assetStepBindings).toEqual([expect.objectContaining({
      bindingId: "asset-step:step-agent",
      stepId: "step-agent",
      invocationKind: "agent-assistant",
      asset: {
        assetKind: "agent-assistant",
        assetId: "asset:agent:finance-analyst",
        versionId: "asset:agent:finance-analyst:v2",
      },
      inputBinding: expect.objectContaining({
        config: {
          instruction: "Return an executive summary",
        },
        resolvedInputValues: {
          "input-prompt": "Summarize quarterly revenue",
        },
      }),
    })]);
  });

  it("fails translation when an asset-backed step references an unsupported executable asset kind", () => {
    const result = translateWorkflowDefinitionToExecutionPlan({
      draft: {
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-manual",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        }],
        steps: [{
          id: "step-unsupported",
          type: "custom-asset-exec",
          kind: WorkflowDraftStepKinds.assetBacked,
          order: 1,
          assetRef: {
            assetKind: "custom-runtime-asset",
            asset: {
              assetId: "asset:custom:1",
            },
          },
        }],
      },
    });

    expect(result.success).toBeFalse();
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "asset-step-asset-kind-unsupported",
      severity: "error",
    }));
  });

  it("keeps asset-backed bindings compatible with built-in control-flow mappings", () => {
    const result = translateWorkflowDefinitionToExecutionPlan({
      draft: {
        ...createEmptyWorkflowDraft(),
        steps: [
          {
            id: "step-agent",
            type: "agent-assistant",
            kind: WorkflowDraftStepKinds.assetBacked,
            order: 1,
            assetRef: {
              assetKind: "agent-assistant",
              asset: {
                assetId: "asset:agent:router",
              },
            },
          },
          {
            id: "step-if",
            type: WorkflowDraftBuiltInStepTypes.ifThen,
            kind: WorkflowDraftStepKinds.controlFlow,
            order: 2,
            config: {
              conditionExpression: "inputs.route === 'approve'",
              thenStepIds: ["step-approved"],
              elseStepIds: ["step-rejected"],
            },
          },
          {
            id: "step-approved",
            type: "action",
            kind: WorkflowDraftStepKinds.action,
            order: 3,
          },
          {
            id: "step-rejected",
            type: "action",
            kind: WorkflowDraftStepKinds.action,
            order: 4,
          },
        ],
      },
    });

    expect(result.success).toBeTrue();
    expect(result.plan?.assetStepBindings.map((entry) => entry.stepId)).toEqual(["step-agent"]);
    expect(result.plan?.controlFlowMappings).toContainEqual(expect.objectContaining({
      mappingType: "branch",
      stepId: "step-if",
      thenStepIds: ["step-approved"],
      elseStepIds: ["step-rejected"],
    }));
  });
});


