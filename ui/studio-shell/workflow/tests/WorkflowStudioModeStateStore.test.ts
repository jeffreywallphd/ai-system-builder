import { beforeEach, describe, expect, it } from "bun:test";
import {
  createEmptyWorkflowDraft,
  deserializeWorkflowDraft,
  serializeWorkflowDraft,
  WorkflowValidationIssueCodes,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  clearWorkflowStudioModeStateStoresForTests,
  getWorkflowStudioModeStateStore,
  WorkflowStudioModeStateStore,
} from "../WorkflowStudioModeStateStore";
import { DEFAULT_WORKFLOW_STUDIO_MODE_ID, WorkflowStudioModeIds } from "../WorkflowStudioModes";
import {
  WorkflowStudioHandoffFlowKinds,
  WorkflowStudioHandoffStatusKinds,
} from "../WorkflowStudioHandoffStatus";

function createMemoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const values = new Map<string, string>();
  return Object.freeze({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  });
}

describe("WorkflowStudioModeStateStore", () => {
  beforeEach(() => {
    clearWorkflowStudioModeStateStoresForTests();
  });

  it("tracks selected mode centrally and allows deterministic mode switching", () => {
    const store = new WorkflowStudioModeStateStore();
    expect(store.getState().selectedModeId).toBe(DEFAULT_WORKFLOW_STUDIO_MODE_ID);

    store.setSelectedMode(WorkflowStudioModeIds.wizard);

    expect(store.getState().selectedModeId).toBe(WorkflowStudioModeIds.wizard);
    expect(store.getState().selectedMode.id).toBe(WorkflowStudioModeIds.wizard);
  });

  it("stores one shared workflow draft across mode switches without per-mode duplication", () => {
    const store = new WorkflowStudioModeStateStore();
    const sharedDraft = createEmptyWorkflowDraft();
    const withStep = deserializeWorkflowDraft(serializeWorkflowDraft({
      ...sharedDraft,
      steps: [
        {
          id: "step-1",
          type: "agent-assistant",
          order: 1,
          kind: "asset-backed",
          title: "Assistant step",
          assetRef: {
            assetKind: "agent-assistant",
            asset: {
              assetId: "asset:assistant",
            },
          },
        },
      ],
    }));

    store.replaceSharedDraft(withStep);
    const serializedBeforeModeSwitch = store.getState().sharedDraftSerialized;

    store.setSelectedMode(WorkflowStudioModeIds.wizard);
    store.setSelectedMode(WorkflowStudioModeIds.canvas);

    expect(store.getState().sharedDraftSerialized).toBe(serializedBeforeModeSwitch);
    expect(store.getState().sharedDraft.steps.map((step) => step.id)).toEqual(["step-1"]);
  });

  it("supports shared canonical draft updates from either mode without shadow copies", () => {
    const store = new WorkflowStudioModeStateStore();

    store.setSelectedMode(WorkflowStudioModeIds.wizard);
    store.updateSharedDraft((draft) => ({
      ...draft,
      triggers: [
        ...draft.triggers,
        {
          id: "trigger-1",
          kind: "user",
          type: "manual",
          config: {},
        },
      ],
      inputs: [
        ...draft.inputs,
        {
          id: "input-1",
          type: "runtime-parameter",
          sourceType: "runtime-parameter",
          parameterKey: "input-1",
          valueType: "string",
        },
      ],
    }));

    store.setSelectedMode(WorkflowStudioModeIds.canvas);
    const wizardEditedDraft = store.getState().sharedDraft;

    store.hydrateFromSerializedDraft(serializeWorkflowDraft({
      ...wizardEditedDraft,
      steps: [
        {
          id: "step-1",
          type: "action",
          kind: "action",
          order: 1,
          title: "Step 1",
        },
      ],
      outputs: [
        {
          id: "output-1",
          type: "result",
          title: "Preview output",
          outputType: "document",
          format: "json",
          destination: {
            type: "web-viewer",
            target: "preview",
          },
        },
      ],
    }));

    store.setSelectedMode(WorkflowStudioModeIds.wizard);
    expect(store.getState().sharedDraft.triggers.map((entry) => entry.id)).toEqual(["trigger-1"]);
    expect(store.getState().sharedDraft.inputs.map((entry) => entry.id)).toEqual(["input-1"]);
    expect(store.getState().sharedDraft.steps.map((entry) => entry.id)).toEqual(["step-1"]);
    expect(store.getState().sharedDraft.outputs.map((entry) => entry.id)).toEqual(["output-1"]);
  });

  it("hydrates shared draft from canonical serialized content and preserves previous draft on parse failures", () => {
    const store = new WorkflowStudioModeStateStore();
    const baselineSerialized = store.getState().sharedDraftSerialized;

    const draft = createEmptyWorkflowDraft();
    const serialized = serializeWorkflowDraft({
      ...draft,
      outputs: [
        {
          id: "out-1",
          type: "result",
          title: "Preview output",
          outputType: "document",
          format: "json",
          destination: {
            type: "web-viewer",
            target: "preview",
          },
        },
      ],
    });
    store.hydrateFromSerializedDraft(serialized);

    expect(store.getState().draftParseError).toBeUndefined();
    expect(store.getState().sharedDraft.outputs.map((entry) => entry.id)).toEqual(["out-1"]);

    store.hydrateFromSerializedDraft("not-json");

    expect(store.getState().draftParseError).toBeDefined();
    expect(store.getState().draftEditorContent).toBe("not-json");
    expect(store.getState().sharedDraftSerialized).not.toBe(baselineSerialized);
    expect(store.getState().sharedDraft.outputs.map((entry) => entry.id)).toEqual(["out-1"]);
  });

  it("handles malformed trigger payloads safely during snapshot synchronization", () => {
    const store = new WorkflowStudioModeStateStore();
    store.hydrateFromSerializedDraft(serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      triggers: [{
        id: "trigger-safe",
        kind: "user",
        type: "manual",
        config: {},
      }],
    }));

    const previousSerialized = store.getState().sharedDraftSerialized;
    const malformedTriggerPayload = JSON.stringify({
      triggers: [{
        id: "trigger-bad",
        kind: "state",
        type: "asset-state-changed",
        config: {
          stateKey: "status",
        },
      }],
      inputs: [],
      steps: [],
      outputs: [],
    });

    store.synchronizeSharedDraftFromSnapshot({
      serializedDraft: malformedTriggerPayload,
      context: {
        studioId: "workflow-studio",
        sessionId: "session-1",
        draftId: "draft-1",
        revision: 1,
      },
    });

    expect(store.getState().draftParseError).toBeDefined();
    expect(store.getState().sharedDraftSerialized).toBe(previousSerialized);
    expect(store.getState().sharedDraft.triggers.map((trigger) => trigger.id)).toEqual(["trigger-safe"]);
  });

  it("preserves local draft edits across same-session mode-route snapshot refreshes", () => {
    const store = new WorkflowStudioModeStateStore();
    const serverDraft = serializeWorkflowDraft(createEmptyWorkflowDraft());

    store.synchronizeSharedDraftFromSnapshot({
      serializedDraft: serverDraft,
      context: {
        studioId: "workflow-studio",
        sessionId: "session-1",
        draftId: "draft-1",
        revision: 1,
      },
    });

    store.hydrateFromSerializedDraft(serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "local-step",
          type: "action",
          kind: "action",
          order: 1,
          title: "Unsaved local step",
        },
      ],
    }));

    store.synchronizeSharedDraftFromSnapshot({
      serializedDraft: serverDraft,
      context: {
        studioId: "workflow-studio",
        sessionId: "session-1",
        draftId: "draft-1",
        revision: 1,
      },
    });

    expect(store.getState().sharedDraft.steps.map((step) => step.id)).toEqual(["local-step"]);
  });

  it("re-hydrates from backend draft when draft session identity changes", () => {
    const store = new WorkflowStudioModeStateStore();

    store.hydrateFromSerializedDraft(serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      outputs: [
        {
          id: "local-output",
          type: "result",
          title: "Preview output",
          outputType: "document",
          format: "json",
          destination: {
            type: "web-viewer",
            target: "preview",
          },
        },
      ],
    }));

    const serverDraft = serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "server-step",
          type: "action",
          kind: "action",
          order: 1,
          title: "Server step",
        },
      ],
    });

    store.synchronizeSharedDraftFromSnapshot({
      serializedDraft: serverDraft,
      context: {
        studioId: "workflow-studio",
        sessionId: "session-2",
        draftId: "draft-2",
        revision: 1,
      },
    });

    expect(store.getState().sharedDraft.steps.map((step) => step.id)).toEqual(["server-step"]);
    expect(store.getState().sharedDraft.outputs).toHaveLength(0);
    expect(store.getState().hasLocalDraftEdits).toBe(false);
  });

  it("reuses one workflow mode store instance per studio id across route transitions", () => {
    const first = getWorkflowStudioModeStateStore("workflow-studio");
    first.setSelectedMode(WorkflowStudioModeIds.wizard);
    first.hydrateFromSerializedDraft(serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      triggers: [
        {
          id: "trigger-persisted",
          kind: "user",
          type: "manual",
          config: {},
        },
      ],
    }));

    const second = getWorkflowStudioModeStateStore("workflow-studio");

    expect(second).toBe(first);
    expect(second.getState().selectedModeId).toBe(WorkflowStudioModeIds.wizard);
    expect(second.getState().sharedDraft.triggers.map((trigger) => trigger.id)).toEqual(["trigger-persisted"]);
  });

  it("persists workflow mode/draft state across store re-instantiation", () => {
    const storage = createMemoryStorage();
    const key = "workflow-store-persistence";
    const first = new WorkflowStudioModeStateStore({
      storage,
      storageKey: key,
    });
    first.setSelectedMode(WorkflowStudioModeIds.canvas);
    first.updateSharedDraft((draft) => ({
      ...draft,
      triggers: [
        {
          id: "trigger-persisted",
          kind: "user",
          type: "manual",
          config: {},
        },
      ],
    }));
    first.setDraftSyncContext({
      studioId: "studio-workflows",
      sessionId: "session-1",
      draftId: "draft-1",
    });

    const second = new WorkflowStudioModeStateStore({
      storage,
      storageKey: key,
    });
    expect(second.getState().selectedModeId).toBe(WorkflowStudioModeIds.canvas);
    expect(second.getState().sharedDraft.triggers.map((entry) => entry.id)).toEqual(["trigger-persisted"]);
    expect(second.getState().draftSyncContext).toEqual({
      studioId: "studio-workflows",
      sessionId: "session-1",
      draftId: "draft-1",
      revision: undefined,
    });
  });

  it("falls back safely when persisted draft contains malformed output payload", () => {
    const storage = createMemoryStorage();
    const key = "workflow-store-malformed-output";
    const malformedDraft = JSON.stringify({
      triggers: [],
      inputs: [],
      steps: [],
      outputs: [
        {
          id: "out-1",
          type: "workflow-output",
          outputType: "document",
          format: "json",
          destination: {
            type: "web-viewer",
            target: "preview",
            options: "invalid-options-record",
          },
        },
      ],
    });

    storage.setItem(key, JSON.stringify({
      schemaVersion: "ai-loom.workflow-studio.mode-state.v1",
      selectedModeId: WorkflowStudioModeIds.wizard,
      sharedDraftSerialized: malformedDraft,
      draftEditorContent: malformedDraft,
      hasLocalDraftEdits: false,
    }));

    const restored = new WorkflowStudioModeStateStore({
      storage,
      storageKey: key,
    });

    expect(restored.getState().draftParseError).toBe("Workflow draft is malformed.");
    expect(restored.getState().sharedDraft.outputs).toEqual([]);
  });

  it("runs shared draft validation hooks and keeps results consistent across mode switches", () => {
    const store = new WorkflowStudioModeStateStore();
    const invalidDraft = deserializeWorkflowDraft(serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "step-2",
          type: "action",
          kind: "action",
          order: 2,
          title: "Non contiguous step order",
        },
      ],
    }));

    store.replaceSharedDraft(invalidDraft);
    const wizardState = store.getState();

    expect(wizardState.isSharedDraftValid).toBe(false);
    expect(wizardState.modeValidationIssues.some((entry) => entry.code === "draft-validation-error")).toBe(true);
    expect(wizardState.draftValidationIssues).toContainEqual(expect.objectContaining({
      code: WorkflowValidationIssueCodes.stepOrderNonContiguous,
    }));

    store.setSelectedMode(WorkflowStudioModeIds.wizard);
    store.setSelectedMode(WorkflowStudioModeIds.canvas);
    const canvasState = store.getState();
    expect(canvasState.isSharedDraftValid).toBe(false);
    expect(canvasState.draftValidationIssues).toContainEqual(expect.objectContaining({
      code: WorkflowValidationIssueCodes.stepOrderNonContiguous,
    }));
  });

  it("reports parse-level validation issues safely when editor content is malformed", () => {
    const store = new WorkflowStudioModeStateStore();
    store.hydrateFromSerializedDraft("{ malformed");

    const state = store.getState();
    expect(state.draftParseError).toBeDefined();
    expect(state.hasModeValidationErrors).toBe(true);
    expect(state.modeValidationIssues.some((issue) => issue.code === "draft-parse-error")).toBe(true);
  });

  it("keeps section updates isolated so editing one section does not wipe the others", () => {
    const store = new WorkflowStudioModeStateStore();
    store.updateSharedDraft((draft) => ({
      ...draft,
      triggers: [
        {
          id: "trigger-1",
          kind: "user",
          type: "manual",
          config: {},
        },
      ],
      inputs: [
        {
          id: "input-1",
          type: "runtime-input",
          sourceType: "runtime-parameter",
          parameterKey: "payload",
          valueType: "object",
        },
      ],
      steps: [
        {
          id: "step-1",
          type: "action",
          kind: "action",
          order: 1,
          title: "Step one",
        },
      ],
      outputs: [
        {
          id: "output-1",
          type: "result",
          outputType: "document",
          format: "json",
          destination: {
            type: "web-viewer",
            target: "preview",
          },
          title: "Preview",
        },
      ],
    }));

    store.updateSharedDraft((draft) => ({
      ...draft,
      steps: draft.steps.map((entry) => (
        entry.id === "step-1"
          ? {
            ...entry,
            title: "Step one updated",
          }
          : entry
      )),
    }));

    const state = store.getState();
    expect(state.sharedDraft.triggers.map((entry) => entry.id)).toEqual(["trigger-1"]);
    expect(state.sharedDraft.inputs.map((entry) => entry.id)).toEqual(["input-1"]);
    expect(state.sharedDraft.steps[0]?.title).toBe("Step one updated");
    expect(state.sharedDraft.outputs.map((entry) => entry.id)).toEqual(["output-1"]);
  });

  it("stores and clears handoff status in centralized workflow mode state", () => {
    const store = new WorkflowStudioModeStateStore();
    store.setHandoffStatus({
      kind: WorkflowStudioHandoffStatusKinds.pending,
      flow: WorkflowStudioHandoffFlowKinds.datasetInput,
      updatedAt: Date.now(),
      handoffId: "handoff:pending:1",
      selectorSessionKey: "workflow-studio:test:inputs",
    });

    expect(store.getState().handoffStatus).toEqual(expect.objectContaining({
      kind: WorkflowStudioHandoffStatusKinds.pending,
      flow: WorkflowStudioHandoffFlowKinds.datasetInput,
      handoffId: "handoff:pending:1",
    }));

    store.clearHandoffStatus();
    expect(store.getState().handoffStatus).toBeUndefined();
  });

  it("clears stale handoff status when workflow draft context changes across sessions", () => {
    const store = new WorkflowStudioModeStateStore();
    const draft = serializeWorkflowDraft(createEmptyWorkflowDraft());

    store.synchronizeSharedDraftFromSnapshot({
      serializedDraft: draft,
      context: {
        studioId: "studio-workflows",
        sessionId: "session-1",
        draftId: "draft-1",
        revision: 1,
      },
    });
    store.setHandoffStatus({
      kind: WorkflowStudioHandoffStatusKinds.completed,
      flow: WorkflowStudioHandoffFlowKinds.agentStep,
      updatedAt: Date.now(),
      handoffId: "handoff:session-1",
      selectorSessionKey: "workflow-studio:test:steps",
    });

    store.synchronizeSharedDraftFromSnapshot({
      serializedDraft: draft,
      context: {
        studioId: "studio-workflows",
        sessionId: "session-2",
        draftId: "draft-2",
        revision: 1,
      },
    });

    expect(store.getState().handoffStatus).toBeUndefined();
  });
});
