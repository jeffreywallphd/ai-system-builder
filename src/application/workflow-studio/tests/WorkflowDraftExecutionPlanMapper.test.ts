import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftStepKinds,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  WorkflowDraftStepTypes,
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  createEmptyWorkflowDraft,
} from "@domain/workflow-studio/WorkflowStudioDomain";
import {
  mapWorkflowDraftToExecutionPlan,
  WorkflowDraftExecutionPlanSchemaVersion,
} from "../WorkflowDraftExecutionPlanMapper";

describe("WorkflowDraftExecutionPlanMapper", () => {
  it("maps canonical built-in workflow steps into explicit execution-plan elements", () => {
    const plan = mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      triggers: [
        {
          id: "trigger-manual",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        },
        {
          id: "trigger-temporal",
          kind: WorkflowDraftTriggerKinds.temporal,
          type: WorkflowDraftTriggerTypes.temporalSchedule,
          config: {
            cronExpression: "0 9 * * *",
          },
        },
        {
          id: "trigger-state",
          kind: WorkflowDraftTriggerKinds.state,
          type: WorkflowDraftTriggerTypes.stateSystemEvent,
          config: {
            eventName: "system-updated",
          },
        },
      ],
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
    expect(plan.triggers.map((trigger) => `${trigger.runtimeKind}:${trigger.triggerId}`)).toEqual([
      "manual:trigger-manual",
      "temporal:trigger-temporal",
      "state:trigger-state",
    ]);
    expect(plan.orderedStepIds).toEqual(["step-1", "step-2", "step-3", "step-4", "step-5", "step-6"]);
    expect(plan.elements.map((element) => element.elementType)).toEqual([
      "action-step",
      "built-in.if-then",
      "built-in.loop-iteration",
      "built-in.delay-wait",
      "built-in.manual-approval",
      "action-step",
    ]);
    expect(plan.outputs).toEqual([]);
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

  it("maps canonical workflow outputs into ordered execution output plans", () => {
    const plan = mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      inputs: [
        {
          id: "input-prompt",
          type: "runtime-input",
          sourceType: "runtime-parameter",
          parameterKey: "prompt",
          valueType: "string",
        },
      ],
      steps: [
        {
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        },
      ],
      outputs: [
        {
          id: "output-chat",
          type: "workflow-output",
          order: 2,
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.json,
          sourceStepId: "step-1",
          destination: {
            type: WorkflowDraftOutputDestinationTypes.promptResponseChat,
            target: "chat-session",
            options: {
              title: "Chat",
              promptInputId: "input-prompt",
              responseField: "assistant-response",
              conversationScope: "continue-session",
            },
          },
        },
        {
          id: "output-file",
          type: "workflow-output",
          order: 1,
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.json,
          destination: {
            type: WorkflowDraftOutputDestinationTypes.fileExport,
            target: "file-download",
            options: {
              deliveryMode: "download",
              fileName: "report",
            },
          },
        },
      ],
    });

    expect(plan.outputs.map((output) => output.outputId)).toEqual(["output-file", "output-chat"]);
    expect(plan.outputs.map((output) => output.order)).toEqual([1, 2]);
    expect(plan.outputs[0]).toMatchObject({
      outputId: "output-file",
      destination: {
        type: WorkflowDraftOutputDestinationTypes.fileExport,
      },
      runtime: {
        outputHandlerType: WorkflowDraftOutputDestinationTypes.fileExport,
        configSchemaId: "workflow.output.destination.file-export.v1",
        supportsConversationalOutput: false,
      },
    });
    expect(plan.outputs[1]).toMatchObject({
      outputId: "output-chat",
      sourceStepId: "step-1",
      destination: {
        type: WorkflowDraftOutputDestinationTypes.promptResponseChat,
      },
      runtime: {
        outputHandlerType: WorkflowDraftOutputDestinationTypes.promptResponseChat,
        supportsConversationalOutput: true,
        conversational: {
          promptInputLinkKey: "promptInputId",
          responseFieldKey: "responseField",
        },
      },
    });
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

  it("fails planning when canonical trigger definitions are invalid", () => {
    expect(() => mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      triggers: [
        {
          id: "trigger-invalid",
          kind: WorkflowDraftTriggerKinds.state,
          type: WorkflowDraftTriggerTypes.stateSystemEvent,
          config: {},
        },
      ],
      steps: [
        {
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        },
      ],
    })).toThrow("trigger-malformed");
  });

  it("fails planning before runtime when output destination type is unsupported", () => {
    expect(() => mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        },
      ],
      outputs: [
        {
          id: "output-unsupported",
          type: "workflow-output",
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.json,
          destination: {
            type: "unknown-output-type",
            target: "unsupported",
          },
        },
      ],
    })).toThrow("output-plan-unsupported-type");
  });

  it("fails planning before runtime when output type and destination contract are incompatible", () => {
    expect(() => mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        },
      ],
      outputs: [
        {
          id: "output-type-mismatch",
          type: "workflow-output",
          outputType: WorkflowDraftOutputTypes.record,
          format: WorkflowDraftOutputFormats.json,
          destination: {
            type: WorkflowDraftOutputDestinationTypes.fileExport,
            target: "file-download",
          },
        },
      ],
    })).toThrow("output-plan-output-type-mismatch");
  });

  it("fails planning for conversational outputs with missing required configuration", () => {
    expect(() => mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      inputs: [
        {
          id: "input-prompt",
          type: "runtime-input",
          sourceType: "runtime-parameter",
          parameterKey: "prompt",
          valueType: "string",
        },
      ],
      steps: [
        {
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        },
      ],
      outputs: [
        {
          id: "output-chat",
          type: "workflow-output",
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.json,
          destination: {
            type: WorkflowDraftOutputDestinationTypes.promptResponseChat,
            target: "chat",
            options: {
              title: "Chat",
              promptInputId: "input-prompt",
            },
          },
        },
      ],
    })).toThrow("output-prompt-response-field-missing");
  });
});

