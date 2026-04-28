import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import type { ModelDefaultInferenceMode } from "../../../../../../../modules/contracts/settings";
import { createDesktopApplicationSettingsClient, type DesktopApplicationSettingsClient } from "../../settings";
import { createDesktopPythonRuntimeClient, type DesktopPythonRuntimeClient } from "../../python-runtime/api/desktopPythonRuntimeClient";
import type { DesktopDatasetPreparationClient } from "../api/desktopDatasetPreparationClient";
import { buildDatasetPreparationRequest } from "./datasetPreparationRequestBuilder";
import {
  validateAndParseDatasetPreparationInputs,
} from "./datasetPreparationRequestValidation";
import {
  resolveLatestDatasetPreparationChunkProgress,
  resolveLatestModelDownloadProgress,
  resolveModelInMemoryLoadMessage,
  sawPythonRuntimeStartup,
} from "./modelDownloadProgress";
import { useDatasetPreparationClient } from "./useDatasetPreparationClient";

interface DatasetPreparationStatus {
  kind: "idle" | "loading" | "success" | "error";
  message?: string;
}

interface DatasetPreparationResultSummary {
  datasetKey: string;
  datasetRows: number;
}

interface DatasetPreparationPageState {
  selectedArtifactStorageFilter: DatasetPreparationArtifactStorageFilter;
  selectedArtifactIds: string[];
  unsupportedDocumentPolicy: "" | "fail" | "skip";
  normalizationMode: "" | "best-effort" | "strict";
  chunkSize: string;
  chunkOverlap: string;
  preserveDocumentBoundaries: boolean;
  maxChunkCount: string;
  modelId: string;
  modelInferenceMode: ModelDefaultInferenceMode;
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
}

export type DatasetPreparationArtifactStorageFilter = "all" | "uploaded" | "generated";

export interface UseDatasetPreparationFeatureResult {
  artifacts: Array<{ artifactId: string; label: string; storageKey: string }>;
  filteredArtifacts: Array<{ artifactId: string; label: string; storageKey: string }>;
  uploadedArtifacts: Array<{ artifactId: string; label: string; storageKey: string }>;
  generatedArtifacts: Array<{ artifactId: string; label: string; storageKey: string }>;
  selectedArtifactStorageFilter: DatasetPreparationArtifactStorageFilter;
  selectedArtifactIds: string[];
  unsupportedDocumentPolicy: "" | "fail" | "skip";
  normalizationMode: "" | "best-effort" | "strict";
  chunkSize: string;
  chunkOverlap: string;
  preserveDocumentBoundaries: boolean;
  maxChunkCount: string;
  modelId: string;
  modelInferenceMode: ModelDefaultInferenceMode;
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
  defaultHuggingFaceNamespace?: string;
  status: DatasetPreparationStatus;
  resultSummary?: DatasetPreparationResultSummary;
  loadedModelCount: number;
  canUnloadModel: boolean;
  stopTrainingInFlight: boolean;
  unloadModelInFlight: boolean;
  onToggleArtifact: (artifactId: string) => void;
  setSelectedArtifactStorageFilter: (value: DatasetPreparationArtifactStorageFilter) => void;
  setUnsupportedDocumentPolicy: (value: "" | "fail" | "skip") => void;
  setNormalizationMode: (value: "" | "best-effort" | "strict") => void;
  setChunkSize: (value: string) => void;
  setChunkOverlap: (value: string) => void;
  setPreserveDocumentBoundaries: (value: boolean) => void;
  setMaxChunkCount: (value: string) => void;
  setModelId: (value: string) => void;
  setModelInferenceMode: (value: ModelDefaultInferenceMode) => void;
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
  onStopTraining: () => Promise<void>;
  onUnloadModel: () => Promise<void>;
}

export interface UseDatasetPreparationFeatureOptions {
  client?: DesktopDatasetPreparationClient;
  settingsClient?: DesktopApplicationSettingsClient;
  runtimeStatusClient?: Pick<DesktopPythonRuntimeClient, "readStatus" | "controlRuntime">;
  onPrepared?: () => void;
}

