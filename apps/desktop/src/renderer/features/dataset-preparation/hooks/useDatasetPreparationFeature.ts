import { useCallback, useEffect, useState, type FormEvent } from "react";

import type { DesktopDatasetPreparationClient } from "../api/desktopDatasetPreparationClient";
import { useDatasetPreparationClient } from "./useDatasetPreparationClient";

interface DatasetPreparationStatus {
  kind: "idle" | "loading" | "success" | "error";
  message?: string;
}

interface DatasetPreparationResultSummary {
  trainKey: string;
  testKey: string;
  trainRows: number;
  testRows: number;
}

const DEFAULT_DATASET_PREPARATION_RECIPE_BASE = {
  normalization: { targetFormat: "markdown" as const },
  chunking: { strategy: "character" as const },
  generation: {
    mode: "qa" as const,
    model: { provider: "transformers" as const },
  },
};

export interface UseDatasetPreparationFeatureResult {
  artifacts: Array<{ artifactId: string; label: string }>;
  selectedArtifactIds: string[];
  unsupportedDocumentPolicy: "" | "fail" | "skip";
  normalizationMode: "" | "best-effort" | "strict";
  chunkSize: string;
  chunkOverlap: string;
  preserveDocumentBoundaries: boolean;
  maxChunkCount: string;
  modelId: string;
  modelDevice: "" | "auto" | "cpu" | "cuda";
  modelTorchDtype: "" | "auto" | "float16" | "bfloat16" | "float32";
  maxExamplesPerChunk: string;
  batchSize: string;
  failurePolicy: "" | "fail" | "skip";
  generationTemperature: string;
  generationTopP: string;
  generationMaxNewTokens: string;
  trainRatio: string;
  testRatio: string;
  seed: string;
  shuffle: boolean;
  outputFormat: "jsonl" | "json" | "csv" | "parquet";
  outputBaseName: string;
  localDestinationEnabled: boolean;
  huggingFaceDestinationEnabled: boolean;
  huggingFaceRepository: string;
  huggingFaceRevision: string;
  huggingFacePathPrefix: string;
  status: DatasetPreparationStatus;
  resultSummary?: DatasetPreparationResultSummary;
  onToggleArtifact: (artifactId: string) => void;
  setUnsupportedDocumentPolicy: (value: "" | "fail" | "skip") => void;
  setNormalizationMode: (value: "" | "best-effort" | "strict") => void;
  setChunkSize: (value: string) => void;
  setChunkOverlap: (value: string) => void;
  setPreserveDocumentBoundaries: (value: boolean) => void;
  setMaxChunkCount: (value: string) => void;
  setModelId: (value: string) => void;
  setModelDevice: (value: "" | "auto" | "cpu" | "cuda") => void;
  setModelTorchDtype: (value: "" | "auto" | "float16" | "bfloat16" | "float32") => void;
  setMaxExamplesPerChunk: (value: string) => void;
  setBatchSize: (value: string) => void;
  setFailurePolicy: (value: "" | "fail" | "skip") => void;
  setGenerationTemperature: (value: string) => void;
  setGenerationTopP: (value: string) => void;
  setGenerationMaxNewTokens: (value: string) => void;
  setTrainRatio: (value: string) => void;
  setTestRatio: (value: string) => void;
  setSeed: (value: string) => void;
  setShuffle: (value: boolean) => void;
  setOutputFormat: (value: "jsonl" | "json" | "csv" | "parquet") => void;
  setOutputBaseName: (value: string) => void;
  setLocalDestinationEnabled: (value: boolean) => void;
  setHuggingFaceDestinationEnabled: (value: boolean) => void;
  setHuggingFaceRepository: (value: string) => void;
  setHuggingFaceRevision: (value: string) => void;
  setHuggingFacePathPrefix: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export interface UseDatasetPreparationFeatureOptions {
  client?: DesktopDatasetPreparationClient;
  onPrepared?: () => void;
}

const TRAIN_TEST_SUM_TOLERANCE = 0.000_001;

function createDatasetPreparationRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `dataset-preparation-${crypto.randomUUID()}`;
  }

  return `dataset-preparation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseOptionalNumber(value: string): number | undefined {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseOptionalInteger(value: string): number | undefined {
  const parsed = parseOptionalNumber(value);
  if (typeof parsed !== "number") {
    return undefined;
  }

  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function validateInputs(input: {
  selectedArtifactIds: string[];
  chunkSize: string;
  chunkOverlap: string;
  maxChunkCount: string;
  modelId: string;
  maxExamplesPerChunk: string;
  batchSize: string;
  generationTemperature: string;
  generationTopP: string;
  generationMaxNewTokens: string;
  trainRatio: string;
  testRatio: string;
  seed: string;
  localDestinationEnabled: boolean;
  huggingFaceDestinationEnabled: boolean;
  huggingFaceRepository: string;
}): string | undefined {
  if (input.selectedArtifactIds.length === 0) {
    return "Select at least one source artifact.";
  }

  if (input.modelId.trim().length === 0) {
    return "Model ID is required.";
  }

  const chunkSize = parseOptionalInteger(input.chunkSize);
  if (typeof chunkSize !== "number" || Number.isNaN(chunkSize) || chunkSize <= 0) {
    return "Chunk size must be a positive integer.";
  }

  const chunkOverlap = parseOptionalInteger(input.chunkOverlap);
  if (typeof chunkOverlap !== "number" || Number.isNaN(chunkOverlap) || chunkOverlap < 0) {
    return "Chunk overlap must be an integer greater than or equal to 0.";
  }

  const maxChunkCount = parseOptionalInteger(input.maxChunkCount);
  if (typeof maxChunkCount === "number" && (Number.isNaN(maxChunkCount) || maxChunkCount <= 0)) {
    return "Max chunk count must be a positive integer when provided.";
  }

  const maxExamplesPerChunk = parseOptionalInteger(input.maxExamplesPerChunk);
  if (typeof maxExamplesPerChunk === "number" && (Number.isNaN(maxExamplesPerChunk) || maxExamplesPerChunk <= 0)) {
    return "Max examples per chunk must be a positive integer when provided.";
  }

  const batchSize = parseOptionalInteger(input.batchSize);
  if (typeof batchSize === "number" && (Number.isNaN(batchSize) || batchSize <= 0)) {
    return "Batch size must be a positive integer when provided.";
  }

  const generationMaxNewTokens = parseOptionalInteger(input.generationMaxNewTokens);
  if (typeof generationMaxNewTokens === "number" && (Number.isNaN(generationMaxNewTokens) || generationMaxNewTokens <= 0)) {
    return "Generation max new tokens must be a positive integer when provided.";
  }

  const generationTemperature = parseOptionalNumber(input.generationTemperature);
  if (typeof generationTemperature === "number" && Number.isNaN(generationTemperature)) {
    return "Generation temperature must be numeric when provided.";
  }

  const generationTopP = parseOptionalNumber(input.generationTopP);
  if (typeof generationTopP === "number" && Number.isNaN(generationTopP)) {
    return "Generation top-p must be numeric when provided.";
  }

  const trainRatio = Number(input.trainRatio);
  if (!Number.isFinite(trainRatio)) {
    return "Train ratio must be a valid number.";
  }

  const testRatio = Number(input.testRatio);
  if (!Number.isFinite(testRatio)) {
    return "Test ratio must be a valid number.";
  }

  if (trainRatio <= 0 || testRatio <= 0) {
    return "Train and test ratios must both be greater than 0.";
  }

  if (Math.abs((trainRatio + testRatio) - 1) > TRAIN_TEST_SUM_TOLERANCE) {
    return "Train and test ratios must sum to 1.0.";
  }

  const parsedSeed = parseOptionalNumber(input.seed);
  if (typeof parsedSeed === "number" && Number.isNaN(parsedSeed)) {
    return "Seed must be numeric when provided.";
  }

  if (!input.localDestinationEnabled && !input.huggingFaceDestinationEnabled) {
    return "Enable at least one output destination.";
  }

  if (input.huggingFaceDestinationEnabled && input.huggingFaceRepository.trim().length === 0) {
    return "Hugging Face repository is required when that destination is enabled.";
  }

  return undefined;
}

export function useDatasetPreparationFeature(
  options: UseDatasetPreparationFeatureOptions = {},
): UseDatasetPreparationFeatureResult {
  const datasetClient = useDatasetPreparationClient(options.client);
  const [artifacts, setArtifacts] = useState<Array<{ artifactId: string; label: string }>>([]);
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<string[]>([]);
  const [unsupportedDocumentPolicy, setUnsupportedDocumentPolicy] = useState<"" | "fail" | "skip">("");
  const [normalizationMode, setNormalizationMode] = useState<"" | "best-effort" | "strict">("");
  const [chunkSize, setChunkSize] = useState("1000");
  const [chunkOverlap, setChunkOverlap] = useState("200");
  const [preserveDocumentBoundaries, setPreserveDocumentBoundaries] = useState(true);
  const [maxChunkCount, setMaxChunkCount] = useState("");
  const [modelId, setModelId] = useState("Qwen/Qwen2.5-1.5B-Instruct");
  const [modelDevice, setModelDevice] = useState<"" | "auto" | "cpu" | "cuda">("auto");
  const [modelTorchDtype, setModelTorchDtype] = useState<"" | "auto" | "float16" | "bfloat16" | "float32">("");
  const [maxExamplesPerChunk, setMaxExamplesPerChunk] = useState("4");
  const [batchSize, setBatchSize] = useState("4");
  const [failurePolicy, setFailurePolicy] = useState<"" | "fail" | "skip">("skip");
  const [generationTemperature, setGenerationTemperature] = useState("");
  const [generationTopP, setGenerationTopP] = useState("");
  const [generationMaxNewTokens, setGenerationMaxNewTokens] = useState("");
  const [trainRatio, setTrainRatio] = useState("0.8");
  const [testRatio, setTestRatio] = useState("0.2");
  const [seed, setSeed] = useState("");
  const [shuffle, setShuffle] = useState(true);
  const [outputFormat, setOutputFormat] = useState<"jsonl" | "json" | "csv" | "parquet">("parquet");
  const [outputBaseName, setOutputBaseName] = useState("");
  const [localDestinationEnabled, setLocalDestinationEnabled] = useState(true);
  const [huggingFaceDestinationEnabled, setHuggingFaceDestinationEnabled] = useState(false);
  const [huggingFaceRepository, setHuggingFaceRepository] = useState("");
  const [huggingFaceRevision, setHuggingFaceRevision] = useState("");
  const [huggingFacePathPrefix, setHuggingFacePathPrefix] = useState("");
  const [status, setStatus] = useState<DatasetPreparationStatus>({ kind: "idle" });
  const [resultSummary, setResultSummary] = useState<DatasetPreparationResultSummary>();

  const refreshArtifacts = useCallback(async () => {
    const sourceArtifacts = await datasetClient.browseSourceArtifacts();
    setArtifacts(sourceArtifacts);
    setSelectedArtifactIds((current) => {
      const validArtifactIds = new Set(sourceArtifacts.map((artifact) => artifact.artifactId));
      return current.filter((artifactId) => validArtifactIds.has(artifactId));
    });
  }, [datasetClient]);

  useEffect(() => {
    void refreshArtifacts().catch((error) => {
      const message = error instanceof Error ? error.message : "Failed to load artifacts.";
      setStatus({ kind: "error", message });
    });
  }, [refreshArtifacts]);

  const onToggleArtifact = useCallback((artifactId: string) => {
    setSelectedArtifactIds((current) =>
      current.includes(artifactId)
        ? current.filter((id) => id !== artifactId)
        : [...current, artifactId]);
  }, []);

  const onSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validateInputs({
      selectedArtifactIds,
      chunkSize,
      chunkOverlap,
      maxChunkCount,
      modelId,
      maxExamplesPerChunk,
      batchSize,
      generationTemperature,
      generationTopP,
      generationMaxNewTokens,
      trainRatio,
      testRatio,
      seed,
      localDestinationEnabled,
      huggingFaceDestinationEnabled,
      huggingFaceRepository,
    });

    if (validationError) {
      setStatus({ kind: "error", message: validationError });
      return;
    }

    const parsedSeed = parseOptionalNumber(seed);
    const parsedChunkSize = parseOptionalInteger(chunkSize);
    const parsedChunkOverlap = parseOptionalInteger(chunkOverlap);
    const parsedMaxChunkCount = parseOptionalInteger(maxChunkCount);
    const parsedMaxExamplesPerChunk = parseOptionalInteger(maxExamplesPerChunk);
    const parsedBatchSize = parseOptionalInteger(batchSize);
    const parsedGenerationTemperature = parseOptionalNumber(generationTemperature);
    const parsedGenerationTopP = parseOptionalNumber(generationTopP);
    const parsedGenerationMaxNewTokens = parseOptionalInteger(generationMaxNewTokens);

    setStatus({ kind: "loading", message: "Preparing training dataset..." });
    setResultSummary(undefined);

    const requestId = createDatasetPreparationRequestId();
    const response = await datasetClient.prepareTrainingDatasetFromArtifacts(
      {
        sourceArtifactIds: selectedArtifactIds,
        recipe: {
          ...DEFAULT_DATASET_PREPARATION_RECIPE_BASE,
          normalization: {
            ...DEFAULT_DATASET_PREPARATION_RECIPE_BASE.normalization,
            unsupportedDocumentPolicy: unsupportedDocumentPolicy || undefined,
            normalizationMode: normalizationMode || undefined,
          },
          chunking: {
            ...DEFAULT_DATASET_PREPARATION_RECIPE_BASE.chunking,
            chunkSize: parsedChunkSize as number,
            chunkOverlap: parsedChunkOverlap as number,
            preserveDocumentBoundaries,
            maxChunkCount: typeof parsedMaxChunkCount === "number" && !Number.isNaN(parsedMaxChunkCount) ? parsedMaxChunkCount : undefined,
          },
          generation: {
            ...DEFAULT_DATASET_PREPARATION_RECIPE_BASE.generation,
            model: {
              ...DEFAULT_DATASET_PREPARATION_RECIPE_BASE.generation.model,
              modelId: modelId.trim(),
              device: modelDevice || undefined,
              torchDtype: modelTorchDtype || undefined,
            },
            maxExamplesPerChunk: typeof parsedMaxExamplesPerChunk === "number" && !Number.isNaN(parsedMaxExamplesPerChunk)
              ? parsedMaxExamplesPerChunk
              : undefined,
            batchSize: typeof parsedBatchSize === "number" && !Number.isNaN(parsedBatchSize)
              ? parsedBatchSize
              : undefined,
            failurePolicy: failurePolicy || undefined,
            generationParams: {
              temperature: typeof parsedGenerationTemperature === "number" && !Number.isNaN(parsedGenerationTemperature)
                ? parsedGenerationTemperature
                : undefined,
              topP: typeof parsedGenerationTopP === "number" && !Number.isNaN(parsedGenerationTopP)
                ? parsedGenerationTopP
                : undefined,
              maxNewTokens: typeof parsedGenerationMaxNewTokens === "number" && !Number.isNaN(parsedGenerationMaxNewTokens)
                ? parsedGenerationMaxNewTokens
                : undefined,
            },
          },
        },
        split: {
          trainRatio: Number(trainRatio),
          testRatio: Number(testRatio),
          seed: typeof parsedSeed === "number" && !Number.isNaN(parsedSeed) ? parsedSeed : undefined,
          shuffle,
        },
        output: {
          format: outputFormat,
          naming: {
            baseName: outputBaseName.trim() || undefined,
          },
          destinations: {
            local: {
              enabled: localDestinationEnabled,
            },
            huggingFace: huggingFaceDestinationEnabled
              ? {
                enabled: true,
                provider: "huggingface",
                repository: huggingFaceRepository.trim(),
                revision: huggingFaceRevision.trim() || undefined,
                pathPrefix: huggingFacePathPrefix.trim() || undefined,
              }
              : undefined,
          },
        },
      },
      { requestId },
    );

    if (!response.ok) {
      setStatus({ kind: "error", message: response.error.message });
      return;
    }

    setStatus({ kind: "success", message: "Training dataset is ready." });
    setResultSummary({
      trainKey: response.value.outputs.local?.train.storage.key ?? "(not produced locally)",
      testKey: response.value.outputs.local?.test.storage.key ?? "(not produced locally)",
      trainRows: response.value.summary.trainRowCount,
      testRows: response.value.summary.testRowCount,
    });

    await refreshArtifacts();
    options.onPrepared?.();
  }, [
    selectedArtifactIds,
    unsupportedDocumentPolicy,
    normalizationMode,
    chunkSize,
    chunkOverlap,
    preserveDocumentBoundaries,
    maxChunkCount,
    modelId,
    modelDevice,
    modelTorchDtype,
    maxExamplesPerChunk,
    batchSize,
    failurePolicy,
    generationTemperature,
    generationTopP,
    generationMaxNewTokens,
    trainRatio,
    testRatio,
    seed,
    shuffle,
    outputFormat,
    outputBaseName,
    localDestinationEnabled,
    huggingFaceDestinationEnabled,
    huggingFaceRepository,
    huggingFaceRevision,
    huggingFacePathPrefix,
    datasetClient,
    refreshArtifacts,
    options,
  ]);

  return {
    artifacts,
    selectedArtifactIds,
    unsupportedDocumentPolicy,
    normalizationMode,
    chunkSize,
    chunkOverlap,
    preserveDocumentBoundaries,
    maxChunkCount,
    modelId,
    modelDevice,
    modelTorchDtype,
    maxExamplesPerChunk,
    batchSize,
    failurePolicy,
    generationTemperature,
    generationTopP,
    generationMaxNewTokens,
    trainRatio,
    testRatio,
    seed,
    shuffle,
    outputFormat,
    outputBaseName,
    localDestinationEnabled,
    huggingFaceDestinationEnabled,
    huggingFaceRepository,
    huggingFaceRevision,
    huggingFacePathPrefix,
    status,
    resultSummary,
    onToggleArtifact,
    setUnsupportedDocumentPolicy,
    setNormalizationMode,
    setChunkSize,
    setChunkOverlap,
    setPreserveDocumentBoundaries,
    setMaxChunkCount,
    setModelId,
    setModelDevice,
    setModelTorchDtype,
    setMaxExamplesPerChunk,
    setBatchSize,
    setFailurePolicy,
    setGenerationTemperature,
    setGenerationTopP,
    setGenerationMaxNewTokens,
    setTrainRatio,
    setTestRatio,
    setSeed,
    setShuffle,
    setOutputFormat,
    setOutputBaseName,
    setLocalDestinationEnabled,
    setHuggingFaceDestinationEnabled,
    setHuggingFaceRepository,
    setHuggingFaceRevision,
    setHuggingFacePathPrefix,
    onSubmit,
  };
}
