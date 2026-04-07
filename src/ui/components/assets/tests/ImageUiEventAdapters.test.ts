import { describe, expect, it } from "bun:test";
import { createImageUiEvent, emitImageUiEvent } from "../image-system/ImageUiEventAdapters";

describe("image ui event adapters", () => {
  it("creates standardized event envelopes", () => {
    const event = createImageUiEvent({
      type: "upload-initiated",
      sourceComponent: "upload-panel",
      payload: {
        fileCount: 2,
        fileNames: ["a.png", "b.png"],
      },
      context: {
        dataset: {
          datasetAssetId: "dataset-images",
        },
      },
    });

    expect(event.type).toBe("upload-initiated");
    expect(event.sourceComponent).toBe("upload-panel");
    expect(event.payload.fileCount).toBe(2);
    expect(event.context?.dataset?.datasetAssetId).toBe("dataset-images");
    expect(event.eventId).toContain("upload-panel:upload-initiated:");
    expect(typeof event.occurredAt).toBe("string");
  });

  it("emits through optional callback", () => {
    const emitted: Array<string> = [];
    emitImageUiEvent((event) => emitted.push(`${event.sourceComponent}:${event.type}`), {
      type: "comparison-mode-changed",
      sourceComponent: "comparison-view",
      payload: { mode: "overlay" },
    });

    emitImageUiEvent(undefined, {
      type: "viewer-interaction",
      sourceComponent: "image-viewer",
      payload: { interactionType: "zoom" },
    });

    expect(emitted).toEqual(["comparison-view:comparison-mode-changed"]);
  });
});
