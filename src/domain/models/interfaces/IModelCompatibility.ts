export type ModelModality =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "3d"
  | "tabular"
  | "time-series"
  | "code"
  | "multimodal"
  | "generic";

export type ModelTask =
  | "text-generation"
  | "chat"
  | "instruction-following"
  | "reasoning"
  | "tool-calling"
  | "function-calling"
  | "summarization"
  | "translation"
  | "classification"
  | "reranking"
  | "embedding"
  | "speech-to-text"
  | "text-to-speech"
  | "voice-conversion"
  | "audio-generation"
  | "image-generation"
  | "image-editing"
  | "image-captioning"
  | "image-classification"
  | "object-detection"
  | "segmentation"
  | "ocr"
  | "video-generation"
  | "video-editing"
  | "video-understanding"
  | "depth-estimation"
  | "inpainting"
  | "outpainting"
  | "upscaling"
  | "control"
  | "fine-tuning"
  | "moderation"
  | "generic";

export type RuntimeEngine =
  | "comfyui"
  | "transformers"
  | "llama-cpp"
  | "vllm"
  | "ollama"
  | "openai-compatible-api"
  | "diffusers"
  | "onnx"
  | "tensorrt"
  | "custom"
  | "generic";

export interface IModelCompatibility {
  /**
   * Input modalities accepted by this model.
   */
  readonly inputModalities: ReadonlyArray<ModelModality>;

  /**
   * Output modalities produced by this model.
   */
  readonly outputModalities: ReadonlyArray<ModelModality>;

  /**
   * Tasks this model can perform.
   */
  readonly supportedTasks: ReadonlyArray<ModelTask>;

  /**
   * Runtimes/engines known to support this model.
   */
  readonly supportedRuntimes: ReadonlyArray<RuntimeEngine>;

  /**
   * True when the model is not constrained to a specific runtime.
   */
  readonly allowsAnyRuntime: boolean;

  /**
   * Optional architecture families.
   * Examples:
   * - sdxl
   * - flux
   * - llama
   * - mistral
   * - qwen
   * - whisper
   * - kokoro
   * - generic
   */
  readonly architectureFamilies: ReadonlyArray<string>;

  /**
   * True when the model is architecture-agnostic or family is unknown.
   */
  readonly allowsAnyArchitectureFamily: boolean;

  /**
   * Optional companion asset types that this model can interoperate with.
   * Examples:
   * - lora
   * - vae
   * - tokenizer
   * - controlnet
   * - adapter
   * - embedding
   * - prompt-template
   */
  readonly compatibleAssetTypes: ReadonlyArray<string>;

  supportsInputModality(modality: ModelModality): boolean;
  supportsOutputModality(modality: ModelModality): boolean;
  supportsTask(task: ModelTask): boolean;
  supportsRuntime(runtime: RuntimeEngine): boolean;
  supportsArchitectureFamily(family: string): boolean;
  supportsAssetType(assetType: string): boolean;

  /**
   * Determines whether this compatibility profile can interoperate with another.
   * Useful for model-to-model assignment, workflow validation, and asset binding.
   */
  isCompatibleWith(other: IModelCompatibility): boolean;
}
