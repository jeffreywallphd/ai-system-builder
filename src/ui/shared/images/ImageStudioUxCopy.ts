import { ImageStudioFlowStepIds, type ImageStudioFlowStepId } from "./ImageStudioInteractionModel";

export const ImageStudioSurfaceTitles = Object.freeze({
  input: "Choose an image",
  workflow: "Choose an edit",
  readiness: "Check readiness",
  run: "Run progress",
  results: "Your results",
  continuation: "Continue where you left off",
});

export const ImageStudioStepLabels = Object.freeze({
  [ImageStudioFlowStepIds.selectImage]: "Choose image",
  [ImageStudioFlowStepIds.selectWorkflow]: "Choose edit",
  [ImageStudioFlowStepIds.configureParameters]: "Adjust settings",
  [ImageStudioFlowStepIds.assessReadiness]: "Check readiness",
  [ImageStudioFlowStepIds.launchRun]: "Start edit",
  [ImageStudioFlowStepIds.monitorRun]: "Track progress",
  [ImageStudioFlowStepIds.reviewResults]: "Review results",
} satisfies Record<ImageStudioFlowStepId, string>);

export const ImageStudioPrimaryActionLabels = Object.freeze({
  pickImage: "Choose image",
  pickEdit: "Choose edit",
  adjustSettings: "Adjust settings",
  checkReadiness: "Run readiness check",
  startEdit: "Start edit",
  reviewProgress: "Review progress",
  reviewResults: "Review results",
});

export const ImageStudioDefaultCopy = Object.freeze({
  title: "Image Studio",
  subtitle: "Upload or choose an image, apply an edit, and review the result.",
  unknownStep: "Step",
  unknownBlocker: "Finish this step to continue.",
});

export const ImageStudioBlockerMessageByCode: Readonly<Record<string, string>> = Object.freeze({
  "input-image-required": "Choose an image to continue.",
  "workflow-and-system-required": "Choose an image and edit option first.",
  "image-and-workflow-required": "Choose an image and edit option first.",
  "parameters-missing": "Add settings before continuing.",
  "parameter-draft-uncommitted": "Save your setting changes.",
  "readiness-not-assessed": "Run readiness check.",
  "readiness-blocked": "Resolve readiness issues before starting.",
  "readiness-not-ready": "Resolve readiness issues before starting.",
  "launch-in-flight": "Edit launch is in progress.",
  "run-not-started": "Start an edit run first.",
  "run-not-completed": "Wait until the run finishes.",
  "results-not-loaded": "Load generated results.",
});

export function mapImageStudioBlockerCodeToUserMessage(code: string): string {
  return ImageStudioBlockerMessageByCode[code] ?? ImageStudioDefaultCopy.unknownBlocker;
}

export function getImageStudioStepLabel(stepId: string): string {
  if (isImageStudioFlowStepId(stepId)) {
    return ImageStudioStepLabels[stepId];
  }
  return ImageStudioDefaultCopy.unknownStep;
}

function isImageStudioFlowStepId(value: string): value is ImageStudioFlowStepId {
  return value in ImageStudioStepLabels;
}
