import {
  DATASET_PREPARATION_TASK_PROFILE_DEFINITIONS,
  type DatasetPreparationTaskProfileDefinition,
  type DatasetPreparationTaskType,
} from "../../../../../../../modules/contracts/runtime";

export interface DatasetPreparationTaskProfileOption {
  readonly taskType: DatasetPreparationTaskType;
  readonly label: string;
  readonly description: string;
  readonly runtimeSupport: DatasetPreparationTaskProfileDefinition["runtimeSupport"];
}

const TASK_PROFILE_COPY: Record<DatasetPreparationTaskType, Pick<DatasetPreparationTaskProfileOption, "label" | "description">> = {
  "llm-instruction": {
    label: "Instruction tuning",
    description: "Turns source material into practice prompts and helpful answers for a text model. Example: a policy document becomes a question about a rule and a clear answer.",
  },
  "llm-classification": {
    label: "Text classification",
    description: "Teaches a text model to place each piece of writing into the right category. Example: a support message is labeled billing, bug report, or account help.",
  },
  "llm-extraction": {
    label: "Information extraction",
    description: "Teaches a text model to pull out specific facts from a document. Example: an invoice becomes vendor name, invoice date, and total amount.",
  },
  "llm-embedding": {
    label: "Embedding pairs",
    description: "Creates matched text pairs that help search understand what belongs together. Example: a user search is paired with the paragraph that answers it.",
  },
  "llm-reranker": {
    label: "Reranking",
    description: "Teaches a model to put the best search results first. Example: a question is matched with several passages, and the most useful passage is marked as best.",
  },
  "diffusion-lora": {
    label: "Image LoRA",
    description: "Prepares images and short captions so an image model can learn a subject, style, or idea. Example: photos of one product are paired with captions that describe it.",
  },
  "vision-classification": {
    label: "Image classification",
    description: "Teaches a vision model to choose the right label for an image. Example: product photos are labeled shoe, bag, or shirt.",
  },
  "vision-detection": {
    label: "Object detection",
    description: "Teaches a vision model to find objects inside an image. Example: a photo marks each car with a box and the label car.",
  },
  "vision-segmentation": {
    label: "Image segmentation",
    description: "Teaches a vision model to outline the exact area an object covers. Example: a medical image marks the full shape of the area to study.",
  },
};

export const DATASET_PREPARATION_TASK_PROFILE_OPTIONS: readonly DatasetPreparationTaskProfileOption[] =
  DATASET_PREPARATION_TASK_PROFILE_DEFINITIONS.map((profile) => ({
    taskType: profile.taskType,
    label: TASK_PROFILE_COPY[profile.taskType].label,
    description: TASK_PROFILE_COPY[profile.taskType].description,
    runtimeSupport: profile.runtimeSupport,
  }));

export function getDatasetPreparationTaskProfileOption(
  taskType: DatasetPreparationTaskType,
): DatasetPreparationTaskProfileOption {
  const option = DATASET_PREPARATION_TASK_PROFILE_OPTIONS.find((candidate) => candidate.taskType === taskType);
  if (!option) {
    throw new Error(`Dataset preparation task profile option is not registered: ${taskType}`);
  }
  return option;
}
