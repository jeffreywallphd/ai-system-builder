import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  WorkflowDraftStepKinds,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  createEmptyWorkflowDraft,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import { validateWorkflowForExecutionReadiness } from "../WorkflowPreExecutionValidationPipeline";

describe("WorkflowPreExecutionValidationPipeline", () => {
  it("collects incomplete workflow readiness issues", async () => {
    const result = await validateWorkflowForExecutionReadiness({
      draft: createEmptyWorkflowDraft(),
    });

    expect(result.ready).toBeFalse();
    expect(result.blockingIssues.length).toBeGreaterThan(0);
    expect(result.issues.some((issue) => issue.code === "trigger-collection-empty")).toBeTrue();
  });

  it("flags invalid/missing asset version references before execution", async () => {
    const result = await validateWorkflowForExecutionReadiness({
      draft: {
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-manual",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        }],
        inputs: [{
          id: "input-dataset",
          type: "dataset",
          sourceType: "dataset-asset",
          asset: {
            assetId: "asset:dataset-customers",
            versionId: "asset:dataset-customers:v404",
          },
        }],
        steps: [{
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        }],
      },
      assetReferenceResolver: {
        hasAssetVersionReference: async () => false,
      },
    });

    expect(result.ready).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "asset-version-reference-missing")).toBeTrue();
  });

  it("surfaces incompatible trigger configuration issues", async () => {
    const result = await validateWorkflowForExecutionReadiness({
      draft: {
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-temporal",
          kind: WorkflowDraftTriggerKinds.temporal,
          type: WorkflowDraftTriggerTypes.temporalSchedule,
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

    expect(result.ready).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "trigger-malformed")).toBeTrue();
  });

  it("surfaces invalid input binding issues", async () => {
    const result = await validateWorkflowForExecutionReadiness({
      draft: {
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-manual",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        }],
        inputs: [{
          id: "input-runtime",
          type: "runtime-input",
          sourceType: "runtime-parameter",
        } as any],
        steps: [{
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        }],
      },
    });

    expect(result.ready).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "input-malformed")).toBeTrue();
  });

  it("surfaces invalid output definition issues", async () => {
    const result = await validateWorkflowForExecutionReadiness({
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
        outputs: [{
          id: "output-unsupported",
          type: "workflow-output",
          order: 1,
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.json,
          destination: {
            type: "unsupported-output-type",
            target: "unsupported",
          },
        }],
      },
    });

    expect(result.ready).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "output-plan-unsupported-type")).toBeTrue();
  });

  it("surfaces invalid step sequencing/control-flow issues", async () => {
    const result = await validateWorkflowForExecutionReadiness({
      draft: {
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-manual",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        }],
        steps: [
          {
            id: "step-manual",
            type: "manual-approval",
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
      },
    });

    expect(result.ready).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "built-in-step-reference-order-invalid")).toBeTrue();
  });

  it("passes readiness checks and provides a translated plan for valid workflows", async () => {
    const result = await validateWorkflowForExecutionReadiness({
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
        outputs: [{
          id: "output-viewer",
          type: "workflow-output",
          order: 1,
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.json,
          sourceStepId: "step-1",
          destination: {
            type: WorkflowDraftOutputDestinationTypes.webViewer,
            target: "preview",
            options: {
              title: "Preview",
            },
          },
        }],
      },
    });

    expect(result.ready).toBeTrue();
    expect(result.blockingIssues).toHaveLength(0);
    expect(result.plan?.orderedStepIds).toEqual(["step-1"]);
  });

  it("surfaces unresolved optional runtime inputs as non-blocking pre-execution warnings", async () => {
    const result = await validateWorkflowForExecutionReadiness({
      draft: {
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-manual",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        }],
        inputs: [{
          id: "input-optional",
          type: "runtime-input",
          sourceType: "runtime-parameter",
          parameterKey: "optionalPrompt",
          required: false,
        }],
        steps: [{
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
        }],
      },
    });

    expect(result.ready).toBeTrue();
    expect(result.warningIssues.some((issue) => issue.code === "input-resolution-optional-unresolved")).toBeTrue();
    expect(result.plan?.executionContext.unresolvedInputs).toEqual([expect.objectContaining({
      inputId: "input-optional",
      required: false,
    })]);
  });
});
