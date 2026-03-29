import { describe, expect, it } from "bun:test";
import {
  createEmptyWorkflowDraft,
  deserializeWorkflowDraft,
  serializeWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import { WorkflowStudioModeStateStore } from "../WorkflowStudioModeStateStore";
import { WorkflowStudioModeIds } from "../WorkflowStudioModes";

describe("WorkflowStudioModeStateStore", () => {
  it("tracks selected mode centrally and allows deterministic mode switching", () => {
    const store = new WorkflowStudioModeStateStore();
    expect(store.getState().selectedModeId).toBe(WorkflowStudioModeIds.canvas);

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
    expect(store.getState().sharedDraftSerialized).not.toBe(baselineSerialized);
    expect(store.getState().sharedDraft.outputs.map((entry) => entry.id)).toEqual(["out-1"]);
  });
});
