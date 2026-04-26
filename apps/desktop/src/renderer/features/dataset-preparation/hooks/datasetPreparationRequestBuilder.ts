import type {
  ModelDefaultInferenceMode,
  ResolvedModelDefault,
} from "../../../../../../../modules/contracts/settings";

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
  trainRatio: string;
  testRatio: string;
  shuffle: boolean;
  outputFormat: "jsonl" | "json" | "csv" | "parquet";
  outputBaseName: string;
  localDestinationEnabled: boolean;
  huggingFaceDestinationEnabled: boolean;
  huggingFaceRepository: string;
  huggingFaceRevision: string;
  huggingFacePathPrefix: string;
  parsedSeed: number | undefined;
  parsedChunkSize: number | undefined;
  parsedChunkOverlap: number | undefined;
  parsedMaxChunkCount: number | undefined;
  parsedMaxExamplesPerChunk: number | undefined;
  parsedBatchSize: number | undefined;
  parsedGenerationTemperature: number | undefined;
  parsedGenerationTopP: number | undefined;
  parsedGenerationMaxNewTokens: number | undefined;
  resolvedDefault: ResolvedModelDefault;
}

export function buildDatasetPreparationRequest(input: BuildDatasetPreparationRequestInput) {
  const effectiveModelId = input.modelId.trim() || input.resolvedDefault.modelId;
  const effectiveInferenceMode = input.modelInferenceMode || input.resolvedDefault.inferenceMode;
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
        chunkSize: input.parsedChunkSize as number,
        chunkOverlap: input.parsedChunkOverlap as number,
        preserveDocumentBoundaries: input.preserveDocumentBoundaries,
        maxChunkCount: typeof input.parsedMaxChunkCount === "number" && !Number.isNaN(input.parsedMaxChunkCount)
          ? input.parsedMaxChunkCount
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
        maxExamplesPerChunk: typeof input.parsedMaxExamplesPerChunk === "number" && !Number.isNaN(input.parsedMaxExamplesPerChunk)
          ? input.parsedMaxExamplesPerChunk
          : undefined,
        batchSize: typeof input.parsedBatchSize === "number" && !Number.isNaN(input.parsedBatchSize)
          ? input.parsedBatchSize
          : undefined,
        failurePolicy: input.failurePolicy || undefined,
        generationParams: {
          temperature: typeof input.parsedGenerationTemperature === "number" && !Number.isNaN(input.parsedGenerationTemperature)
            ? input.parsedGenerationTemperature
            : undefined,
          topP: typeof input.parsedGenerationTopP === "number" && !Number.isNaN(input.parsedGenerationTopP)
            ? input.parsedGenerationTopP
            : undefined,
          maxNewTokens: typeof input.parsedGenerationMaxNewTokens === "number" && !Number.isNaN(input.parsedGenerationMaxNewTokens)
            ? input.parsedGenerationMaxNewTokens
            : undefined,
        },
      },
    },
    split: {
      trainRatio: Number(input.trainRatio),
      testRatio: Number(input.testRatio),
      seed: typeof input.parsedSeed === "number" && !Number.isNaN(input.parsedSeed) ? input.parsedSeed : undefined,
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
