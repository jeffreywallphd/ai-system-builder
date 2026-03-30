import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  createEmptyWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  addWorkflowTrigger,
  getWorkflowTriggerKindLabel,
  removeWorkflowTrigger,
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

  it("provides stable trigger-kind labels", () => {
    expect(getWorkflowTriggerKindLabel(WorkflowDraftTriggerKinds.user)).toBe("User");
    expect(getWorkflowTriggerKindLabel(WorkflowDraftTriggerKinds.temporal)).toBe("Temporal");
    expect(getWorkflowTriggerKindLabel(WorkflowDraftTriggerKinds.state)).toBe("State");
  });
});
