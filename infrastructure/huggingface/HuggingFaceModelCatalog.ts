import type { IModel } from "../../domain/models/interfaces/IModel";
import type { ModelTask } from "../../domain/models/interfaces/IModelCompatibility";
import {
  Model,
  ModelArtifact,
  ModelResourceProfile,
  ModelSource,
} from "../../domain/models/Model";
import { ModelCompatibility } from "../../domain/models/ModelCompatibility";
import type {
  IRemoteModelCatalog,
  IRemoteModelCatalogItem,
  IRemoteModelCatalogSearchCriteria,
  IRemoteModelCatalogSearchResult,
} from "../../application/ports/interfaces/IRemoteModelCatalog";
import {
  RemoteModelCatalogItem,
  RemoteModelCatalogSearchResult,
} from "../../application/ports/RemoteModelCatalog";
import {
  HuggingFaceApiClient,
  type IHuggingFaceModelFileInfo,
  type IHuggingFaceModelInfo,
  type IHuggingFaceModelSearchItem,
} from "./HuggingFaceApiClient";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function hasTag(tags: ReadonlyArray<string> | undefined, value: string): boolean {
  return (tags ?? []).some((tag) => normalize(tag) === normalize(value));
}

function determineKind(
  pipelineTag: string | undefined,
  tags: ReadonlyArray<string> | undefined
): IModel["kind"] {
  const tag = normalize(pipelineTag ?? "");

  if (tag === "text-generation") return "completion-model";
  if (tag === "text2text-generation") return "foundation-model";
  if (tag === "feature-extraction") return "embedding-model";
  if (tag === "sentence-similarity") return "embedding-model";
  if (tag === "text-classification") return "classifier-model";
  if (tag === "token-classification") return "classifier-model";
  if (tag === "translation") return "foundation-model";
  if (tag === "summarization") return "foundation-model";
  if (tag === "automatic-speech-recognition") return "speech-to-text-model";
  if (tag === "text-to-speech") return "text-to-speech-model";
  if (tag === "audio-to-audio") return "audio-generation-model";
  if (tag === "image-classification") return "vision-model";
  if (tag === "image-to-text") return "multimodal-model";
  if (tag === "image-to-image") return "image-generation-model";
  if (tag === "text-to-image") return "image-generation-model";
  if (tag === "text-to-video") return "video-generation-model";
  if (tag === "video-classification") return "vision-model";
  if (tag === "zero-shot-image-classification") return "vision-model";
  if (tag === "object-detection") return "detection-model";
  if (tag === "image-segmentation") return "segmentation-model";
  if (tag === "document-question-answering") return "ocr-model";
  if (tag === "visual-question-answering") return "multimodal-model";

  if (hasTag(tags, "lora")) return "lora";
  if (hasTag(tags, "adapter")) return "adapter";
  if (hasTag(tags, "controlnet")) return "control-module";
  if (hasTag(tags, "tokenizer")) return "tokenizer";

  return "generic";
}

function determineArchitectureFamily(
  modelId: string,
  tags: ReadonlyArray<string> | undefined
): string | undefined {
  const haystack = [modelId, ...(tags ?? [])].map(normalize);

  const families = [
    "llama",
    "mistral",
    "mixtral",
    "qwen",
    "phi",
    "gemma",
    "deepseek",
    "whisper",
    "bert",
    "t5",
    "clip",
    "sdxl",
    "sd15",
    "sd3",
    "flux",
    "wav2vec",
    "bark",
    "sam",
    "yolo",
  ];

  for (const family of families) {
    if (haystack.some((value) => value.includes(family))) {
      return family;
    }
  }

  return undefined;
}

function determineInputModalities(
  pipelineTag: string | undefined,
  kind: IModel["kind"]
): ReadonlyArray<"text" | "image" | "audio" | "video" | "multimodal" | "generic" | "code"> {
  const tag = normalize(pipelineTag ?? "");

  if (
    [
      "text-generation",
      "text2text-generation",
      "translation",
      "summarization",
      "text-classification",
      "feature-extraction",
    ].includes(tag)
  ) {
    return Object.freeze(["text"]);
  }

  if (tag === "automatic-speech-recognition") {
    return Object.freeze(["audio"]);
  }

  if (tag === "text-to-speech") {
    return Object.freeze(["text"]);
  }

  if (tag === "image-classification" || tag === "image-to-text" || tag === "image-to-image") {
    return Object.freeze(["image"]);
  }

  if (tag === "text-to-image" || tag === "text-to-video") {
    return Object.freeze(["text"]);
  }

  if (kind === "multimodal-model") {
    return Object.freeze(["multimodal"]);
  }

  return Object.freeze(["generic"]);
}

