import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  createEmptyWorkflowDraft,
  validateWorkflowDraft,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  WorkflowTriggerTypeRegistry,
  createDefaultWorkflowTriggerTypeRegistry,
} from "../WorkflowTriggerTypeRegistry";

describe("WorkflowTriggerTypeRegistry", () => {
  it("enumerates canonical trigger types with stable metadata", () => {
    const registry = createDefaultWorkflowTriggerTypeRegistry();
    const entries = registry.list();

    expect(entries.map((entry) => entry.type)).toEqual([
      WorkflowDraftTriggerTypes.userManual,
      WorkflowDraftTriggerTypes.userButtonClick,
      WorkflowDraftTriggerTypes.userInitiatedRun,
      WorkflowDraftTriggerTypes.temporalSchedule,
      WorkflowDraftTriggerTypes.temporalRecurring,
      WorkflowDraftTriggerTypes.stateDataAvailable,
      WorkflowDraftTriggerTypes.stateAssetStateChanged,
      WorkflowDraftTriggerTypes.stateSystemEvent,
    ]);
    expect(entries.map((entry) => entry.kind)).toEqual([
      WorkflowDraftTriggerKinds.user,
      WorkflowDraftTriggerKinds.user,
      WorkflowDraftTriggerKinds.user,
      WorkflowDraftTriggerKinds.temporal,
      WorkflowDraftTriggerKinds.temporal,
      WorkflowDraftTriggerKinds.state,
      WorkflowDraftTriggerKinds.state,
      WorkflowDraftTriggerKinds.state,
    ]);
    expect(entries.every((entry) => entry.label.trim().length > 0)).toBeTrue();
    expect(entries.every((entry) => entry.description.trim().length > 0)).toBeTrue();
    expect(entries.every((entry) => entry.configSchemaId.startsWith("workflow.trigger."))).toBeTrue();
    expect(entries.every((entry) => entry.validationEntryPoint === "normalizeWorkflowDraftTriggerConfig")).toBeTrue();
  });

  it("supports trigger lookup, support checks, and kind filtering", () => {
    const registry = createDefaultWorkflowTriggerTypeRegistry();

    expect(registry.isSupported(WorkflowDraftTriggerTypes.temporalSchedule)).toBeTrue();
    expect(registry.isSupported("future-trigger")).toBeFalse();
    expect(registry.get("future-trigger")).toBeUndefined();
    expect(registry.get(WorkflowDraftTriggerTypes.stateSystemEvent)?.kind).toBe(WorkflowDraftTriggerKinds.state);
    expect(registry.listByKind(WorkflowDraftTriggerKinds.temporal).map((entry) => entry.type)).toEqual([
      WorkflowDraftTriggerTypes.temporalSchedule,
      WorkflowDraftTriggerTypes.temporalRecurring,
    ]);
  });

  it("creates default trigger configs and validates them through domain entry points", () => {
    const registry = createDefaultWorkflowTriggerTypeRegistry();

    const triggers = registry.list().map((entry, index) => Object.freeze({
      id: `trigger-${index + 1}`,
      kind: entry.kind,
      type: entry.type,
      config: registry.validateConfig(entry.type, registry.createDefaultConfig(entry.type)),
    }));

    const validation = validateWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      triggers,
    });

    expect(validation.valid).toBeTrue();
  });

  it("rejects malformed trigger configs and duplicate registrations", () => {
    const registry = createDefaultWorkflowTriggerTypeRegistry();
    expect(() => registry.validateConfig(WorkflowDraftTriggerTypes.userButtonClick, {})).toThrow("config.buttonId");
    expect(() => registry.validateConfig(WorkflowDraftTriggerTypes.temporalSchedule, {})).toThrow("config.cronExpression");
    expect(() => registry.validateConfig(WorkflowDraftTriggerTypes.temporalRecurring, {
      every: 1,
    })).toThrow("config.every and config.unit");
    expect(() => registry.validateConfig(WorkflowDraftTriggerTypes.stateAssetStateChanged, {
      stateKey: "status",
    })).toThrow("config.asset");
    expect(() => registry.validateConfig(WorkflowDraftTriggerTypes.stateSystemEvent, {
      eventName: " ",
    })).toThrow("config.eventName");

    expect(() => new WorkflowTriggerTypeRegistry([
      {
        kind: WorkflowDraftTriggerKinds.user,
        type: WorkflowDraftTriggerTypes.userManual,
        label: "Manual",
        description: "Manual launch",
        configSchemaId: "workflow.trigger.user.manual.v1",
        capabilities: {
          supportsManualInvocation: true,
          supportsTemporalScheduling: false,
          supportsStateSubscription: false,
        },
        defaultConfig: {},
        validateConfig: () => ({}),
      },
      {
        kind: WorkflowDraftTriggerKinds.user,
        type: WorkflowDraftTriggerTypes.userManual,
        label: "Manual duplicate",
        description: "Manual launch duplicate",
        configSchemaId: "workflow.trigger.user.manual.v1",
        capabilities: {
          supportsManualInvocation: true,
          supportsTemporalScheduling: false,
          supportsStateSubscription: false,
        },
        defaultConfig: {},
        validateConfig: () => ({}),
      },
    ])).toThrow("already registered");
  });
});
