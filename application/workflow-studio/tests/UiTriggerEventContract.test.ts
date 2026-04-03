import { describe, expect, it } from "bun:test";
import {
  UiTriggerEventKinds,
  createUiTriggerEvent,
  mapUiTriggerKindToWorkflowSourceKind,
  validateUiTriggerEvent,
} from "../UiTriggerEventContract";

describe("UiTriggerEventContract", () => {
  it("creates normalized UI trigger events with reusable context references", () => {
    const event = createUiTriggerEvent({
      kind: UiTriggerEventKinds.click,
      name: " ui.image.gallery.open ",
      source: {
        studio: "system-studio",
        componentId: " output-gallery ",
        actionId: " open-image ",
      },
      payload: {
        imageId: "img-1",
      },
      context: {
        workflowAssetId: "asset:workflow:image",
        references: {
          viewerMode: "gallery",
        },
      },
    });

    expect(event.name).toBe("ui.image.gallery.open");
    expect(event.source.componentId).toBe("output-gallery");
    expect(event.source.actionId).toBe("open-image");
    expect(event.context?.references?.viewerMode).toBe("gallery");
  });

  it("validates malformed payloads and framework-leak keys", () => {
    const event = createUiTriggerEvent({
      kind: UiTriggerEventKinds.submit,
      name: "ui.image.parameter.submit",
      source: {
        studio: "system-studio",
        componentId: "parameter-form",
      },
      payload: {
        nativeEvent: { bad: true },
      },
      occurredAt: "not-a-date",
    });

    const issues = validateUiTriggerEvent(event);
    expect(issues.map((issue) => issue.code)).toEqual([
      "ui-trigger-occurred-at-invalid",
      "ui-trigger-payload-key-reserved",
    ]);
  });

  it("maps selection to state-data trigger source for workflow alignment", () => {
    expect(mapUiTriggerKindToWorkflowSourceKind(UiTriggerEventKinds.click)).toBe("manual-user");
    expect(mapUiTriggerKindToWorkflowSourceKind(UiTriggerEventKinds.submit)).toBe("manual-user");
    expect(mapUiTriggerKindToWorkflowSourceKind(UiTriggerEventKinds.selection)).toBe("state-data");
  });
});
