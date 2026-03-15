/**
 * ModelType groups domain-level model kinds into stable, useful categories.
 *
 * Why this exists even though IModel.kind already exists:
 * - model kinds are detailed and concrete
 * - the rest of the system often needs broader grouping behavior
 * - filtering, UI, validation, and compatibility logic benefit from a
 *   higher-level categorization layer
 *
 * Example:
 * - "chat-model" and "completion-model" are both language model types
 * - "lora" and "vae" are both supporting asset types
 * - "image-generation-model" and "vision-model" are both visual types,
 *   but they are not interchangeable kinds
 */

import type { ModelKind } from "./interfaces/IModel";

export type ModelType =
  | "language"
  | "embedding"
  | "ranking"
  | "classification"
  | "speech"
  | "audio-generation"
  | "image-generation"
  | "video-generation"
  | "vision"
  | "multimodal"
  | "segmentation"
  | "detection"
  | "ocr"
  | "adapter"
  | "support-asset"
  | "utility"
  | "generic";

const KIND_TO_TYPE_MAP: Readonly<Record<ModelKind, ModelType>> = Object.freeze({
  "foundation-model": "generic",
  "chat-model": "language",
  "completion-model": "language",
  "embedding-model": "embedding",
  "reranker-model": "ranking",
  "classifier-model": "classification",
  "speech-to-text-model": "speech",
  "text-to-speech-model": "speech",
  "audio-generation-model": "audio-generation",
  "image-generation-model": "image-generation",
  "video-generation-model": "video-generation",
  "vision-model": "vision",
  "multimodal-model": "multimodal",
  "segmentation-model": "segmentation",
  "detection-model": "detection",
  "ocr-model": "ocr",
  adapter: "adapter",
  lora: "adapter",
  "control-module": "adapter",
  vae: "support-asset",
  tokenizer: "support-asset",
  "prompt-template": "support-asset",
  scheduler: "support-asset",
  preprocessor: "utility",
  postprocessor: "utility",
  "utility-asset": "utility",
  generic: "generic",
});

const MODEL_TYPE_SET: ReadonlySet<ModelType> = new Set([
  "language",
  "embedding",
  "ranking",
  "classification",
  "speech",
  "audio-generation",
  "image-generation",
  "video-generation",
  "vision",
  "multimodal",
  "segmentation",
  "detection",
  "ocr",
  "adapter",
  "support-asset",
  "utility",
  "generic",
]);

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

export class ModelTypeHelper {
  public static readonly LANGUAGE: ModelType = "language";
  public static readonly EMBEDDING: ModelType = "embedding";
  public static readonly RANKING: ModelType = "ranking";
  public static readonly CLASSIFICATION: ModelType = "classification";
  public static readonly SPEECH: ModelType = "speech";
  public static readonly AUDIO_GENERATION: ModelType = "audio-generation";
  public static readonly IMAGE_GENERATION: ModelType = "image-generation";
  public static readonly VIDEO_GENERATION: ModelType = "video-generation";
  public static readonly VISION: ModelType = "vision";
  public static readonly MULTIMODAL: ModelType = "multimodal";
  public static readonly SEGMENTATION: ModelType = "segmentation";
  public static readonly DETECTION: ModelType = "detection";
  public static readonly OCR: ModelType = "ocr";
  public static readonly ADAPTER: ModelType = "adapter";
  public static readonly SUPPORT_ASSET: ModelType = "support-asset";
  public static readonly UTILITY: ModelType = "utility";
  public static readonly GENERIC: ModelType = "generic";

  public static fromKind(kind: ModelKind): ModelType {
    return KIND_TO_TYPE_MAP[kind];
  }

  public static isValid(value: string): value is ModelType {
    return MODEL_TYPE_SET.has(normalize(value) as ModelType);
  }

  public static normalize(value: string): ModelType | undefined {
    const normalized = normalize(value);
    return this.isValid(normalized) ? normalized : undefined;
  }

  public static matches(
    left: ModelType | string | undefined | null,
    right: ModelType | string | undefined | null
  ): boolean {
    if (!left || !right) {
      return false;
    }

    const normalizedLeft = this.normalize(String(left));
    const normalizedRight = this.normalize(String(right));

    return !!normalizedLeft && normalizedLeft === normalizedRight;
  }

  public static isLanguage(kind: ModelKind): boolean {
    return this.fromKind(kind) === "language";
  }

  public static isEmbedding(kind: ModelKind): boolean {
    return this.fromKind(kind) === "embedding";
  }

  public static isRanking(kind: ModelKind): boolean {
    return this.fromKind(kind) === "ranking";
  }

  public static isClassification(kind: ModelKind): boolean {
    return this.fromKind(kind) === "classification";
  }

  public static isSpeech(kind: ModelKind): boolean {
    return this.fromKind(kind) === "speech";
  }

  public static isVision(kind: ModelKind): boolean {
    return this.fromKind(kind) === "vision";
  }

  public static isImageGeneration(kind: ModelKind): boolean {
    return this.fromKind(kind) === "image-generation";
  }

  public static isVideoGeneration(kind: ModelKind): boolean {
    return this.fromKind(kind) === "video-generation";
  }

  public static isMultimodal(kind: ModelKind): boolean {
    return this.fromKind(kind) === "multimodal";
  }

  public static isAdapter(kind: ModelKind): boolean {
    return this.fromKind(kind) === "adapter";
  }

  public static isSupportAsset(kind: ModelKind): boolean {
    return this.fromKind(kind) === "support-asset";
  }

  public static isUtility(kind: ModelKind): boolean {
    return this.fromKind(kind) === "utility";
  }

  public static isRunnableKind(kind: ModelKind): boolean {
    return !this.isSupportAsset(kind) && !this.isUtility(kind) && kind !== "generic";
  }

  public static values(): ReadonlyArray<ModelType> {
    return Object.freeze([...MODEL_TYPE_SET]);
  }
}
