import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  createEmptyWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  addWorkflowTrigger,
  canMoveWorkflowTrigger,
  getWorkflowTriggerValidationMessages,
  getWorkflowTriggerKindLabel,
  moveWorkflowTriggerDown,
  moveWorkflowTriggerUp,
  removeWorkflowTrigger,
  resolveWorkflowTriggerSelectionId,
  setWorkflowTriggerStateConfig,
  setWorkflowTriggerTemporalConfig,
  setWorkflowTriggerUserConfig,
  setWorkflowTriggerType,
  workflowTriggerTypeDefinitions,
} from "../WorkflowWizardTriggers";

describe("WorkflowWizardTriggers", () => {
  it("enumerates supported trigger types from the registry", () => {
    expect(workflowTriggerTypeDefinitions.length).toBeGreaterThan(0);
    expect(workflowTriggerTypeDefinitions.map((entry) => entry.type)).toContain(WorkflowDraftTriggerTypes.userManual);
    expect(workflowTriggerTypeDefinitions.map((entry) => entry.type)).toContain(WorkflowDraftTriggerTypes.temporalSchedule);
    expect(workflowTriggerTypeDefinitions.map((entry) => entry.type)).toContain(WorkflowDraftTriggerTypes.stateSystemEvent);
  });

  it("adds trigger definitions with registry defaults", () => {
    const addedManual = addWorkflowTrigger(createEmptyWorkflowDraft(), {
      type: WorkflowDraftTriggerTypes.userManual,
    }).draft;
    expect(addedManual.triggers[0]).toMatchObject({
      kind: WorkflowDraftTriggerKinds.user,
      type: WorkflowDraftTriggerTypes.userManual,
      config: {
        invocationScope: "workflow-start",
      },
    });

    const addedTemporal = addWorkflowTrigger(addedManual, {
      type: WorkflowDraftTriggerTypes.temporalSchedule,
    }).draft;
    expect(addedTemporal.triggers[1]).toMatchObject({
      kind: WorkflowDraftTriggerKinds.temporal,
      type: WorkflowDraftTriggerTypes.temporalSchedule,
      config: {
        scheduleMode: "cron",
        cronExpression: "0 9 * * *",
      },
    });
  });

  it("switches trigger types and safely removes trigger entries", () => {
    const initial = addWorkflowTrigger(createEmptyWorkflowDraft(), {
      type: WorkflowDraftTriggerTypes.userManual,
    }).draft;
    const triggerId = initial.triggers[0]?.id as string;

    const switched = setWorkflowTriggerType(initial, triggerId, WorkflowDraftTriggerTypes.stateSystemEvent).draft;
    expect(switched.triggers[0]).toMatchObject({
      kind: WorkflowDraftTriggerKinds.state,
      type: WorkflowDraftTriggerTypes.stateSystemEvent,
      config: {
        eventName: "system-event",
      },
    });

    const removed = removeWorkflowTrigger(switched, triggerId);
    expect(removed.changed).toBeTrue();
    expect(removed.draft.triggers).toHaveLength(0);
  });

  it("supports trigger reordering with stable boundaries", () => {
    let draft = createEmptyWorkflowDraft();
    draft = addWorkflowTrigger(draft, { type: WorkflowDraftTriggerTypes.userManual }).draft;
    draft = addWorkflowTrigger(draft, { type: WorkflowDraftTriggerTypes.temporalSchedule }).draft;
    draft = addWorkflowTrigger(draft, { type: WorkflowDraftTriggerTypes.stateSystemEvent }).draft;

    const firstId = draft.triggers[0]?.id as string;
    const secondId = draft.triggers[1]?.id as string;
    const thirdId = draft.triggers[2]?.id as string;

    expect(canMoveWorkflowTrigger(draft, firstId, "up")).toBeFalse();
    expect(canMoveWorkflowTrigger(draft, firstId, "down")).toBeTrue();
    expect(canMoveWorkflowTrigger(draft, thirdId, "down")).toBeFalse();

    draft = moveWorkflowTriggerUp(draft, thirdId).draft;
    expect(draft.triggers.map((trigger) => trigger.id)).toEqual([firstId, thirdId, secondId]);

    draft = moveWorkflowTriggerDown(draft, firstId).draft;
    expect(draft.triggers.map((trigger) => trigger.id)).toEqual([thirdId, firstId, secondId]);
  });

  it("updates type-specific configs through shared trigger helpers", () => {
    const baseDraft = addWorkflowTrigger(createEmptyWorkflowDraft(), {
      type: WorkflowDraftTriggerTypes.userManual,
    }).draft;
    const triggerId = baseDraft.triggers[0]?.id as string;

    const userPatched = setWorkflowTriggerUserConfig(baseDraft, triggerId, {
      invocationScope: "workflow-continuation",
      continuationStepId: "step-1",
      continuationTokenRef: "resume-token",
      allowedRoles: ["reviewer"],
      requiresConfirmation: true,
    }).draft;
    expect(userPatched.triggers[0]?.config).toEqual(expect.objectContaining({
      invocationScope: "workflow-continuation",
      continuationStepId: "step-1",
      continuationTokenRef: "resume-token",
      allowedRoles: ["reviewer"],
      requiresConfirmation: true,
    }));

    const temporalDraft = setWorkflowTriggerType(
      userPatched,
      triggerId,
      WorkflowDraftTriggerTypes.temporalRecurring,
    ).draft;
    const temporalPatched = setWorkflowTriggerTemporalConfig(temporalDraft, triggerId, {
      every: 6,
      unit: "hours",
      timezone: "America/New_York",
      startAt: "2026-03-01T00:00:00.000Z",
    }).draft;
    expect(temporalPatched.triggers[0]?.config).toEqual(expect.objectContaining({
      every: 6,
      unit: "hours",
      timezone: "America/New_York",
      startAt: "2026-03-01T00:00:00.000Z",
    }));

    const stateDraft = setWorkflowTriggerType(
      temporalPatched,
      triggerId,
      WorkflowDraftTriggerTypes.stateAssetStateChanged,
    ).draft;
    const statePatched = setWorkflowTriggerStateConfig(stateDraft, triggerId, {
      eventName: "asset-ready",
      stateKey: "status",
      stateValue: "ready",
      asset: {
        assetId: "asset:trigger-source",
      },
    }).draft;
    expect(statePatched.triggers[0]?.config).toEqual(expect.objectContaining({
      eventName: "asset-ready",
      stateKey: "status",
      stateValue: "ready",
      asset: {
        assetId: "asset:trigger-source",
      },
    }));
  });

  it("returns shared validation messages for invalid trigger configs", () => {
    const draft = addWorkflowTrigger(createEmptyWorkflowDraft(), {
      type: WorkflowDraftTriggerTypes.temporalSchedule,
    }).draft;
    const trigger = draft.triggers[0];
    if (!trigger) {
      throw new Error("Expected trigger.");
    }

    const messages = getWorkflowTriggerValidationMessages({
      trigger: {
        ...trigger,
        config: {
          ...trigger.config,
          runAt: "not-a-date",
          cronExpression: undefined,
        },
      },
      draftIssueMessages: ["Existing draft issue"],
    });
    expect(messages).toContain("Existing draft issue");
    expect(messages.some((message) => message.includes("config.runAt must be a valid timestamp"))).toBeTrue();
  });

  it("resolves selected trigger id safely after trigger removals", () => {
    let draft = createEmptyWorkflowDraft();
    draft = addWorkflowTrigger(draft, { type: WorkflowDraftTriggerTypes.userManual }).draft;
    draft = addWorkflowTrigger(draft, { type: WorkflowDraftTriggerTypes.temporalSchedule }).draft;
    const firstId = draft.triggers[0]?.id as string;
    const secondId = draft.triggers[1]?.id as string;

    expect(resolveWorkflowTriggerSelectionId(draft, secondId)).toBe(secondId);

    const removed = removeWorkflowTrigger(draft, secondId).draft;
    expect(resolveWorkflowTriggerSelectionId(removed, secondId)).toBe(firstId);

    const empty = removeWorkflowTrigger(removed, firstId).draft;
    expect(resolveWorkflowTriggerSelectionId(empty, secondId)).toBeUndefined();
  });

  it("provides stable trigger-kind labels", () => {
    expect(getWorkflowTriggerKindLabel(WorkflowDraftTriggerKinds.user)).toBe("User");
    expect(getWorkflowTriggerKindLabel(WorkflowDraftTriggerKinds.temporal)).toBe("Temporal");
    expect(getWorkflowTriggerKindLabel(WorkflowDraftTriggerKinds.state)).toBe("State");
  });
});
