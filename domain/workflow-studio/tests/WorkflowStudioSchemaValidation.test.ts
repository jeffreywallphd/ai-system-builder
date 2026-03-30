import { describe, expect, it } from "bun:test";
import {
  createWorkflowEntity,
  deserializeWorkflowDraftDocument,
  deserializeWorkflowEntity,
  isWorkflowLifecycleTransitionAllowed,
  serializeWorkflowDraftDocument,
  serializeWorkflowEntity,
  transitionWorkflowEntityLifecycle,
  validateWorkflowDraft,
  validateWorkflowEntity,
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftInputSourceTypes,
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  WorkflowDraftStepAssetKinds,
  WorkflowDraftStepKinds,
  WorkflowDraftStepTypes,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  WorkflowLifecycleStates,
  WorkflowValidationIssueCodes,
} from "../WorkflowStudioDomain";

describe("WorkflowStudioDomain schema validation coverage", () => {
  it("validates a representative canonical workflow across triggers, inputs, mixed steps, outputs, lifecycle, and serialization", () => {
    const entity = createWorkflowEntity({
      id: "workflow-schema-1",
      name: "Canonical Workflow Schema",
      lifecycleState: WorkflowLifecycleStates.saved,
      draft: {
        triggers: [
          {
            id: "trigger-manual",
            kind: WorkflowDraftTriggerKinds.user,
            type: WorkflowDraftTriggerTypes.userManual,
            config: {},
          },
          {
            id: "trigger-recurring",
            kind: WorkflowDraftTriggerKinds.temporal,
            type: WorkflowDraftTriggerTypes.temporalRecurring,
            config: { every: 2, unit: "hours" },
          },
        ],
        inputs: [
          {
            id: "input-dataset",
            type: "dataset",
            sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
            asset: { assetId: "asset:dataset-customers", versionId: "asset:dataset-customers:v3" },
          },
          {
            id: "input-threshold",
            type: "parameter",
            sourceType: WorkflowDraftInputSourceTypes.runtimeParameter,
            parameterKey: "scoreThreshold",
            defaultValue: 0.7,
          },
        ],
        steps: [
          { id: "step-load", type: "load", kind: WorkflowDraftStepKinds.action, order: 1 },
          {
            id: "step-agent",
            type: WorkflowDraftStepTypes.agentAssistant,
            kind: WorkflowDraftStepKinds.assetBacked,
            order: 2,
            dependsOnStepIds: ["step-load"],
            assetRef: {
              assetKind: WorkflowDraftStepAssetKinds.agentAssistant,
              asset: { assetId: "asset:assistant-reviewer", versionId: "asset:assistant-reviewer:v2" },
            },
          },
          {
            id: "step-branch",
            type: WorkflowDraftBuiltInStepTypes.ifThen,
            kind: WorkflowDraftStepKinds.controlFlow,
            order: 3,
            dependsOnStepIds: ["step-agent"],
            config: {
              condition: {
                kind: "expression",
                expression: "score > 0.7",
              },
              branches: {
                then: {
                  label: "publish",
                },
                else: {
                  label: "rework",
                },
              },
            },
          },
          { id: "step-publish", type: "publish", kind: WorkflowDraftStepKinds.action, order: 4 },
          { id: "step-rework", type: "rework", kind: WorkflowDraftStepKinds.action, order: 5 },
          {
            id: "step-approval",
            type: WorkflowDraftBuiltInStepTypes.manualApproval,
            kind: WorkflowDraftStepKinds.controlFlow,
            order: 6,
            dependsOnStepIds: ["step-branch"],
            config: {
              approvalMessage: "Final publication review",
              onTimeout: "reject",
            },
          },
        ],
        outputs: [
          {
            id: "output-file",
            type: "workflow-output",
            outputType: WorkflowDraftOutputTypes.document,
            format: WorkflowDraftOutputFormats.json,
            sourceStepId: "step-publish",
            destination: {
              type: WorkflowDraftOutputDestinationTypes.fileExport,
              target: "/exports/workflow.json",
            },
          },
          {
            id: "output-system",
            type: "workflow-output",
            outputType: WorkflowDraftOutputTypes.record,
            format: WorkflowDraftOutputFormats.json,
            sourceStepId: "step-rework",
            destination: {
              type: WorkflowDraftOutputDestinationTypes.systemEntry,
              target: "ops/review-queue",
              options: {
                entityName: "review-queue-record",
              },
            },
          },
        ],
      },
      now: new Date("2026-03-29T20:00:00.000Z"),
    });

    expect(validateWorkflowDraft(entity.draft).valid).toBeTrue();
    expect(validateWorkflowEntity(entity).valid).toBeTrue();

    const executable = transitionWorkflowEntityLifecycle(
      entity,
      WorkflowLifecycleStates.executable,
      new Date("2026-03-29T20:01:00.000Z"),
    );
    expect(executable.lifecycleState).toBe(WorkflowLifecycleStates.executable);

    const serializedDraft = serializeWorkflowDraftDocument(entity.draft);
    const serializedEntity = serializeWorkflowEntity(executable);
    expect(deserializeWorkflowDraftDocument(serializedDraft)).toEqual(entity.draft);
    expect(deserializeWorkflowEntity(serializedEntity)).toEqual(executable);
  });

  it("returns draft-section-missing issues for partially complete drafts", () => {
    const result = validateWorkflowDraft({
      triggers: undefined,
      inputs: undefined,
      steps: undefined,
      outputs: undefined,
    } as never);

    expect(result.valid).toBeFalse();
    expect(result.issues.map((issue) => issue.code)).toContain(WorkflowValidationIssueCodes.draftSectionMissing);
    expect(result.issues.filter((issue) => issue.code === WorkflowValidationIssueCodes.draftSectionMissing)).toHaveLength(4);
  });

  it("returns deterministic cross-section issue codes for malformed references and dependency conflicts", () => {
    const result = validateWorkflowDraft({
      triggers: [],
      inputs: [
        {
          id: "input-records",
          type: "dataset",
          sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
          asset: { assetId: "asset:dataset-records" },
        },
      ],
      steps: [
        {
          id: "step-self-dependent",
          type: "process",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
          dependsOnStepIds: ["step-self-dependent", "step-missing"],
        },
        {
          id: "step-loop",
          type: WorkflowDraftBuiltInStepTypes.loopIteration,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 2,
          config: {
            mode: "collection",
            collection: {
              inputKey: "input-missing",
            },
            bodyStepIds: ["step-loop", "step-not-found"],
          },
        },
        {
          id: "step-if",
          type: WorkflowDraftBuiltInStepTypes.ifThen,
          kind: WorkflowDraftStepKinds.controlFlow,
          order: 3,
          config: {
            condition: {
              kind: "expression",
              expression: "x > 0",
            },
            branches: {
              then: {
                stepIds: ["step-if", "step-not-found"],
              },
            },
          },
        },
      ],
      outputs: [
        {
          id: "output-invalid-ref",
          type: "workflow-output",
          outputType: WorkflowDraftOutputTypes.record,
          format: WorkflowDraftOutputFormats.json,
          sourceStepId: "step-unknown",
          destination: {
            type: WorkflowDraftOutputDestinationTypes.systemEntry,
            target: "records/out",
            options: {
              entityName: "records-out",
            },
          },
        },
      ],
    });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.stepDependencySelf)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.stepDependencyMissing)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.builtInStepReferenceSelf)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.builtInStepReferenceMissing)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.loopCollectionInputMissing)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.outputSourceStepMissing)).toBeTrue();
  });

  it("rejects invalid entity foundations and lifecycle transitions", () => {
    const validEntity = createWorkflowEntity({
      id: "workflow-lifecycle-check",
      name: "Lifecycle Check",
      lifecycleState: WorkflowLifecycleStates.saved,
      draft: {
        triggers: [],
        inputs: [],
        steps: [{ id: "step-1", type: "action", kind: WorkflowDraftStepKinds.action, order: 1 }],
        outputs: [],
      },
      now: new Date("2026-03-29T21:00:00.000Z"),
    });

    const invalidEntity = Object.freeze({
      ...validEntity,
      draftRevision: 0,
      createdAt: "not-a-timestamp",
      updatedAt: "also-not-a-timestamp",
      lifecycleState: "invalid-state",
    });

    const validation = validateWorkflowEntity(invalidEntity as never);
    expect(validation.valid).toBeFalse();
    expect(validation.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.entityDraftRevisionInvalid)).toBeTrue();
    expect(validation.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.entityCreatedAtInvalid)).toBeTrue();
    expect(validation.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.entityUpdatedAtInvalid)).toBeTrue();
    expect(validation.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.lifecycleStateInvalid)).toBeTrue();

    expect(isWorkflowLifecycleTransitionAllowed(WorkflowLifecycleStates.draft, WorkflowLifecycleStates.executable)).toBeFalse();
    const draftEntity = Object.freeze({
      ...validEntity,
      lifecycleState: WorkflowLifecycleStates.draft,
    });
    expect(() => transitionWorkflowEntityLifecycle(draftEntity, WorkflowLifecycleStates.executable)).toThrow();
  });

  it("rejects unsupported workflow draft document schema versions", () => {
    const unsupported = JSON.stringify({
      schemaVersion: "ai-loom.workflow-draft.v99",
      draft: {
        triggers: [],
        inputs: [],
        steps: [],
        outputs: [],
      },
    });

    expect(() => deserializeWorkflowDraftDocument(unsupported)).toThrow("schema version");
  });

  it("returns taxonomy-specific validation issue codes for dataset inputs and agent-assistant step refs", () => {
    const result = validateWorkflowDraft({
      triggers: [],
      inputs: [
        {
          id: "input-dataset",
          type: "dataset",
          sourceType: WorkflowDraftInputSourceTypes.datasetAsset,
          asset: {
            assetId: "asset:dataset-customers",
            taxonomy: {
              structuralKind: "atomic",
              semanticRole: "tool",
              behaviorKind: "deterministic",
            },
          },
        },
      ],
      steps: [
        {
          id: "step-agent",
          type: WorkflowDraftStepTypes.agentAssistant,
          kind: WorkflowDraftStepKinds.assetBacked,
          order: 1,
          assetRef: {
            assetKind: WorkflowDraftStepAssetKinds.agentAssistant,
            asset: {
              assetId: "asset:assistant-reviewer",
              taxonomy: {
                structuralKind: "atomic",
                semanticRole: "dataset",
                behaviorKind: "none",
              },
            },
          },
        },
      ],
      outputs: [],
    });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.inputDatasetAssetTaxonomyMismatch)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.stepAssetTaxonomyMismatch)).toBeTrue();
  });
});
