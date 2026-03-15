import { IModelCompatibility } from "./IModelCompatibility";
import { IModelRequirement } from "./IModelRequirement";

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
  /**
   * File or artifact name.
   */
  readonly name: string;

  /**
   * Access mechanism for the artifact.
   */
  readonly accessMethod: ModelAccessMethod;

  /**
   * Full path, directory path, or remote reference.
   */
  readonly location?: string;

  /**
   * Format of the artifact.
   */
  readonly format: ModelArtifactFormat;

  /**
   * Optional file size in bytes.
   */
  readonly sizeBytes?: number;

  /**
   * Optional content checksum.
   */
  readonly sha256?: string;

  /**
   * Optional MIME type or general content type.
   */
  readonly contentType?: string;
}

export interface IModelResourceProfile {
  /**
   * Optional approximate parameter count.
   */
  readonly parameterCount?: number;

  /**
   * Optional context window for language models.
   */
  readonly contextWindowTokens?: number;

  /**
   * Optional maximum output tokens for generative text models.
   */
  readonly maxOutputTokens?: number;

  /**
   * Optional memory estimates.
   */
  readonly estimatedMinMemoryBytes?: number;
  readonly estimatedRecommendedMemoryBytes?: number;

  /**
   * Optional batch or concurrency hints.
   */
  readonly maxBatchSize?: number;
  readonly recommendedConcurrency?: number;
}

export interface IModel extends IModelIdentity {
  /**
   * High-level kind of model or asset.
   */
  readonly kind: ModelKind;

  /**
   * Whether the model can be directly executed/invoked by a runtime,
   * versus being a supporting asset such as a tokenizer, adapter, or VAE.
   */
  readonly isRunnable: boolean;

  /**
   * Lifecycle / install status.
   */
  readonly status: ModelLifecycleStatus;

  /**
   * Where the model came from.
   */
  readonly source: IModelSource;

  /**
   * Primary artifact or primary remote handle.
   */
  readonly artifact: IModelArtifact;

  /**
   * Additional artifacts, if any.
   * Useful for models that require multiple files or companion assets.
   */
  readonly additionalArtifacts: ReadonlyArray<IModelArtifact>;

  /**
   * Precision or quantization info when known.
   */
  readonly precision?: ModelPrecision;

  /**
   * Architecture or family string when known.
   * Examples:
   * - llama
   * - mistral
   * - qwen
   * - sdxl
   * - flux
   * - whisper
   */
  readonly architectureFamily?: string;

  /**
   * Freeform architecture identifier when finer-grained info is useful.
   * Examples:
   * - llama-3.1
   * - whisper-large-v3
   * - flux-dev
   */
  readonly architecture?: string;

  /**
   * Compatibility profile used throughout the domain.
   */
  readonly compatibility: IModelCompatibility;

  /**
   * Usage requirements and constraints.
   */
  readonly requirements: ReadonlyArray<IModelRequirement>;

  /**
   * Resource profile for scheduling, filtering, and planning.
   */
  readonly resourceProfile?: IModelResourceProfile;

  /**
   * Human-facing metadata.
   */
  readonly description?: string;
  readonly tags: ReadonlyArray<string>;
  readonly license?: string;
  readonly languageCodes: ReadonlyArray<string>;

  /**
   * Whether the model requires authentication or gated access.
   */
  readonly requiresAuth: boolean;

  /**
   * Whether the model is currently usable in a workflow.
   */
  isAvailable(): boolean;

  /**
   * Whether the model is a supporting asset rather than a primary runnable model.
   */
  isSupportingAsset(): boolean;

  /**
   * Returns true if the model supports a given task.
   */
  supportsTask(task: string): boolean;

  /**
   * Returns true if the model supports a given input modality.
   */
  supportsInputModality(modality: string): boolean;

  /**
   * Returns true if the model supports a given output modality.
   */
  supportsOutputModality(modality: string): boolean;

  /**
   * Returns true if this model can interoperate with another model
   * or a target compatibility profile.
   */
  isCompatibleWith(target: IModel | IModelCompatibility): boolean;

  /**
   * Returns true if the model satisfies all declared requirements.
   */
  satisfiesRequirements(): boolean;

  /**
   * Returns a concise display/reference string.
   */
  toReferenceString(): string;
}