function determineOutputModalities(
  pipelineTag: string | undefined,
  kind: IModel["kind"]
): ReadonlyArray<"text" | "image" | "audio" | "video" | "multimodal" | "generic"> {
  const tag = normalize(pipelineTag ?? "");

  if (
    ["text-generation", "text2text-generation", "translation", "summarization", "image-to-text"].includes(tag)
  ) {
    return Object.freeze(["text"]);
  }

  if (tag === "feature-extraction" || kind === "embedding-model") {
    return Object.freeze(["generic"]);
  }

  if (tag === "automatic-speech-recognition") {
    return Object.freeze(["text"]);
  }

  if (tag === "text-to-speech") {
    return Object.freeze(["audio"]);
  }

  if (tag === "text-to-image" || tag === "image-to-image") {
    return Object.freeze(["image"]);
  }

  if (tag === "text-to-video") {
    return Object.freeze(["video"]);
  }

  return Object.freeze(["generic"]);
}

function determineTasks(
  pipelineTag: string | undefined,
  kind: IModel["kind"]
): ReadonlyArray<ModelTask> {
  const tag = normalize(pipelineTag ?? "");

  if (tag === "text-generation") return Object.freeze(["text-generation", "chat"]);
  if (tag === "text2text-generation") return Object.freeze(["instruction-following", "summarization"]);
  if (tag === "feature-extraction") return Object.freeze(["embedding"]);
  if (tag === "text-classification") return Object.freeze(["classification"]);
  if (tag === "translation") return Object.freeze(["translation"]);
  if (tag === "summarization") return Object.freeze(["summarization"]);
  if (tag === "automatic-speech-recognition") return Object.freeze(["speech-to-text"]);
  if (tag === "text-to-speech") return Object.freeze(["text-to-speech"]);
  if (tag === "text-to-image") return Object.freeze(["image-generation"]);
  if (tag === "image-to-image") return Object.freeze(["image-editing"]);
  if (tag === "text-to-video") return Object.freeze(["video-generation"]);
  if (tag === "image-classification") return Object.freeze(["classification"]);
  if (tag === "image-to-text") return Object.freeze(["image-captioning"]);
  if (tag === "object-detection") return Object.freeze(["object-detection"]);
  if (tag === "image-segmentation") return Object.freeze(["segmentation"]);
  if (kind === "lora") return Object.freeze(["fine-tuning"]);
  return Object.freeze(["generic"]);
}

function determinePreferredExtensions(kind: IModel["kind"]): ReadonlyArray<string> {
  if (
    kind === "lora" ||
    kind === "adapter" ||
    kind === "control-module" ||
    kind === "image-generation-model"
  ) {
    return Object.freeze([".safetensors", ".ckpt", ".bin"]);
  }

  if (kind === "completion-model" || kind === "foundation-model" || kind === "embedding-model") {
    return Object.freeze([".safetensors", ".gguf", ".bin"]);
  }

  if (kind === "vision-model" || kind === "speech-to-text-model" || kind === "text-to-speech-model") {
    return Object.freeze([".safetensors", ".bin", ".onnx"]);
  }

  return Object.freeze([".safetensors", ".gguf", ".onnx", ".bin", ".pt", ".pth"]);
}

function determineArtifactFormat(filePath?: string): IModel["artifact"]["format"] {
  const lower = normalize(filePath ?? "");

  if (lower.endsWith(".safetensors")) return "safetensors";
  if (lower.endsWith(".gguf")) return "gguf";
  if (lower.endsWith(".onnx")) return "onnx";
  if (lower.endsWith(".bin")) return "bin";
  if (lower.endsWith(".pt")) return "pt";
  if (lower.endsWith(".pth")) return "pth";
  if (lower.endsWith(".ckpt")) return "ckpt";

  return "unknown";
}

