import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  WorkflowDraftStepKinds,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  createEmptyWorkflowDraft,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  mapWorkflowInputToExecutionBinding,
  WorkflowExecutionValidationStages,
} from "../WorkflowExecutionAlignmentContracts";
import {
  mapWorkflowDraftToExecutionPlan,
  translateWorkflowDefinitionToExecutionPlan,
} from "../WorkflowDefinitionExecutionPlanTranslator";

describe("WorkflowExecutionAlignmentContracts", () => {
  it("maps canonical input definitions into execution input bindings", () => {
    const datasetBinding = mapWorkflowInputToExecutionBinding({
      id: "input-dataset",
      type: "dataset-input",
      sourceType: "dataset-asset",
      required: true,
      valueType: "object",
      asset: {
        assetId: "asset:dataset-1",
        versionId: "asset:dataset-1:v2",
      },
      format: "jsonl",
      selection: {
        split: "train",
      },
    });
    const runtimeBinding = mapWorkflowInputToExecutionBinding({
      id: "input-prompt",
      type: "runtime-input",
      sourceType: "runtime-parameter",
      parameterKey: "prompt",
      defaultValue: "Hello",
    });
    const staticBinding = mapWorkflowInputToExecutionBinding({
      id: "input-static",
      type: "static-input",
      sourceType: "static-value",
      value: 42,
    });

    expect(datasetBinding).toMatchObject({
      inputId: "input-dataset",
      sourceType: "dataset-asset",
      required: true,
      bindingKey: "inputs.input-dataset.dataset",
      dataset: {
        assetId: "asset:dataset-1",
        versionId: "asset:dataset-1:v2",
      },
    });
    expect(runtimeBinding).toMatchObject({
      inputId: "input-prompt",
      sourceType: "runtime-parameter",
      bindingKey: "inputs.prompt",
      defaultValue: "Hello",
    });
    expect(staticBinding).toMatchObject({
      inputId: "input-static",
      sourceType: "static-value",
      bindingKey: "inputs.input-static.static",
      staticValue: 42,
    });
  });
});

describe("WorkflowDefinitionExecutionPlanTranslator", () => {
  it("translates a linear workflow into ordered execution steps with request/context and trigger handoff", () => {
    const result = translateWorkflowDefinitionToExecutionPlan({
      request: {
        requestId: "req-100",
        workflowId: "workflow:alpha",
        workflowName: "Alpha workflow",
        draftRevision: 3,
      },
      context: {
        inputValues: {
          prompt: "Run",
        },
        triggerActivation: {
          triggerId: "trigger-manual",
          activationType: "manual",
          payload: {
            source: "ui",
          },
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
          valueType: "string",
        }],
        steps: [{
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        }],
      },
    });

    expect(result.success).toBe(true);
    expect(result.validationBoundary).toEqual({
      stage: WorkflowExecutionValidationStages.preExecution,
      ready: true,
      issues: [],
    });
    expect(result.plan).toBeDefined();
    expect(result.plan?.executionRequest).toMatchObject({
      source: "workflow-draft",
      requestId: "req-100",
      workflowId: "workflow:alpha",
      workflowName: "Alpha workflow",
      draftRevision: 3,
    });
    expect(result.plan?.executionContext.inputValues).toEqual({ prompt: "Run" });
    expect(result.plan?.triggerHandoff).toMatchObject({
      handoffMode: "activated",
      activation: {
        triggerId: "trigger-manual",
        activationType: "manual",
      },
    });
    expect(result.plan?.orderedStepIds).toEqual(["step-1"]);
    expect(result.plan?.stepSequencing).toEqual([{
      stepId: "step-1",
      stepType: "action",
      stepKind: WorkflowDraftStepKinds.action,
      order: 1,
      dependsOnStepIds: [],
    }]);
    expect(result.plan?.inputBindings).toEqual([expect.objectContaining({
      inputId: "input-prompt",
      sourceType: "runtime-parameter",
      bindingKey: "inputs.prompt",
    })]);
  });

  it("translates ordered steps with control-flow metadata, triggers, asset-backed steps, and outputs", () => {
    const plan = mapWorkflowDraftToExecutionPlan({
      ...createEmptyWorkflowDraft(),
      triggers: [
        {
          id: "trigger-temporal",
          kind: WorkflowDraftTriggerKinds.temporal,
          type: WorkflowDraftTriggerTypes.temporalSchedule,
          config: {
            cronExpression: "0 8 * * *",
          },
        },
      ],
      steps: [
        {
          id: "step-agent",
          type: "agent-assistant",
          kind: WorkflowDraftStepKinds.assetBacked,
          order: 1,
          assetRef: {
            assetKind: "agent-assistant",
            asset: {
              assetId: "asset:agent-1",
            },
          },
        },
        {
          id: "step-if",
          type: WorkflowDraftBuiltInStepTypes.ifThen,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 2,
          config: {
            conditionExpression: "inputs.score > 0.8",
            thenStepIds: ["step-final"],
          },
        },
        {
          id: "step-final",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 3,
          dependsOnStepIds: ["step-agent"],
        },
      ],
      outputs: [
        {
          id: "output-file",
          type: "workflow-output",
          order: 1,
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.json,
          sourceStepId: "step-final",
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

    expect(plan.orderedStepIds).toEqual(["step-agent", "step-if", "step-final"]);
    expect(plan.triggers[0]).toMatchObject({
      triggerId: "trigger-temporal",
      runtimeKind: "temporal",
    });
    expect(plan.elements[0]).toMatchObject({
      elementType: "action-step",
      stepId: "step-agent",
      stepKind: WorkflowDraftStepKinds.assetBacked,
      assetRef: {
        asset: {
          assetId: "asset:agent-1",
        },
      },
    });
    expect(plan.stepSequencing.find((entry) => entry.stepId === "step-if")).toEqual({
      stepId: "step-if",
      stepType: WorkflowDraftBuiltInStepTypes.ifThen,
      stepKind: WorkflowDraftStepKinds.controlFlow,
      order: 2,
      dependsOnStepIds: [],
      controlFlow: {
        branchStepIds: {
          then: ["step-final"],
          else: [],
        },
      },
    });
    expect(plan.outputs).toEqual([expect.objectContaining({
      outputId: "output-file",
      sourceStepId: "step-final",
      runtime: expect.objectContaining({
        outputHandlerType: WorkflowDraftOutputDestinationTypes.fileExport,
      }),
    })]);
    expect(plan.outputBindings).toEqual([{
      outputId: "output-file",
      outputType: WorkflowDraftOutputTypes.document,
      format: WorkflowDraftOutputFormats.json,
      sourceStepId: "step-final",
      destinationType: WorkflowDraftOutputDestinationTypes.fileExport,
      target: "file-download",
      options: {
        deliveryMode: "download",
        fileName: "report",
      },
    }]);
  });

  it("returns structured translation failure for invalid workflow definitions", () => {
    const result = translateWorkflowDefinitionToExecutionPlan({
      draft: {
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
      },
    });

    expect(result.success).toBe(false);
    expect(result.plan).toBeUndefined();
    expect(result.validationBoundary.stage).toBe(WorkflowExecutionValidationStages.preTranslation);
    expect(result.validationBoundary.ready).toBe(false);
    expect(result.issues.some((issue) => issue.code === "built-in-step-reference-missing")).toBe(true);
  });
});

