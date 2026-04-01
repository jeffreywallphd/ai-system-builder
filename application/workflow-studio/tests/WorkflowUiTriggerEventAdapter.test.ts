import { describe, expect, it } from "bun:test";
import {
  createEmptyWorkflowDraft,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import { UiTriggerEventKinds, createUiTriggerEvent } from "../UiTriggerEventContract";
import { mapUiTriggerEventToWorkflowTriggerEntries } from "../WorkflowUiTriggerEventAdapter";

describe("WorkflowUiTriggerEventAdapter", () => {
  it("maps click action ids to button-click workflow triggers", () => {
    const draft = {
      ...createEmptyWorkflowDraft(),
      triggers: [{
        id: "trigger-open-image",
        kind: WorkflowDraftTriggerKinds.user,
        type: WorkflowDraftTriggerTypes.userButtonClick,
        config: {
          buttonId: "open-image",
        },
      }],
    };

    const event = createUiTriggerEvent({
      kind: UiTriggerEventKinds.click,
      name: "ui.image.gallery.open",
      source: {
        studio: "system-studio",
        componentId: "output-gallery",
        actionId: "open-image",
      },
      payload: {
        imageId: "img-1",
      },
    });

    const mapped = mapUiTriggerEventToWorkflowTriggerEntries({ draft, event });
    expect(mapped.issues).toHaveLength(0);
    expect(mapped.entries).toHaveLength(1);
    expect(mapped.entries[0]).toMatchObject({
      triggerId: "trigger-open-image",
      triggerType: WorkflowDraftTriggerTypes.userButtonClick,
      sourceKind: "manual-user",
      activationType: "ui-click",
    });
  });

  it("maps selection events to user-initiated workflow triggers", () => {
    const draft = {
      ...createEmptyWorkflowDraft(),
      triggers: [{
        id: "trigger-selection",
        kind: WorkflowDraftTriggerKinds.user,
        type: WorkflowDraftTriggerTypes.userInitiatedRun,
        config: {},
      }],
    };

    const event = createUiTriggerEvent({
      kind: UiTriggerEventKinds.selection,
      name: "ui.image.selection.changed",
      source: {
        studio: "system-studio",
        componentId: "output-gallery",
        actionId: "select-image",
      },
      payload: {
        imageId: "img-2",
      },
    });

    const mapped = mapUiTriggerEventToWorkflowTriggerEntries({ draft, event });
    expect(mapped.entries).toHaveLength(1);
    expect(mapped.entries[0]?.sourceKind).toBe("state-data");
    expect(mapped.entries[0]?.activationType).toBe("ui-selection");
  });

  it("returns issues for invalid UI trigger contracts", () => {
    const draft = {
      ...createEmptyWorkflowDraft(),
      triggers: [],
    };

    const event = createUiTriggerEvent({
      kind: UiTriggerEventKinds.submit,
      name: "ui.invalid",
      source: {
        studio: "system-studio",
        componentId: "parameter-form",
      },
      payload: {
        target: "react-event",
      },
    });

    const mapped = mapUiTriggerEventToWorkflowTriggerEntries({ draft, event });
    expect(mapped.entries).toHaveLength(0);
    expect(mapped.issues).toHaveLength(1);
    expect(mapped.issues[0]?.code).toBe("ui-trigger-invalid");
  });
});
