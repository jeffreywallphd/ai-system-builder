import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftTemporalScheduleModes,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  WorkflowDraftUserTriggerScopes,
  WorkflowValidationIssueCodes,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  validateSingleWorkflowTriggerDefinition,
  validateWorkflowTriggerDefinitions,
} from "../WorkflowTriggerValidationPipeline";

describe("WorkflowTriggerValidationPipeline", () => {
  it("validates trigger definitions across user, temporal, and state types", () => {
    const result = validateWorkflowTriggerDefinitions({
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
            scheduleMode: WorkflowDraftTemporalScheduleModes.cron,
            cronExpression: "0 9 * * *",
          },
        },
        {
          id: "trigger-state",
          kind: WorkflowDraftTriggerKinds.state,
          type: WorkflowDraftTriggerTypes.stateAssetStateChanged,
          config: {
            sourceType: "asset",
            eventCategory: "asset-updated",
            subject: "dataset",
            asset: {
              assetId: "asset:dataset-customers",
            },
            stateKey: "status",
            stateValue: "ready",
          },
        },
      ],
    });

    expect(result.valid).toBeTrue();
    expect(result.issues).toEqual([]);
    expect(result.normalizedTriggers.map((entry) => entry.type)).toEqual([
      WorkflowDraftTriggerTypes.userManual,
      WorkflowDraftTriggerTypes.temporalSchedule,
      WorkflowDraftTriggerTypes.stateAssetStateChanged,
    ]);
    expect(result.normalizedTriggers[2]?.config).toMatchObject({
      sourceType: "asset",
      eventCategory: "asset-updated",
      subject: "dataset",
      asset: {
        assetId: "asset:dataset-customers",
      },
      stateKey: "status",
      stateValue: "ready",
    });
  });

  it("fails safely for malformed state trigger configuration", () => {
    const result = validateSingleWorkflowTriggerDefinition({
      trigger: {
        id: "trigger-state-invalid",
        kind: WorkflowDraftTriggerKinds.state,
        type: WorkflowDraftTriggerTypes.stateAssetStateChanged,
        config: {
          sourceType: "asset",
          stateKey: "status",
        },
      },
    });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.triggerMalformed)).toBeTrue();
    expect(result.issues.some((issue) => issue.message.includes("requires config.asset"))).toBeTrue();
  });

  it("applies workflow-level trigger validation for duplicates and continuation references", () => {
    const result = validateWorkflowTriggerDefinitions({
      triggers: [
        {
          id: "trigger-dup",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        },
        {
          id: "trigger-dup",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        },
        {
          id: "trigger-continuation",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {
            invocationScope: WorkflowDraftUserTriggerScopes.workflowContinuation,
            continuationStepId: "step-missing",
          },
        },
      ],
      stepIds: ["step-1"],
    });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.triggerDuplicateId)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.triggerDuplicateDefinition)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === WorkflowValidationIssueCodes.triggerContinuationStepMissing)).toBeTrue();
  });

  it("supports workflow-level minimum trigger requirements when requested", () => {
    const result = validateWorkflowTriggerDefinitions({
      triggers: [],
      requireAtLeastOneTrigger: true,
    });

    expect(result.valid).toBeFalse();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe(WorkflowValidationIssueCodes.triggerCollectionEmpty);
  });
});
