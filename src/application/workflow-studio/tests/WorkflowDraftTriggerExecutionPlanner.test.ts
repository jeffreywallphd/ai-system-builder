import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  WorkflowDraftUserTriggerScopes,
  createEmptyWorkflowDraft,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import { mapWorkflowDraftTriggersToExecutionTriggerPlan } from "../WorkflowDraftTriggerExecutionPlanner";

describe("WorkflowDraftTriggerExecutionPlanner", () => {
  it("maps manual/user trigger definitions into execution trigger semantics", () => {
    const triggers = mapWorkflowDraftTriggersToExecutionTriggerPlan({
      ...createEmptyWorkflowDraft(),
      triggers: [
        {
          id: "trigger-manual",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {
            invocationScope: WorkflowDraftUserTriggerScopes.workflowContinuation,
            continuationStepId: "step-approval",
            continuationTokenRef: "token.approval",
            requiresConfirmation: true,
          },
        },
      ],
    });

    expect(triggers).toEqual([
      expect.objectContaining({
        runtimeKind: "manual",
        executionSemantics: "user-invocation",
        invocationScope: WorkflowDraftUserTriggerScopes.workflowContinuation,
        continuationStepId: "step-approval",
        continuationTokenRef: "token.approval",
        requiresConfirmation: true,
      }),
    ]);
  });

  it("maps temporal and state trigger definitions into structured execution trigger semantics", () => {
    const triggers = mapWorkflowDraftTriggersToExecutionTriggerPlan({
      ...createEmptyWorkflowDraft(),
      triggers: [
        {
          id: "trigger-temporal",
          kind: WorkflowDraftTriggerKinds.temporal,
          type: WorkflowDraftTriggerTypes.temporalSchedule,
          config: {
            cronExpression: "0 8 * * *",
            timezone: "UTC",
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
            eventName: "dataset-updated",
            asset: {
              assetId: "asset:dataset-training",
              versionId: "asset:dataset-training:v2",
            },
            stateKey: "status",
            stateValue: "ready",
            criteria: {
              tenant: "alpha",
            },
          },
        },
      ],
    });

    expect(triggers).toHaveLength(2);
    expect(triggers[0]).toEqual(expect.objectContaining({
      runtimeKind: "temporal",
      executionSemantics: "temporal-schedule",
      scheduleMode: "cron",
      cronExpression: "0 8 * * *",
    }));
    expect(triggers[1]).toEqual(expect.objectContaining({
      runtimeKind: "state",
      executionSemantics: "state-event",
      sourceType: "asset",
      eventCategory: "asset-updated",
      stateKey: "status",
      stateValue: "ready",
    }));
  });

  it("supports deterministic multi-trigger planning output order", () => {
    const draft = {
      ...createEmptyWorkflowDraft(),
      triggers: [
        {
          id: "trigger-1",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        },
        {
          id: "trigger-2",
          kind: WorkflowDraftTriggerKinds.temporal,
          type: WorkflowDraftTriggerTypes.temporalRecurring,
          config: {
            every: 4,
            unit: "hours",
          },
        },
        {
          id: "trigger-3",
          kind: WorkflowDraftTriggerKinds.state,
          type: WorkflowDraftTriggerTypes.stateSystemEvent,
          config: {
            eventName: "runtime-ready",
          },
        },
      ],
    };

    const first = mapWorkflowDraftTriggersToExecutionTriggerPlan(draft);
    const second = mapWorkflowDraftTriggersToExecutionTriggerPlan(draft);

    expect(first.map((entry) => entry.triggerId)).toEqual(["trigger-1", "trigger-2", "trigger-3"]);
    expect(first).toEqual(second);
  });

  it("fails safely when invalid trigger definitions bypass authoring and reach planning", () => {
    expect(() => mapWorkflowDraftTriggersToExecutionTriggerPlan({
      ...createEmptyWorkflowDraft(),
      triggers: [
        {
          id: "trigger-invalid",
          kind: WorkflowDraftTriggerKinds.state,
          type: WorkflowDraftTriggerTypes.stateSystemEvent,
          config: {},
        },
      ],
    })).toThrow("requires config.eventName");
  });
});
