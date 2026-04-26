import type {
  ModelDefaultInferenceMode,
  ResolvedModelDefault,
} from "../../../../../../../modules/contracts/settings";
import type { ParsedDatasetPreparationInputs } from "./datasetPreparationRequestValidation";

const DEFAULT_DATASET_PREPARATION_RECIPE_BASE = {
  normalization: { targetFormat: "markdown" as const },
  chunking: { strategy: "character" as const },
  generation: {
    mode: "qa" as const,
    model: { provider: "transformers" as const },
  },
};

export interface BuildDatasetPreparationRequestInput {
  selectedArtifactIds: string[];
  unsupportedDocumentPolicy: "" | "fail" | "skip";
  normalizationMode: "" | "best-effort" | "strict";
  preserveDocumentBoundaries: boolean;
  modelId: string;
  modelInferenceMode: ModelDefaultInferenceMode;
  modelDevice: "" | "auto" | "cpu" | "cuda";
  modelTorchDtype: "" | "auto" | "float16" | "bfloat16" | "float32";
  failurePolicy: "" | "fail" | "skip";
  shuffle: boolean;
  outputFormat: "jsonl" | "json" | "csv" | "parquet";
  outputBaseName: string;
  localDestinationEnabled: boolean;
  huggingFaceDestinationEnabled: boolean;
  huggingFaceRepository: string;
  huggingFaceRevision: string;
  huggingFacePathPrefix: string;
  parsed: ParsedDatasetPreparationInputs;
  resolvedDefault: ResolvedModelDefault;
}

export function buildDatasetPreparationRequest(input: BuildDatasetPreparationRequestInput) {
  const effectiveModelId = input.modelId.trim() || input.resolvedDefault.modelId;
  const effectiveInferenceMode = input.modelInferenceMode;
  const effectiveDevice = input.modelDevice || input.resolvedDefault.device;
  const effectiveTorchDtype = input.modelTorchDtype || input.resolvedDefault.torchDtype;

  return {
    sourceArtifactIds: input.selectedArtifactIds,
    recipe: {
      ...DEFAULT_DATASET_PREPARATION_RECIPE_BASE,
      normalization: {
        ...DEFAULT_DATASET_PREPARATION_RECIPE_BASE.normalization,
        unsupportedDocumentPolicy: input.unsupportedDocumentPolicy || undefined,
        normalizationMode: input.normalizationMode || undefined,
      },
      chunking: {
        ...DEFAULT_DATASET_PREPARATION_RECIPE_BASE.chunking,
        chunkSize: input.parsed.chunkSize,
        chunkOverlap: input.parsed.chunkOverlap,
        preserveDocumentBoundaries: input.preserveDocumentBoundaries,
        maxChunkCount: typeof input.parsed.maxChunkCount === "number" && !Number.isNaN(input.parsed.maxChunkCount)
          ? input.parsed.maxChunkCount
          : undefined,
      },
      generation: {
        ...DEFAULT_DATASET_PREPARATION_RECIPE_BASE.generation,
        model: {
          ...DEFAULT_DATASET_PREPARATION_RECIPE_BASE.generation.model,
          modelId: effectiveModelId,
          inferenceMode: effectiveInferenceMode,
          device: effectiveDevice || undefined,
          torchDtype: effectiveTorchDtype || undefined,
        },
        maxExamplesPerChunk: typeof input.parsed.maxExamplesPerChunk === "number" && !Number.isNaN(input.parsed.maxExamplesPerChunk)
          ? input.parsed.maxExamplesPerChunk
          : undefined,
        batchSize: typeof input.parsed.batchSize === "number" && !Number.isNaN(input.parsed.batchSize)
          ? input.parsed.batchSize
          : undefined,
        failurePolicy: input.failurePolicy || undefined,
        generationParams: {
          temperature: typeof input.parsed.generationTemperature === "number" && !Number.isNaN(input.parsed.generationTemperature)
            ? input.parsed.generationTemperature
            : undefined,
          topP: typeof input.parsed.generationTopP === "number" && !Number.isNaN(input.parsed.generationTopP)
            ? input.parsed.generationTopP
            : undefined,
          maxNewTokens: typeof input.parsed.generationMaxNewTokens === "number" && !Number.isNaN(input.parsed.generationMaxNewTokens)
            ? input.parsed.generationMaxNewTokens
            : undefined,
        },
      },
    },
    split: {
      trainRatio: input.parsed.trainRatio,
      testRatio: input.parsed.testRatio,
      seed: typeof input.parsed.seed === "number" && !Number.isNaN(input.parsed.seed) ? input.parsed.seed : undefined,
      shuffle: input.shuffle,
    },
    output: {
      format: input.outputFormat,
      naming: {
        baseName: input.outputBaseName.trim() || undefined,
      },
      destinations: {
        local: {
          enabled: input.localDestinationEnabled,
        },
        huggingFace: input.huggingFaceDestinationEnabled
          ? {
            enabled: true,
            provider: "huggingface" as const,
            repository: input.huggingFaceRepository.trim(),
            revision: input.huggingFaceRevision.trim() || undefined,
            pathPrefix: input.huggingFacePathPrefix.trim() || undefined,
          }
          : undefined,
      },
    },
  };
}
