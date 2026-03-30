import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftTriggerKinds,
  WorkflowDraftTemporalScheduleModes,
  WorkflowDraftTriggerTypes,
  WorkflowDraftUserTriggerScopes,
  createEmptyWorkflowDraft,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  inferWorkflowDraftTriggerRuntimeReadiness,
  mapWorkflowDraftTriggerToRuntimeDescriptor,
  mapWorkflowDraftTriggersToRuntimeDescriptors,
} from "../WorkflowTriggerRuntimeMapper";

describe("WorkflowTriggerRuntimeMapper", () => {
  it("maps manual triggers with continuation-ready semantics", () => {
    const descriptor = mapWorkflowDraftTriggerToRuntimeDescriptor({
      id: "trigger-manual-1",
      kind: WorkflowDraftTriggerKinds.user,
      type: WorkflowDraftTriggerTypes.userManual,
      title: "Manual continuation",
      config: {
        invocationScope: WorkflowDraftUserTriggerScopes.workflowContinuation,
        continuationStepId: "step-approval",
        continuationTokenRef: "token.review",
        allowedRoles: ["reviewer"],
      },
    });

    expect(descriptor.runtimeKind).toBe("manual");
    expect(descriptor.triggerType).toBe(WorkflowDraftTriggerTypes.userManual);
    expect(descriptor).toMatchObject({
      invocationScope: WorkflowDraftUserTriggerScopes.workflowContinuation,
      continuationStepId: "step-approval",
      continuationTokenRef: "token.review",
      allowedRoles: ["reviewer"],
    });
  });

  it("maps temporal schedule triggers for one-time and recurring readiness", () => {
    const oneTime = mapWorkflowDraftTriggerToRuntimeDescriptor({
      id: "trigger-temporal-once",
      kind: WorkflowDraftTriggerKinds.temporal,
      type: WorkflowDraftTriggerTypes.temporalSchedule,
      config: {
        scheduleMode: WorkflowDraftTemporalScheduleModes.oneTime,
        runAt: "2026-04-15T13:00:00.000Z",
        timezone: "UTC",
      },
    });
    const recurring = mapWorkflowDraftTriggerToRuntimeDescriptor({
      id: "trigger-temporal-recurring",
      kind: WorkflowDraftTriggerKinds.temporal,
      type: WorkflowDraftTriggerTypes.temporalRecurring,
      config: {
        scheduleMode: WorkflowDraftTemporalScheduleModes.interval,
        every: 2,
        unit: "hours",
        timezone: "UTC",
      },
    });

    expect(oneTime.runtimeKind).toBe("temporal");
    expect(oneTime).toMatchObject({
      scheduleMode: WorkflowDraftTemporalScheduleModes.oneTime,
      runAt: "2026-04-15T13:00:00.000Z",
    });
    expect(recurring.runtimeKind).toBe("temporal");
    expect(recurring).toMatchObject({
      scheduleMode: WorkflowDraftTemporalScheduleModes.interval,
      every: 2,
      unit: "hours",
    });
  });

  it("projects canonical workflow draft triggers into runtime descriptors", () => {
    const draft = {
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
            timezone: "UTC",
          },
        },
      ],
    };

    const descriptors = mapWorkflowDraftTriggersToRuntimeDescriptors(draft);
    expect(descriptors).toHaveLength(2);
    expect(descriptors[0]).toMatchObject({
      runtimeKind: "manual",
      triggerId: "trigger-manual",
    });
    expect(descriptors[1]).toMatchObject({
      runtimeKind: "temporal",
      triggerId: "trigger-temporal",
      scheduleMode: WorkflowDraftTemporalScheduleModes.cron,
    });
    expect(inferWorkflowDraftTriggerRuntimeReadiness(draft)).toEqual({
      ready: true,
      reason: "ready",
    });
  });

  it("maps state triggers with source/category/criteria metadata", () => {
    const descriptor = mapWorkflowDraftTriggerToRuntimeDescriptor({
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
          versionId: "asset:dataset-training:v3",
        },
        stateKey: "status",
        stateValue: "ready",
        criteria: {
          tenant: "alpha",
        },
      },
    });

    expect(descriptor.runtimeKind).toBe("state");
    expect(descriptor).toMatchObject({
      sourceType: "asset",
      eventCategory: "asset-updated",
      subject: "dataset",
      eventName: "dataset-updated",
      assetId: "asset:dataset-training",
      assetVersionId: "asset:dataset-training:v3",
      stateKey: "status",
      stateValue: "ready",
      criteria: {
        tenant: "alpha",
      },
      filter: {
        tenant: "alpha",
      },
    });
  });

  it("fails safely when trigger config cannot map to runtime descriptor", () => {
    expect(() => mapWorkflowDraftTriggerToRuntimeDescriptor({
      id: "trigger-invalid",
      kind: WorkflowDraftTriggerKinds.temporal,
      type: WorkflowDraftTriggerTypes.temporalSchedule,
      config: {
        cronExpression: "* *",
      },
    })).toThrow("five-field cron expression");
  });
});
