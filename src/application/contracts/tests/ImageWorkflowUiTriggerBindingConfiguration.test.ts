import { describe, expect, it } from "bun:test";
import { UiTriggerEventKinds } from "../../workflow-studio/UiTriggerEventContract";
import {
  createImageWorkflowUiTriggerBindingConfiguration,
  duplicateImageWorkflowUiTriggerBindingConfiguration,
  matchesUiTriggerBindingEvent,
  serializeImageWorkflowUiTriggerBindingConfiguration,
} from "../ImageWorkflowUiTriggerBindingConfiguration";

describe("ImageWorkflowUiTriggerBindingConfiguration", () => {
  it("creates serializable declarative UI-to-workflow bindings", () => {
    const config = createImageWorkflowUiTriggerBindingConfiguration({
      bindings: [
        {
          bindingId: "binding.ui.gallery.open",
          event: {
            kind: UiTriggerEventKinds.click,
            sourceComponentId: "output-gallery",
            actionId: "open-image",
          },
          target: {
            triggerType: "button-click",
          },
        },
      ],
    });

    const serialized = serializeImageWorkflowUiTriggerBindingConfiguration(config);
    const loaded = createImageWorkflowUiTriggerBindingConfiguration(serialized);
    expect(loaded.bindings).toEqual(config.bindings);
  });

  it("rejects bindings without trigger target identity", () => {
    expect(() => createImageWorkflowUiTriggerBindingConfiguration({
      bindings: [
        {
          bindingId: "binding.invalid",
          event: {
            kind: UiTriggerEventKinds.submit,
            sourceComponentId: "parameter-form",
          },
          target: {},
        },
      ],
    })).toThrow("triggerId or triggerType");
  });

  it("matches normalized event kind/name/source against binding selectors", () => {
    const config = createImageWorkflowUiTriggerBindingConfiguration({
      bindings: [
        {
          bindingId: "binding.selection",
          event: {
            kind: UiTriggerEventKinds.selection,
            sourceComponentId: "output-gallery",
            eventName: "ui.image.selection.changed",
          },
          target: {
            triggerType: "user-initiated-run",
          },
        },
      ],
    });

    expect(matchesUiTriggerBindingEvent({
      binding: config.bindings[0]!,
      event: {
        kind: UiTriggerEventKinds.selection,
        name: "ui.image.selection.changed",
        source: {
          componentId: "output-gallery",
          actionId: "select-image",
        },
      },
    })).toBeTrue();

    const duplicate = duplicateImageWorkflowUiTriggerBindingConfiguration(config);
    expect(duplicate).toEqual(config);
    expect(duplicate).not.toBe(config);
  });
});
