import type {
  IModelCompatibility,
  ModelModality,
  ModelTask,
} from "./IModelCompatibility";
import type { IModelRequirement } from "./IModelRequirement";
import type { IModelDependency } from "./IModelDependency";

export type ModelKind =
  | "foundation-model"
  | "chat-model"
  | "completion-model"
  | "embedding-model"
  | "reranker-model"
  | "classifier-model"
  | "speech-to-text-model"
  | "text-to-speech-model"
  | "audio-generation-model"
  | "image-generation-model"
  | "video-generation-model"
  | "vision-model"
  | "multimodal-model"
  | "segmentation-model"
  | "detection-model"
  | "ocr-model"
  | "adapter"
  | "lora"
  | "control-module"
  | "vae"
  | "tokenizer"
  | "prompt-template"
  | "scheduler"
  | "preprocessor"
  | "postprocessor"
  | "utility-asset"
  | "generic";

export type ModelArtifactFormat =
  | "safetensors"
  | "ckpt"
  | "pt"
  | "pth"
  | "bin"
  | "gguf"
  | "onnx"
  | "engine"
  | "mlmodel"
  | "json"
  | "yaml"
  | "remote-api"
  | "unknown";

export type ModelPrecision =
  | "fp32"
  | "fp16"
  | "bf16"
  | "int8"
  | "int4"
  | "uint8"
  | "q2"
  | "q3"
  | "q4"
  | "q5"
  | "q6"
  | "q8"
  | "mixed"
  | "unknown";

export type ModelAccessMethod =
  | "local-file"
  | "local-directory"
  | "remote-api"
  | "remote-download"
  | "bundled"
  | "virtual"
  | "unknown";

export type ModelSourceType =
  | "local"
  | "huggingface"
  | "ollama"
  | "openai-compatible"
  | "civitai"
  | "direct-url"
  | "bundled"
  | "manual"
  | "custom"
  | "unknown";

export type ModelLifecycleStatus =
  | "discovered"
  | "available"
  | "downloading"
  | "installing"
  | "installed"
  | "ready"
  | "missing"
  | "unavailable"
  | "failed"
  | "disabled";

export interface IModelIdentity {
  readonly id: string;
  readonly name: string;
  readonly version?: string;
  readonly variant?: string;
  readonly publisher?: string;
}

export interface IModelSource {
  readonly type: ModelSourceType;
  readonly sourceId?: string;
  readonly repository?: string;
  readonly revision?: string;
  readonly url?: string;
  readonly providerMetadata?: Readonly<Record<string, string>>;
}

export interface IModelArtifact {
  readonly name: string;
  readonly accessMethod: ModelAccessMethod;
  readonly location?: string;
  readonly format: ModelArtifactFormat;
  readonly sizeBytes?: number;
  readonly sha256?: string;
  readonly contentType?: string;
}

export interface IModelResourceProfile {
  readonly parameterCount?: number;
  readonly contextWindowTokens?: number;
  readonly maxOutputTokens?: number;
  readonly estimatedMinMemoryBytes?: number;
  readonly estimatedRecommendedMemoryBytes?: number;
  readonly maxBatchSize?: number;
  readonly recommendedConcurrency?: number;
}

export interface IModel extends IModelIdentity {
  readonly kind: ModelKind;
  readonly isRunnable: boolean;
  readonly status: ModelLifecycleStatus;
  readonly source: IModelSource;
  readonly artifact: IModelArtifact;
  readonly additionalArtifacts: ReadonlyArray<IModelArtifact>;
  readonly dependencies: ReadonlyArray<IModelDependency>;
  readonly precision?: ModelPrecision;
  readonly architectureFamily?: string;
  readonly architecture?: string;
  readonly compatibility: IModelCompatibility;
  readonly requirements: ReadonlyArray<IModelRequirement>;
  readonly resourceProfile?: IModelResourceProfile;
  readonly description?: string;
  readonly tags: ReadonlyArray<string>;
  readonly license?: string;
  readonly languageCodes: ReadonlyArray<string>;
  readonly requiresAuth: boolean;

  isAvailable(): boolean;
  isSupportingAsset(): boolean;
  supportsTask(task: ModelTask): boolean;
  supportsInputModality(modality: ModelModality): boolean;
  supportsOutputModality(modality: ModelModality): boolean;
  isCompatibleWith(target: IModel | IModelCompatibility): boolean;
  satisfiesRequirements(): boolean;
  toReferenceString(): string;
}