function scoreFile(filePath: string, preferredExtensions: ReadonlyArray<string>): number {
  const lower = normalize(filePath);

  let score = 0;

  for (const extension of preferredExtensions) {
    if (lower.endsWith(extension)) {
      score += 200;
    }
  }

  if (lower.endsWith(".safetensors")) score += 100;
  if (lower.endsWith(".gguf")) score += 95;
  if (lower.endsWith(".onnx")) score += 90;
  if (lower.endsWith(".bin")) score += 50;
  if (lower.endsWith(".pt")) score += 40;
  if (lower.endsWith(".pth")) score += 35;
  if (lower.endsWith(".ckpt")) score += 25;
  if (lower.includes("model")) score += 10;
  if (lower.includes("pytorch_model")) score += 15;
  if (lower.includes("adapter_model")) score += 12;

  return score;
}

function toArtifacts(
  files: ReadonlyArray<IHuggingFaceModelFileInfo>,
  preferredExtensions: ReadonlyArray<string>
): {
  readonly artifact: ModelArtifact;
  readonly additionalArtifacts: ReadonlyArray<ModelArtifact>;
} {
  const sorted = [...files].sort((left, right) => {
    const scoreDelta = scoreFile(right.path, preferredExtensions) - scoreFile(left.path, preferredExtensions);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return left.path.localeCompare(right.path);
  });

  const [primary, ...rest] = sorted;
  const toArtifact = (file: IHuggingFaceModelFileInfo): ModelArtifact =>
    new ModelArtifact({
      name: file.path,
      accessMethod: "remote-download",
      location: file.path,
      format: determineArtifactFormat(file.path),
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
      contentType: undefined,
    });

  if (!primary) {
    return {
      artifact: new ModelArtifact({
        name: "unknown",
        accessMethod: "remote-api",
        format: "unknown",
      }),
      additionalArtifacts: [],
    };
  }

  return {
    artifact: toArtifact(primary),
    additionalArtifacts: Object.freeze(rest.map(toArtifact)),
  };
}

function buildDescription(info: IHuggingFaceModelInfo | IHuggingFaceModelSearchItem): string | undefined {
  const cardData = "cardData" in info ? info.cardData : undefined;
  const rawDescription =
    typeof cardData?.summary === "string"
      ? cardData.summary
      : typeof cardData?.description === "string"
      ? cardData.description
      : undefined;

  return rawDescription?.trim() || undefined;
}

function createDomainModel(
  info: IHuggingFaceModelInfo | IHuggingFaceModelSearchItem,
  files: ReadonlyArray<IHuggingFaceModelFileInfo> = []
): IModel {
  const kind = determineKind(info.pipeline_tag, info.tags);
  const architectureFamily = determineArchitectureFamily(info.id, info.tags);
  const inputModalities = determineInputModalities(info.pipeline_tag, kind);
  const outputModalities = determineOutputModalities(info.pipeline_tag, kind);
  const tasks = determineTasks(info.pipeline_tag, kind);
  const preferredExtensions = determinePreferredExtensions(kind);
  const artifacts = toArtifacts(files, preferredExtensions);

  return new Model({
    id: info.id,
    name: info.id.split("/").slice(-1)[0] || info.id,
    publisher: info.author,
    kind,
    isRunnable: !["lora", "adapter", "control-module", "tokenizer", "prompt-template"].includes(kind),
    status: info.disabled ? "disabled" : "available",
    source: new ModelSource({
      type: "huggingface",
      sourceId: info.id,
      repository: info.id,
      revision: "sha" in info ? info.sha : undefined,
      url: `https://huggingface.co/${info.id}`,
      providerMetadata: {
        provider: "huggingface",
      },
    }),
    artifact: artifacts.artifact,
    additionalArtifacts: artifacts.additionalArtifacts,
    dependencies: [],
    architectureFamily,
    architecture: architectureFamily,
    compatibility: new ModelCompatibility({
      inputModalities,
      outputModalities,
      supportedTasks: tasks,
      supportedRuntimes: ["transformers", "diffusers", "generic"],
      allowsAnyRuntime: false,
      architectureFamilies: architectureFamily ? [architectureFamily] : [],
      allowsAnyArchitectureFamily: !architectureFamily,
      compatibleAssetTypes:
        kind === "image-generation-model"
          ? ["lora", "vae", "control-module", "adapter"]
          : kind === "completion-model" || kind === "foundation-model"
          ? ["tokenizer", "adapter", "lora"]
          : [],
    }),
    requirements: [],
    resourceProfile: new ModelResourceProfile({
      parameterCount: undefined,
      contextWindowTokens: undefined,
      estimatedMinMemoryBytes: undefined,
      estimatedRecommendedMemoryBytes: undefined,
    }),
    description: buildDescription(info),
    tags: Object.freeze([...(info.tags ?? [])]),
    license: extractLicense(info.tags),
    languageCodes: extractLanguageCodes(info.tags),
    requiresAuth: !!info.private || !!info.gated,
  });
}

