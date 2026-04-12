import { describe, expect, it } from "bun:test";
import { ImageStudioFlowStepIds } from "../images/ImageStudioInteractionModel";
import {
  ImageStudioPrimaryActionLabels,
  ImageStudioStepLabels,
  getImageStudioStepLabel,
  mapImageStudioBlockerCodeToUserMessage,
} from "../images/ImageStudioUxCopy";

describe("ImageStudioUxCopy", () => {
  it("maps each flow step to user-facing labels", () => {
    expect(getImageStudioStepLabel(ImageStudioFlowStepIds.selectImage)).toBe("Choose image");
    expect(getImageStudioStepLabel(ImageStudioFlowStepIds.selectWorkflow)).toBe("Choose edit");
    expect(getImageStudioStepLabel(ImageStudioFlowStepIds.configureParameters)).toBe("Adjust settings");
    expect(getImageStudioStepLabel(ImageStudioFlowStepIds.assessReadiness)).toBe("Check readiness");
    expect(getImageStudioStepLabel(ImageStudioFlowStepIds.launchRun)).toBe("Start edit");
    expect(getImageStudioStepLabel(ImageStudioFlowStepIds.monitorRun)).toBe("Track progress");
    expect(getImageStudioStepLabel(ImageStudioFlowStepIds.reviewResults)).toBe("Review results");
    expect(getImageStudioStepLabel("unknown-step")).toBe("Step");
  });

  it("maps blocker codes to concrete microcopy with a safe fallback", () => {
    expect(mapImageStudioBlockerCodeToUserMessage("input-image-required")).toBe("Choose an image to continue.");
    expect(mapImageStudioBlockerCodeToUserMessage("readiness-not-ready")).toBe("Resolve readiness issues before starting.");
    expect(mapImageStudioBlockerCodeToUserMessage("unknown-code")).toBe("Finish this step to continue.");
  });

  it("keeps primary UX labels free of technical platform jargon", () => {
    const values = [
      ...Object.values(ImageStudioStepLabels),
      ...Object.values(ImageStudioPrimaryActionLabels),
    ];
    for (const label of values) {
      expect(label.toLowerCase().includes("workflow")).toBeFalse();
      expect(label.toLowerCase().includes("node")).toBeFalse();
      expect(label.toLowerCase().includes("adapter")).toBeFalse();
      expect(label.toLowerCase().includes("backend")).toBeFalse();
    }
  });
});
