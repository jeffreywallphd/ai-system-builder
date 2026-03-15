/**
 * ModelFamily is a lightweight domain value object plus a curated catalog
 * of well-known architecture families.
 *
 * Why this exists even though architectureFamily is stored as a string:
 * - the domain needs normalization and comparison logic
 * - the set of families will evolve over time
 * - we want strong utilities without making the system brittle through
 *   an overly restrictive enum
 *
 * This file intentionally supports both:
 * - known canonical families
 * - unknown/custom families
 */

export type KnownModelFamily =
  | "generic"
  | "sd15"
  | "sdxl"
  | "sd3"
  | "flux"
  | "wan"
  | "hunyuan-video"
  | "cogvideo"
  | "llama"
  | "mistral"
  | "mixtral"
  | "qwen"
  | "phi"
  | "gemma"
  | "deepseek"
  | "t5"
  | "bert"
  | "clip"
  | "whisper"
  | "wav2vec"
  | "bark"
  | "kokoro"
  | "sam"
  | "yolo";

const KNOWN_FAMILY_SET: ReadonlySet<KnownModelFamily> = new Set([
  "generic",
  "sd15",
  "sdxl",
  "sd3",
  "flux",
  "wan",
  "hunyuan-video",
  "cogvideo",
  "llama",
  "mistral",
  "mixtral",
  "qwen",
  "phi",
  "gemma",
  "deepseek",
  "t5",
  "bert",
  "clip",
  "whisper",
  "wav2vec",
  "bark",
  "kokoro",
  "sam",
  "yolo",
]);

const FAMILY_ALIAS_MAP: Readonly<Record<string, KnownModelFamily>> = Object.freeze({
  generic: "generic",

  // Diffusion / visual generation
  "sd-1.5": "sd15",
  "sd1.5": "sd15",
  "stable-diffusion-1.5": "sd15",
  "stable diffusion 1.5": "sd15",
  "stable-diffusion-v1-5": "sd15",
  "stable diffusion v1.5": "sd15",
  sd15: "sd15",

  "sd-xl": "sdxl",
  "sdxl-base": "sdxl",
  "stable-diffusion-xl": "sdxl",
  "stable diffusion xl": "sdxl",
  sdxl: "sdxl",

  "sd-3": "sd3",
  "stable-diffusion-3": "sd3",
  "stable diffusion 3": "sd3",
  sd3: "sd3",

  flux: "flux",
  "flux.1": "flux",

  wan: "wan",
  "wan-2.1": "wan",

  "hunyuan video": "hunyuan-video",
  hunyuanvideo: "hunyuan-video",
  "hunyuan-video": "hunyuan-video",

  "cog video": "cogvideo",
  cogvideo: "cogvideo",
  "cog-video": "cogvideo",

  // LLM / language
  llama: "llama",
  "llama-2": "llama",
  "llama-3": "llama",
  "llama-3.1": "llama",
  "llama-3.2": "llama",

  mistral: "mistral",
  "mistral-7b": "mistral",

  mixtral: "mixtral",

  qwen: "qwen",
  "qwen-2": "qwen",
  "qwen-2.5": "qwen",

  phi: "phi",
  "phi-3": "phi",
  "phi-4": "phi",

  gemma: "gemma",
  "gemma-2": "gemma",

  deepseek: "deepseek",
  "deepseek-r1": "deepseek",
  "deepseek-v3": "deepseek",

  t5: "t5",
  bert: "bert",
  clip: "clip",

  // Speech / audio
  whisper: "whisper",
  "whisper-large-v3": "whisper",

  wav2vec: "wav2vec",
  wav2vec2: "wav2vec",

  bark: "bark",
  kokoro: "kokoro",

  // Vision
  sam: "sam",
  "segment-anything": "sam",

  yolo: "yolo",
  "yolo-v8": "yolo",
  "yolo-v11": "yolo",
});

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

export class ModelFamily {
  public static readonly GENERIC = new ModelFamily("generic");
  public static readonly SD15 = new ModelFamily("sd15");
  public static readonly SDXL = new ModelFamily("sdxl");
  public static readonly SD3 = new ModelFamily("sd3");
  public static readonly FLUX = new ModelFamily("flux");
  public static readonly WAN = new ModelFamily("wan");
  public static readonly HUNYUAN_VIDEO = new ModelFamily("hunyuan-video");
  public static readonly COGVIDEO = new ModelFamily("cogvideo");
  public static readonly LLAMA = new ModelFamily("llama");
  public static readonly MISTRAL = new ModelFamily("mistral");
  public static readonly MIXTRAL = new ModelFamily("mixtral");
  public static readonly QWEN = new ModelFamily("qwen");
  public static readonly PHI = new ModelFamily("phi");
  public static readonly GEMMA = new ModelFamily("gemma");
  public static readonly DEEPSEEK = new ModelFamily("deepseek");
  public static readonly T5 = new ModelFamily("t5");
  public static readonly BERT = new ModelFamily("bert");
  public static readonly CLIP = new ModelFamily("clip");
  public static readonly WHISPER = new ModelFamily("whisper");
  public static readonly WAV2VEC = new ModelFamily("wav2vec");
  public static readonly BARK = new ModelFamily("bark");
  public static readonly KOKORO = new ModelFamily("kokoro");
  public static readonly SAM = new ModelFamily("sam");
  public static readonly YOLO = new ModelFamily("yolo");

  public readonly value: string;

  constructor(value: string) {
    const normalized = ModelFamily.normalize(value);

    if (!normalized) {
      throw new Error("ModelFamily cannot be empty.");
    }

    this.value = normalized;
  }

  public equals(other: ModelFamily | string | undefined | null): boolean {
    if (!other) {
      return false;
    }

    const otherValue = typeof other === "string" ? other : other.value;
    return this.value === ModelFamily.normalize(otherValue);
  }

  public isKnown(): boolean {
    return ModelFamily.isKnown(this.value);
  }

  public isGeneric(): boolean {
    return this.value === "generic";
  }

  public toString(): string {
    return this.value;
  }

  public static normalize(value: string): string {
    const normalized = normalize(value);
    return FAMILY_ALIAS_MAP[normalized] ?? normalized;
  }

  public static create(value: string): ModelFamily {
    return new ModelFamily(value);
  }

  public static from(value: string | ModelFamily): ModelFamily {
    return value instanceof ModelFamily ? value : new ModelFamily(value);
  }

  public static isKnown(value: string): value is KnownModelFamily {
    return KNOWN_FAMILY_SET.has(ModelFamily.normalize(value) as KnownModelFamily);
  }

  public static toKnown(value: string): KnownModelFamily | undefined {
    const normalized = ModelFamily.normalize(value);
    return ModelFamily.isKnown(normalized) ? normalized : undefined;
  }

  public static matches(
    left: string | ModelFamily | undefined | null,
    right: string | ModelFamily | undefined | null
  ): boolean {
    if (!left || !right) {
      return false;
    }

    const leftValue = left instanceof ModelFamily ? left.value : left;
    const rightValue = right instanceof ModelFamily ? right.value : right;

    return ModelFamily.normalize(leftValue) === ModelFamily.normalize(rightValue);
  }

  public static anyOf(
    value: string | ModelFamily | undefined | null,
    candidates: ReadonlyArray<string | ModelFamily>
  ): boolean {
    if (!value) {
      return false;
    }

    return candidates.some((candidate) => ModelFamily.matches(value, candidate));
  }

  public static values(): ReadonlyArray<KnownModelFamily> {
    return Object.freeze([...KNOWN_FAMILY_SET]);
  }
}
