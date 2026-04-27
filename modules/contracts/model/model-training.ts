import { type ModelTaskTag } from "../../domain/model";
import { type ModelBrowseProvider } from "./model-browse-provider";
import { type ModelInferenceMode } from "./model-inference-mode";
import { type ModelInventoryRecord } from "./model-inventory";

export const MODEL_TRAINING_METHODS = ["lora", "qlora", "full-finetune"] as const;
export type ModelTrainingMethod = (typeof MODEL_TRAINING_METHODS)[number];

export const MODEL_TRAINING_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export type ModelTrainingStatus = (typeof MODEL_TRAINING_STATUSES)[number];

export type ModelTrainingDatasetSplitRole = "train" | "validation" | "test";

export interface ModelTrainingDatasetInput {
  artifactId: string;
  splitRole?: ModelTrainingDatasetSplitRole;
  format?: string;
  path?: string;
}

export interface ModelTrainingBaseModel {
  modelRecordId?: string;
  provider?: ModelBrowseProvider;
  modelId?: string;
  localPath?: string;
  inferenceMode?: ModelInferenceMode;
}

export interface ModelTrainingOutputConfig {
  outputModelName: string;
  destination: {
    local: {
      enabled: boolean;
    };
    huggingFace?: {
      enabled?: boolean;
      provider?: "huggingface";
      repository?: string;
      revision?: string;
      pathPrefix?: string;
      private?: boolean;
    };
  };
}

export interface ModelTrainingCommonParameters {
  numEpochs?: number;
  maxSteps?: number;
  batchSize?: number;
  learningRate?: number;
  weightDecay?: number;
  maxSequenceLength?: number;
  seed?: number;
}

export interface ModelTrainingLoRAParameters {
  rank?: number;
  alpha?: number;
  dropout?: number;
  targetModules?: string[];
}

export interface ModelTrainingQuantizationParameters {
  loadIn4Bit?: boolean;
  loadIn8Bit?: boolean;
  bnb4BitQuantType?: string;
  bnb4BitComputeDtype?: string;
}

export interface ModelTrainingAdvancedParameters {
  gradientAccumulationSteps?: number;
  warmupSteps?: number;
  warmupRatio?: number;
  schedulerType?: string;
  evalIntervalSteps?: number;
  checkpointIntervalSteps?: number;
  saveTotalLimit?: number;
  mixedPrecision?: "no" | "fp16" | "bf16";
  gradientCheckpointing?: boolean;
  lora?: ModelTrainingLoRAParameters;
  quantization?: ModelTrainingQuantizationParameters;
}

export interface ModelTrainingValidationConfig {
  enabled?: boolean;
  expectedLoRA?: boolean;
  expectedRecurrentAdditions?: boolean;
  taskTags?: ModelTaskTag[];
}

export interface ModelTrainingRequest {
  baseModel: ModelTrainingBaseModel;
  datasets: ModelTrainingDatasetInput[];
  method: ModelTrainingMethod;
  commonParameters: ModelTrainingCommonParameters;
  advancedParameters?: ModelTrainingAdvancedParameters;
  output: ModelTrainingOutputConfig;
  validation?: ModelTrainingValidationConfig;
}

export interface ModelTrainingCheckpointSummary {
  path: string;
  step?: number;
  metric?: string;
  value?: number;
}

export interface ModelTrainingResult {
  runId: string;
  status: ModelTrainingStatus;
  outputModel?: ModelInventoryRecord;
  metrics?: Record<string, number>;
  checkpoints?: ModelTrainingCheckpointSummary[];
  validationReportPath?: string;
  warnings?: string[];
}
