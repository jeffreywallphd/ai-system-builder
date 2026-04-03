import { describe, expect, it } from "bun:test";
import { mapImageUiEventToUiTriggerEvent } from "../image-system/ImageUiTriggerEventAdapter";

describe("ImageUiTriggerEventAdapter", () => {
  it("maps parameter submit image events to submit UI trigger events", () => {
    const mapped = mapImageUiEventToUiTriggerEvent({
      type: "parameter-submitted",
      sourceComponent: "parameter-form",
      eventId: "event-1",
      occurredAt: "2026-04-01T00:00:00.000Z",
      context: {
        workflowAssetId: "asset:workflow:image",
        system: {
          systemAssetId: "asset:system:image",
        },
      },
      payload: {
        imageId: "img-1",
        values: {
          prompt: "sunrise",
        },
        issueCount: 0,
      },
    });

    expect(mapped).toBeDefined();
    expect(mapped?.kind).toBe("submit");
    expect(mapped?.name).toBe("ui.image.parameter.submit");
    expect(mapped?.source.componentId).toBe("parameter-form");
    expect(mapped?.context?.workflowAssetId).toBe("asset:workflow:image");
  });

  it("maps image selection events to normalized selection UI trigger events", () => {
    const mapped = mapImageUiEventToUiTriggerEvent({
      type: "gallery-item-selected",
      sourceComponent: "output-gallery",
      eventId: "event-2",
      occurredAt: "2026-04-01T00:00:00.000Z",
      payload: {
        imageId: "img-2",
        selected: true,
        selectedIds: ["img-2"],
      },
    });

    expect(mapped).toBeDefined();
    expect(mapped?.kind).toBe("selection");
    expect(mapped?.source.actionId).toBe("select-image");
    expect(mapped?.payload.imageId).toBe("img-2");
  });

  it("returns undefined for image events outside the bounded trigger mapping scope", () => {
    const mapped = mapImageUiEventToUiTriggerEvent({
      type: "upload-initiated",
      sourceComponent: "upload-panel",
      eventId: "event-3",
      occurredAt: "2026-04-01T00:00:00.000Z",
      payload: {
        fileCount: 1,
        fileNames: ["input.png"],
      },
    });

    expect(mapped).toBeUndefined();
  });
});
