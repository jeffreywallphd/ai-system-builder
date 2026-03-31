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
    expect(result.plan?.executionContext.resolvedRuntimeInputs).toEqual({ prompt: "Run" });
    expect(result.plan?.executionContext.resolvedInputValues).toEqual({ "input-prompt": "Run" });
    expect(result.plan?.executionContext.resolvedInputBindings).toEqual({ "inputs.prompt": "Run" });
    expect(result.plan?.executionContext.resolvedInputs).toEqual([expect.objectContaining({
      inputId: "input-prompt",
      resolutionSource: "runtime-parameter",
      value: "Run",
    })]);
    expect(result.plan?.executionContext.unresolvedInputs).toEqual([]);
    expect(result.plan?.executionContext.selectedAssets.datasets).toEqual([]);
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
    expect(result.plan?.controlFlowMappings).toEqual([]);
    expect(result.plan?.inputBindings).toEqual([expect.objectContaining({
      inputId: "input-prompt",
      sourceType: "runtime-parameter",
      bindingKey: "inputs.prompt",
    })]);
  });

  it("assembles dataset/static/runtime/default inputs into canonical execution context", () => {
    const result = translateWorkflowDefinitionToExecutionPlan({
      context: {
        inputValues: {
          prompt: "Summarize",
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
        inputs: [
          {
            id: "dataset-input",
            type: "dataset-input",
            sourceType: "dataset-asset",
            required: true,
            asset: {
              assetId: "asset:dataset-orders",
              versionId: "asset:dataset-orders:v3",
            },
            format: "jsonl",
            selection: {
              split: "train",
              limit: 1000,
            },
          },
          {
            id: "prompt-input",
            type: "runtime-input",
            sourceType: "runtime-parameter",
            parameterKey: "prompt",
            required: true,
          },
          {
            id: "temperature-input",
            type: "runtime-input",
            sourceType: "runtime-parameter",
            parameterKey: "temperature",
            defaultValue: 0.2,
          },
          {
            id: "mode-input",
            type: "static-input",
            sourceType: "static-value",
            value: "concise",
          },
        ],
        steps: [{
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        }],
      },
    });

    expect(result.success).toBeTrue();
    expect(result.plan?.executionContext.resolvedInputValues).toEqual({
      "dataset-input": {
        assetId: "asset:dataset-orders",
        versionId: "asset:dataset-orders:v3",
        format: "jsonl",
        selection: {
          split: "train",
          limit: 1000,
        },
      },
      "prompt-input": "Summarize",
      "temperature-input": 0.2,
      "mode-input": "concise",
    });
    expect(result.plan?.executionContext.selectedAssets.datasets).toEqual([{
      inputId: "dataset-input",
      assetId: "asset:dataset-orders",
      versionId: "asset:dataset-orders:v3",
      format: "jsonl",
      selection: {
        split: "train",
        limit: 1000,
      },
    }]);
    expect(result.plan?.executionContext.resolvedRuntimeInputs).toEqual({
      prompt: "Summarize",
      temperature: 0.2,
      "dataset-input": {
        assetId: "asset:dataset-orders",
        versionId: "asset:dataset-orders:v3",
        format: "jsonl",
        selection: {
          split: "train",
          limit: 1000,
        },
      },
      "mode-input": "concise",
    });
    expect(result.plan?.executionContext.unresolvedInputs).toEqual([]);
  });

  it("resolves runtime parameters from trigger activation payload when manual inputs are absent", () => {
    const result = translateWorkflowDefinitionToExecutionPlan({
      context: {
        triggerActivation: {
          triggerId: "trigger-state",
          activationType: "state-event",
          payload: {
            query: "customer churn",
          },
        },
        metadata: {
          session: {
            sessionId: "studio-session-1",
            actorId: "user-1",
          },
        },
      },
      draft: {
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-state",
          kind: WorkflowDraftTriggerKinds.state,
          type: WorkflowDraftTriggerTypes.stateSystemEvent,
          config: {
            sourceType: "system",
            eventCategory: "system-state-changed",
            eventName: "workflow-triggered",
          },
        }],
        inputs: [{
          id: "query-input",
          type: "runtime-input",
          sourceType: "runtime-parameter",
          parameterKey: "query",
          required: true,
        }],
        steps: [{
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        }],
      },
    });

    expect(result.success).toBeTrue();
    expect(result.plan?.executionContext.triggerPayload).toEqual({ query: "customer churn" });
    expect(result.plan?.executionContext.sessionContext).toEqual({
      sessionId: "studio-session-1",
      actorId: "user-1",
    });
    expect(result.plan?.executionContext.resolvedInputValues).toEqual({ "query-input": "customer churn" });
    expect(result.plan?.executionContext.resolvedRuntimeInputs).toEqual({ query: "customer churn" });
    expect(result.plan?.executionContext.resolvedInputs).toEqual([expect.objectContaining({
      inputId: "query-input",
      resolutionSource: "trigger-activation",
      value: "customer churn",
    })]);
  });

  it("returns pre-execution translation failures for missing required runtime inputs", () => {
    const result = translateWorkflowDefinitionToExecutionPlan({
      draft: {
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-manual",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        }],
        inputs: [{
          id: "prompt-input",
          type: "runtime-input",
          sourceType: "runtime-parameter",
          parameterKey: "prompt",
          required: true,
        }],
        steps: [{
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        }],
      },
    });

    expect(result.success).toBeFalse();
    expect(result.validationBoundary.stage).toBe(WorkflowExecutionValidationStages.preExecution);
    expect(result.issues).toEqual([expect.objectContaining({
      code: "input-resolution-required-missing",
      severity: "error",
    })]);
  });

  it("blocks translation when trigger activation references a missing trigger id", () => {
    const result = translateWorkflowDefinitionToExecutionPlan({
      context: {
        triggerActivation: {
          triggerId: "trigger-missing",
          sourceKind: "manual-user",
          activationType: "manual",
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
        steps: [{
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        }],
      },
    });

    expect(result.success).toBeFalse();
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "trigger-activation-not-found",
      severity: "error",
    }));
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
            elseStepIds: ["step-fallback"],
          },
        },
        {
          id: "step-final",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 3,
          dependsOnStepIds: ["step-agent"],
        },
        {
          id: "step-fallback",
          type: WorkflowDraftBuiltInStepTypes.loopIteration,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 4,
          config: {
            repeatCount: 3,
            bodyStepIds: ["step-final"],
          },
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
          else: ["step-fallback"],
        },
        conditionalRouteStepIds: ["step-final", "step-fallback"],
      },
    });
    expect(plan.controlFlowMappings).toEqual([
      {
        mappingType: "branch",
        stepId: "step-if",
        conditionKind: "expression",
        thenStepIds: ["step-final"],
        elseStepIds: ["step-fallback"],
      },
      {
        mappingType: "loop",
        stepId: "step-fallback",
        mode: "fixed-count",
        bodyStepIds: ["step-final"],
        maxIterations: 3,
      },
    ]);
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

  it("maps manual approval routing into explicit control-flow execution mappings", () => {
    const plan = mapWorkflowDraftToExecutionPlan({
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
              assetId: "asset:agent-moderator",
            },
          },
        },
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
          order: 3,
        },
        {
          id: "step-rework",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 4,
        },
      ],
    });

    expect(plan.controlFlowMappings).toEqual([{
      mappingType: "manual-routing",
      stepId: "step-manual",
      interactionMode: "approval",
      outcomes: {
        continue: [],
        approve: ["step-publish"],
        reject: ["step-rework"],
      },
    }]);
    expect(plan.elements.find((entry) => entry.stepId === "step-agent")).toEqual(expect.objectContaining({
      elementType: "action-step",
      stepKind: WorkflowDraftStepKinds.assetBacked,
      assetRef: {
        asset: {
          assetId: "asset:agent-moderator",
        },
      },
    }));
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