function extractLicense(tags: ReadonlyArray<string> | undefined): string | undefined {
  const licenseTag = (tags ?? []).find((tag) => normalize(tag).startsWith("license:"));
  return licenseTag?.split(":")[1]?.trim() || undefined;
}

function extractLanguageCodes(tags: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  const languages = (tags ?? [])
    .filter((tag) => normalize(tag).startsWith("language:"))
    .map((tag) => tag.split(":")[1]?.trim())
    .filter((value): value is string => !!value);

  return Object.freeze(languages);
}

export interface IHuggingFaceModelCatalogOptions {
  readonly apiClient: HuggingFaceApiClient;
}

export class HuggingFaceModelCatalog implements IRemoteModelCatalog {
  private readonly apiClient: HuggingFaceApiClient;

  constructor(options: IHuggingFaceModelCatalogOptions) {
    this.apiClient = options.apiClient;
  }

  public async search(
    criteria?: IRemoteModelCatalogSearchCriteria
  ): Promise<IRemoteModelCatalogSearchResult> {
    const query = criteria?.query?.trim();
    const pipelineTag = this.resolvePipelineTag(criteria);

    const searchItems = await this.apiClient.searchModels({
      query,
      limit: criteria?.limit,
      pipelineTag,
      tags: criteria?.tags,
      full: true,
    });

    const catalogItems = await Promise.all(
      searchItems.map(async (item) => {
        const info = await this.apiClient.getModelInfo(item.id);
        const source = info ?? item;
        const files = await this.apiClient.listModelFiles({
          modelId: item.id,
          revision: info?.sha,
        });
        const model = createDomainModel(source, files);

        return new RemoteModelCatalogItem({
          model,
          remoteId: item.id,
          provider: "huggingface",
          isInstallable: files.length > 0,
          requiresAuth: !!source.private || !!source.gated,
        });
      })
    );

    return new RemoteModelCatalogSearchResult({
      items: catalogItems,
      nextCursor: undefined,
    });
  }

  public async getById(
    id: string,
    provider?: string
  ): Promise<IRemoteModelCatalogItem | undefined> {
    if (provider && !this.supportsProvider(provider)) {
      return undefined;
    }

    const info = await this.apiClient.getModelInfo(id.trim());

    if (!info) {
      return undefined;
    }

    const files = await this.apiClient.listModelFiles({
      modelId: info.id,
      revision: info.sha,
    });

    const model = createDomainModel(info, files);

    return new RemoteModelCatalogItem({
      model,
      remoteId: info.id,
      provider: "huggingface",
      isInstallable: files.length > 0,
      requiresAuth: !!info.private || !!info.gated,
    });
  }

  public supportsProvider(provider: string): boolean {
    return normalize(provider) === "huggingface";
  }

  private resolvePipelineTag(criteria?: IRemoteModelCatalogSearchCriteria): string | undefined {
    if (!criteria) {
      return undefined;
    }

    const tasks = new Set((criteria.tasks ?? []).map(normalize));
    const kinds = new Set((criteria.kinds ?? []).map(normalize));

    if (tasks.has("image-generation") || kinds.has("image-generation-model")) {
      return "text-to-image";
    }

    if (tasks.has("video-generation") || kinds.has("video-generation-model")) {
      return "text-to-video";
    }

    if (tasks.has("speech-to-text") || kinds.has("speech-to-text-model")) {
      return "automatic-speech-recognition";
    }

    if (tasks.has("text-to-speech") || kinds.has("text-to-speech-model")) {
      return "text-to-speech";
    }

    if (tasks.has("embedding") || kinds.has("embedding-model")) {
      return "feature-extraction";
    }

    if (tasks.has("classification") || kinds.has("classifier-model")) {
      return "text-classification";
    }

    if (kinds.has("completion-model") || kinds.has("foundation-model") || tasks.has("chat")) {
      return "text-generation";
    }

    return undefined;
  }
}