const defaultDatasetPreparationPageState: DatasetPreparationPageState = {
  selectedArtifactStorageFilter: "all",
  selectedArtifactIds: [],
  unsupportedDocumentPolicy: "",
  normalizationMode: "",
  chunkSize: "1000",
  chunkOverlap: "200",
  preserveDocumentBoundaries: true,
  maxChunkCount: "",
  modelId: "",
  modelInferenceMode: "auto",
  modelDevice: "auto",
  modelTorchDtype: "",
  maxExamplesPerChunk: "4",
  batchSize: "4",
  failurePolicy: "skip",
  generationTemperature: "",
  generationTopP: "",
  generationMaxNewTokens: "",
  trainRatio: "0.8",
  testRatio: "0.2",
  seed: "",
  shuffle: true,
  outputFormat: "parquet",
  outputBaseName: "",
  localDestinationEnabled: true,
  huggingFaceDestinationEnabled: false,
  huggingFaceRepository: "",
  huggingFaceRevision: "",
  huggingFacePathPrefix: "",
  status: { kind: "idle" },
  resultSummary: undefined,
};

let cachedDatasetPreparationPageState: DatasetPreparationPageState = { ...defaultDatasetPreparationPageState };

export function resetDatasetPreparationPageStateForTests(): void {
  cachedDatasetPreparationPageState = { ...defaultDatasetPreparationPageState };
}

function createDatasetPreparationRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `dataset-preparation-${crypto.randomUUID()}`;
  }

  return `dataset-preparation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function appendErrorDetailsMessage(message: string, details: Record<string, unknown> | undefined): string {
  if (!details) {
    return message;
  }

  const reason = typeof details.reason === "string" ? details.reason : undefined;
  const status = typeof details.providerStatusCode === "number" ? details.providerStatusCode : undefined;
  const repository = typeof details.repository === "string" ? details.repository : undefined;
  const pathInRepo = typeof details.pathInRepo === "string" ? details.pathInRepo : undefined;
  const suffix = [reason, status ? `status ${status}` : undefined, repository, pathInRepo]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" | ");
  return suffix ? `${message} Details: ${suffix}.` : message;
}


export function useDatasetPreparationFeature(
  options: UseDatasetPreparationFeatureOptions = {},
): UseDatasetPreparationFeatureResult {
  const onPrepared = options.onPrepared;
  const datasetClient = useDatasetPreparationClient(options.client);
  const settingsClient = useMemo(() => {
    if (options.settingsClient) {
      return options.settingsClient;
    }
    try {
      return createDesktopApplicationSettingsClient();
    } catch {
      return undefined;
    }
  }, [options.settingsClient]);
  const runtimeStatusClient = useMemo(() => {
    if (options.runtimeStatusClient) {
      return options.runtimeStatusClient;
    }
    try {
      return createDesktopPythonRuntimeClient();
    } catch {
      return undefined;
    }
  }, [options.runtimeStatusClient]);
  const [artifacts, setArtifacts] = useState<Array<{ artifactId: string; label: string; storageKey: string }>>([]);
  const [selectedArtifactStorageFilter, setSelectedArtifactStorageFilter] =
    useState<DatasetPreparationArtifactStorageFilter>(cachedDatasetPreparationPageState.selectedArtifactStorageFilter);
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<string[]>(cachedDatasetPreparationPageState.selectedArtifactIds);
  const [unsupportedDocumentPolicy, setUnsupportedDocumentPolicy] = useState<"" | "fail" | "skip">(cachedDatasetPreparationPageState.unsupportedDocumentPolicy);
  const [normalizationMode, setNormalizationMode] = useState<"" | "best-effort" | "strict">(cachedDatasetPreparationPageState.normalizationMode);
  const [chunkSize, setChunkSize] = useState(cachedDatasetPreparationPageState.chunkSize);
  const [chunkOverlap, setChunkOverlap] = useState(cachedDatasetPreparationPageState.chunkOverlap);
  const [preserveDocumentBoundaries, setPreserveDocumentBoundaries] = useState(cachedDatasetPreparationPageState.preserveDocumentBoundaries);
  const [maxChunkCount, setMaxChunkCount] = useState(cachedDatasetPreparationPageState.maxChunkCount);
  const [modelId, setModelId] = useState(cachedDatasetPreparationPageState.modelId);
  const [modelInferenceMode, setModelInferenceMode] = useState<ModelDefaultInferenceMode>(cachedDatasetPreparationPageState.modelInferenceMode);
  const [modelDevice, setModelDevice] = useState<"" | "auto" | "cpu" | "cuda">(cachedDatasetPreparationPageState.modelDevice);
  const [modelTorchDtype, setModelTorchDtype] = useState<"" | "auto" | "float16" | "bfloat16" | "float32">(cachedDatasetPreparationPageState.modelTorchDtype);
  const [maxExamplesPerChunk, setMaxExamplesPerChunk] = useState(cachedDatasetPreparationPageState.maxExamplesPerChunk);
  const [batchSize, setBatchSize] = useState(cachedDatasetPreparationPageState.batchSize);
  const [failurePolicy, setFailurePolicy] = useState<"" | "fail" | "skip">(cachedDatasetPreparationPageState.failurePolicy);
  const [generationTemperature, setGenerationTemperature] = useState(cachedDatasetPreparationPageState.generationTemperature);
  const [generationTopP, setGenerationTopP] = useState(cachedDatasetPreparationPageState.generationTopP);
  const [generationMaxNewTokens, setGenerationMaxNewTokens] = useState(cachedDatasetPreparationPageState.generationMaxNewTokens);
  const [trainRatio, setTrainRatio] = useState(cachedDatasetPreparationPageState.trainRatio);
  const [testRatio, setTestRatio] = useState(cachedDatasetPreparationPageState.testRatio);
  const [seed, setSeed] = useState(cachedDatasetPreparationPageState.seed);
  const [shuffle, setShuffle] = useState(cachedDatasetPreparationPageState.shuffle);
  const [outputFormat, setOutputFormat] = useState<"jsonl" | "json" | "csv" | "parquet">(cachedDatasetPreparationPageState.outputFormat);
  const [outputBaseName, setOutputBaseName] = useState(cachedDatasetPreparationPageState.outputBaseName);
  const [localDestinationEnabled, setLocalDestinationEnabled] = useState(cachedDatasetPreparationPageState.localDestinationEnabled);
  const [huggingFaceDestinationEnabled, setHuggingFaceDestinationEnabled] = useState(cachedDatasetPreparationPageState.huggingFaceDestinationEnabled);
  const [huggingFaceRepository, setHuggingFaceRepository] = useState(cachedDatasetPreparationPageState.huggingFaceRepository);
  const [huggingFaceRevision, setHuggingFaceRevision] = useState(cachedDatasetPreparationPageState.huggingFaceRevision);
  const [huggingFacePathPrefix, setHuggingFacePathPrefix] = useState(cachedDatasetPreparationPageState.huggingFacePathPrefix);
  const [status, setStatus] = useState<DatasetPreparationStatus>(cachedDatasetPreparationPageState.status);
  const [resultSummary, setResultSummary] = useState<DatasetPreparationResultSummary | undefined>(cachedDatasetPreparationPageState.resultSummary);
  const [defaultHuggingFaceNamespace, setDefaultHuggingFaceNamespace] = useState<string | undefined>(undefined);
  const [loadedModelCount, setLoadedModelCount] = useState(0);
  const [runtimeActiveTaskCount, setRuntimeActiveTaskCount] = useState(0);
  const [stopTrainingInFlight, setStopTrainingInFlight] = useState(false);
  const [unloadModelInFlight, setUnloadModelInFlight] = useState(false);
  const stopTrainingRequestedRef = useRef(false);

  useEffect(() => {
    cachedDatasetPreparationPageState = {
      selectedArtifactStorageFilter,
      selectedArtifactIds,
      unsupportedDocumentPolicy,
      normalizationMode,
      chunkSize,
      chunkOverlap,
      preserveDocumentBoundaries,
      maxChunkCount,
      modelId,
      modelInferenceMode,
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
    };
  }, [
    selectedArtifactStorageFilter,
    selectedArtifactIds,
    unsupportedDocumentPolicy,
    normalizationMode,
    chunkSize,
    chunkOverlap,
    preserveDocumentBoundaries,
    maxChunkCount,
    modelId,
    modelInferenceMode,
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
  ]);

  const setStatusWarningMessage = useCallback((warningMessage: string) => {
    setStatus((current) => {
      const existingMessage = current.message?.trim();
      const nextMessage = existingMessage && existingMessage.length > 0
        ? `${existingMessage} ${warningMessage}`
        : warningMessage;
      return { kind: current.kind, message: nextMessage };
    });
  }, []);

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

  useEffect(() => {
    if (!settingsClient) {
      return;
    }

    void settingsClient.resolveModelDefault({
      taskKey: "qaGeneration",
      featureKey: "datasetPreparation",
    }).then((result) => {
      setModelId((current) => current || result.resolved.modelId);
      setModelInferenceMode(result.resolved.inferenceMode);
      setModelDevice(result.resolved.device ?? "auto");
      setModelTorchDtype(result.resolved.torchDtype ?? "");
    }).catch(() => {
      setStatusWarningMessage("Using built-in model defaults because settings could not be loaded.");
    });

    void settingsClient.readSettings({ keys: ["huggingface.defaultNamespace"] }).then((result) => {
      const namespace = result.values.find((value) => value.key === "huggingface.defaultNamespace")?.value;
      if (typeof namespace === "string" && namespace.trim().length > 0) {
        setDefaultHuggingFaceNamespace(namespace.trim());
      }
    }).catch(() => {
      setStatusWarningMessage("Hugging Face namespace default could not be loaded.");
    });
  }, [settingsClient, setStatusWarningMessage]);

  const refreshRuntimeModelStatus = useCallback(async () => {
    if (!runtimeStatusClient) {
      return;
    }

    try {
      const snapshot = await runtimeStatusClient.readStatus();
      setLoadedModelCount(snapshot.loadedModels.length);
      setRuntimeActiveTaskCount(snapshot.activeTaskCount);
    } catch {
      // Runtime status is best-effort for model lifecycle controls.
    }
  }, [runtimeStatusClient]);

  useEffect(() => {
    void refreshRuntimeModelStatus();
    const timer = window.setInterval(() => {
      void refreshRuntimeModelStatus();
    }, 5_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [refreshRuntimeModelStatus]);

  const onToggleArtifact = useCallback((artifactId: string) => {
    setSelectedArtifactIds((current) =>
      current.includes(artifactId)
        ? current.filter((id) => id !== artifactId)
        : [...current, artifactId]);
  }, []);

  const uploadedArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.storageKey.startsWith("uploads/")),
    [artifacts],
  );
  const generatedArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.storageKey.startsWith("generated/")),
    [artifacts],
  );
  const filteredArtifacts = useMemo(() => {
    if (selectedArtifactStorageFilter === "uploaded") {
      return uploadedArtifacts;
    }
    if (selectedArtifactStorageFilter === "generated") {
      return generatedArtifacts;
    }
    return artifacts;
  }, [artifacts, generatedArtifacts, selectedArtifactStorageFilter, uploadedArtifacts]);

  const onSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationResult = validateAndParseDatasetPreparationInputs({
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
      defaultHuggingFaceNamespace,
    });

    if (validationResult.ok === false) {
      setStatus({ kind: "error", message: validationResult.error });
      return;
    }

    stopTrainingRequestedRef.current = false;
    setStatus({ kind: "loading", message: "Resolving generation model settings..." });
    setResultSummary(undefined);

    const resolvedDefault = await (settingsClient?.resolveModelDefault({
      taskKey: "qaGeneration",
      featureKey: "datasetPreparation",
    }) ?? Promise.reject(new Error("settings unavailable"))).then((result) => result.resolved).catch(() => ({
      provider: "transformers" as const,
      modelId: "google/flan-t5-base",
      inferenceMode: "auto" as const,
      source: "builtin" as const,
      device: undefined,
      torchDtype: undefined,
    }));
    const request = buildDatasetPreparationRequest({
      selectedArtifactIds,
      unsupportedDocumentPolicy,
      normalizationMode,
      preserveDocumentBoundaries,
      modelId,
      modelInferenceMode,
      modelDevice,
      modelTorchDtype,
      failurePolicy,
      shuffle,
      outputFormat,
      outputBaseName,
      localDestinationEnabled,
      huggingFaceDestinationEnabled,
      huggingFaceRepository,
      huggingFaceRevision,
      huggingFacePathPrefix,
      defaultHuggingFaceNamespace,
      parsed: validationResult.parsed,
      resolvedDefault,
    });
    const generationModelId = request.recipe.generation.model.modelId;
    const requestId = createDatasetPreparationRequestId();
    const progressStartedAtMs = Date.now();
    let preparationActive = true;
    let progressReadInFlight = false;
    let runtimeTaskObserved = false;
    let recoveringProgressMonitor = false;
    const refreshModelDownloadProgress = async () => {
      if (!runtimeStatusClient || progressReadInFlight || !preparationActive) {
        return;
      }

      progressReadInFlight = true;
      try {
        const snapshot = await runtimeStatusClient.readStatus();
        if (!preparationActive) {
          return;
        }
        recoveringProgressMonitor = false;

        if (snapshot.activeTaskCount > 0) {
          runtimeTaskObserved = true;
        }

        const chunkProgress = resolveLatestDatasetPreparationChunkProgress(snapshot, {
          sinceEpochMs: progressStartedAtMs,
        });
        if (chunkProgress) {
          setStatus({ kind: "loading", message: chunkProgress.message });
          return;
        }

        const downloadProgress = resolveLatestModelDownloadProgress(snapshot, generationModelId, {
          sinceEpochMs: progressStartedAtMs,
        });
        if (downloadProgress) {
          setStatus({ kind: "loading", message: downloadProgress.message });
          return;
        }

        const modelInMemoryMessage = resolveModelInMemoryLoadMessage(snapshot, generationModelId, {
          sinceEpochMs: progressStartedAtMs,
        });
        if (modelInMemoryMessage) {
          setStatus({ kind: "loading", message: modelInMemoryMessage });
          return;
        }

        if ((snapshot.supervisorStatus === "starting" || sawPythonRuntimeStartup(snapshot, { sinceEpochMs: progressStartedAtMs }))) {
          setStatus({ kind: "loading", message: "Starting Python runtime environment..." });
          return;
        }

        if (huggingFaceDestinationEnabled && runtimeTaskObserved && snapshot.activeTaskCount === 0) {
          setStatus({ kind: "loading", message: "Publishing to HuggingFace..." });
          return;
        }
      } catch {
        if (!preparationActive || recoveringProgressMonitor) {
          return;
        }

        recoveringProgressMonitor = true;
        setStatus({ kind: "loading", message: "Reconnecting to progress monitor..." });
      } finally {
        progressReadInFlight = false;
      }
    };

    window.dispatchEvent(new CustomEvent("dataset-preparation-training-started"));
    setStatus({ kind: "loading", message: `Checking model ${generationModelId} before dataset preparation...` });
    void refreshModelDownloadProgress();
    const progressTimer = window.setInterval(() => {
      void refreshModelDownloadProgress();
    }, 750);

    let response: Awaited<ReturnType<DesktopDatasetPreparationClient["prepareTrainingDatasetFromArtifacts"]>>;
    try {
      response = await datasetClient.prepareTrainingDatasetFromArtifacts(
        request,
        { requestId },
      );
    } catch (error) {
      if (stopTrainingRequestedRef.current) {
        setStatus({ kind: "idle", message: "Training stopped." });
      } else if (runtimeStatusClient && error instanceof Error && error.message.toLowerCase().includes("failed to fetch")) {
        try {
          const snapshot = await runtimeStatusClient.readStatus();
          if (snapshot.activeTaskCount > 0) {
            setStatus({ kind: "loading", message: "Dataset preparation is still running in the background…" });
            return;
          }
        } catch {
          // Runtime status probe is best-effort when the request transport fails.
        }
        setStatus({ kind: "error", message: error.message });
      } else {
        setStatus({ kind: "error", message: error instanceof Error ? error.message : "Dataset preparation failed." });
      }
      return;
    } finally {
      preparationActive = false;
      window.clearInterval(progressTimer);
      void refreshRuntimeModelStatus();
    }

    if (response.ok === false) {
      setStatus(stopTrainingRequestedRef.current
        ? { kind: "idle", message: "Training stopped." }
        : { kind: "error", message: appendErrorDetailsMessage(response.error.message, response.error.details) });
      return;
    }

    setStatus({ kind: "success", message: "Training dataset is ready." });
    setResultSummary({
      datasetKey: response.value.outputs.local?.dataset.storage.key ?? "(not produced locally)",
      datasetRows: response.value.summary.datasetRowCount ?? response.value.summary.generatedExampleCount,
    });

    await refreshArtifacts();
    await refreshRuntimeModelStatus();
    onPrepared?.();
  }, [
    selectedArtifactIds,
    unsupportedDocumentPolicy,
    normalizationMode,
    chunkSize,
    chunkOverlap,
    preserveDocumentBoundaries,
    maxChunkCount,
    modelId,
    modelInferenceMode,
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
    defaultHuggingFaceNamespace,
    huggingFaceRevision,
    huggingFacePathPrefix,
    datasetClient,
    settingsClient,
    runtimeStatusClient,
    refreshArtifacts,
    refreshRuntimeModelStatus,
    onPrepared,
  ]);

  const onStopTraining = useCallback(async () => {
    if (!runtimeStatusClient?.controlRuntime || status.kind !== "loading") {
      return;
    }

    stopTrainingRequestedRef.current = true;
    setStopTrainingInFlight(true);
    setStatus({ kind: "loading", message: "Stopping training..." });
    try {
      const snapshot = await runtimeStatusClient.controlRuntime("stop");
      setLoadedModelCount(snapshot.loadedModels.length);
      setRuntimeActiveTaskCount(snapshot.activeTaskCount);
      setStatus({ kind: "idle", message: "Training stopped." });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Failed to stop training." });
    } finally {
      setStopTrainingInFlight(false);
      void refreshRuntimeModelStatus();
    }
  }, [refreshRuntimeModelStatus, runtimeStatusClient, status.kind]);

  const onUnloadModel = useCallback(async () => {
    if (!runtimeStatusClient?.controlRuntime || status.kind === "loading") {
      return;
    }

    setUnloadModelInFlight(true);
    try {
      const snapshot = await runtimeStatusClient.controlRuntime("unload-model");
      setLoadedModelCount(snapshot.loadedModels.length);
      setRuntimeActiveTaskCount(snapshot.activeTaskCount);
      setStatus({ kind: "idle", message: "Model unloaded from memory." });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Failed to unload model." });
    } finally {
      setUnloadModelInFlight(false);
      void refreshRuntimeModelStatus();
    }
  }, [refreshRuntimeModelStatus, runtimeStatusClient, status.kind]);

  const canUnloadModel = loadedModelCount > 0 && runtimeActiveTaskCount === 0 && status.kind !== "loading";

  return {
    artifacts,
    filteredArtifacts,
    uploadedArtifacts,
    generatedArtifacts,
    selectedArtifactStorageFilter,
    selectedArtifactIds,
    unsupportedDocumentPolicy,
    normalizationMode,
    chunkSize,
    chunkOverlap,
    preserveDocumentBoundaries,
    maxChunkCount,
    modelId,
    modelInferenceMode,
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
    defaultHuggingFaceNamespace,
    status,
    resultSummary,
    loadedModelCount,
    canUnloadModel,
    stopTrainingInFlight,
    unloadModelInFlight,
    onToggleArtifact,
    setSelectedArtifactStorageFilter,
    setUnsupportedDocumentPolicy,
    setNormalizationMode,
    setChunkSize,
    setChunkOverlap,
    setPreserveDocumentBoundaries,
    setMaxChunkCount,
    setModelId,
    setModelInferenceMode,
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
    onStopTraining,
    onUnloadModel,
  };
}
