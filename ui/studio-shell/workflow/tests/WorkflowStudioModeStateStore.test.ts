import { beforeEach, describe, expect, it } from "bun:test";
import {
  createEmptyWorkflowDraft,
  deserializeWorkflowDraft,
  serializeWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  clearWorkflowStudioModeStateStoresForTests,
  getWorkflowStudioModeStateStore,
  WorkflowStudioModeStateStore,
} from "../WorkflowStudioModeStateStore";
import { DEFAULT_WORKFLOW_STUDIO_MODE_ID, WorkflowStudioModeIds } from "../WorkflowStudioModes";

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
});
