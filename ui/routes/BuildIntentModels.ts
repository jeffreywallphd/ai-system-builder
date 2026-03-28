export const BuildIntents = Object.freeze({
  automateTask: "automate-task",
  createAiAssistant: "create-ai-assistant",
  createAssistant: "create-ai-assistant",
  trainModel: "train-model",
  workWithData: "work-with-data",
  startFromScratch: "start-from-scratch",
});

export type BuildIntent = typeof BuildIntents[keyof typeof BuildIntents];

export interface BuildIntentOption {
  readonly intent: BuildIntent;
  readonly label: string;
  readonly description: string;
  readonly callToAction: string;
}

export interface BuildIntentSelection {
  readonly intent: BuildIntent;
  readonly selectedAtIso: string;
}

export interface BuildLandingPageModel {
  readonly title: string;
  readonly subtitle: string;
  readonly prompt: string;
  readonly options: ReadonlyArray<BuildIntentOption>;
}

export const BuildIntentOptions: ReadonlyArray<BuildIntentOption> = Object.freeze([
  Object.freeze({
    intent: BuildIntents.automateTask,
    label: "Automate a task",
    description: "Set up a repeatable AI flow for a business process.",
    callToAction: "Start automation",
  }),
  Object.freeze({
    intent: BuildIntents.createAssistant,
    label: "Create an AI assistant",
    description: "Design an assistant that can reason with your tools and context.",
    callToAction: "Start assistant",
  }),
  Object.freeze({
    intent: BuildIntents.trainModel,
    label: "Train a model",
    description: "Prepare and launch a model training path with guided defaults.",
    callToAction: "Start training",
  }),
  Object.freeze({
    intent: BuildIntents.workWithData,
    label: "Work with data",
    description: "Shape and prepare datasets for analytics, AI, and downstream tasks.",
    callToAction: "Start data flow",
  }),
  Object.freeze({
    intent: BuildIntents.startFromScratch,
    label: "Start from scratch",
    description: "Open a blank build workspace and decide the details as you go.",
    callToAction: "Open blank workspace",
  }),
]);
