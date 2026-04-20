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

export interface UseDatasetPreparationFeatureResult {
  artifacts: Array<{ artifactId: string; storageKey: string; label: string }>;
  selectedArtifactIds: string[];
  template: string;
  trainRatio: string;
  testRatio: string;
  seed: string;
  shuffle: boolean;
  outputFormat: "jsonl" | "json" | "csv";
  status: DatasetPreparationStatus;
  resultSummary?: DatasetPreparationResultSummary;
  onToggleArtifact: (artifactId: string) => void;
  setTemplate: (value: string) => void;
  setTrainRatio: (value: string) => void;
  setTestRatio: (value: string) => void;
  setSeed: (value: string) => void;
  setShuffle: (value: boolean) => void;
  setOutputFormat: (value: "jsonl" | "json" | "csv") => void;
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

function validateInputs(input: {
  selectedArtifactIds: string[];
  template: string;
  trainRatio: string;
  testRatio: string;
  seed: string;
}): string | undefined {
  if (input.selectedArtifactIds.length === 0) {
    return "Select at least one source artifact.";
  }

  if (input.template.trim().length === 0) {
    return "Template is required.";
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

  return undefined;
}

export function useDatasetPreparationFeature(
  options: UseDatasetPreparationFeatureOptions = {},
): UseDatasetPreparationFeatureResult {
  const datasetClient = useDatasetPreparationClient(options.client);
  const [artifacts, setArtifacts] = useState<Array<{ artifactId: string; storageKey: string; label: string }>>([]);
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<string[]>([]);
  const [template, setTemplate] = useState("Prompt: {{text}}");
  const [trainRatio, setTrainRatio] = useState("0.8");
  const [testRatio, setTestRatio] = useState("0.2");
  const [seed, setSeed] = useState("");
  const [shuffle, setShuffle] = useState(true);
  const [outputFormat, setOutputFormat] = useState<"jsonl" | "json" | "csv">("jsonl");
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
      template,
      trainRatio,
      testRatio,
      seed,
    });

    if (validationError) {
      setStatus({ kind: "error", message: validationError });
      return;
    }

    const parsedSeed = parseOptionalNumber(seed);

    setStatus({ kind: "loading", message: "Preparing templated train/test datasets..." });
    setResultSummary(undefined);

    const requestId = createDatasetPreparationRequestId();
    const response = await datasetClient.prepareTemplatedDatasetFromArtifacts(
      {
        sourceArtifactIds: selectedArtifactIds,
        template: template.trim(),
        split: {
          trainRatio: Number(trainRatio),
          testRatio: Number(testRatio),
          seed: typeof parsedSeed === "number" && !Number.isNaN(parsedSeed) ? parsedSeed : undefined,
        },
        shuffle,
        outputFormat,
      },
      { requestId },
    );

    if (!response.ok) {
      setStatus({ kind: "error", message: response.error.message });
      return;
    }

    setStatus({ kind: "success", message: "Templated train/test datasets are ready." });
    setResultSummary({
      trainKey: response.value.train.storage.key,
      testKey: response.value.test.storage.key,
      trainRows: response.value.trainRowCount,
      testRows: response.value.testRowCount,
    });

    await refreshArtifacts();
    options.onPrepared?.();
  }, [
    selectedArtifactIds,
    template,
    trainRatio,
    testRatio,
    seed,
    shuffle,
    outputFormat,
    datasetClient,
    refreshArtifacts,
    options,
  ]);

  return {
    artifacts,
    selectedArtifactIds,
    template,
    trainRatio,
    testRatio,
    seed,
    shuffle,
    outputFormat,
    status,
    resultSummary,
    onToggleArtifact,
    setTemplate,
    setTrainRatio,
    setTestRatio,
    setSeed,
    setShuffle,
    setOutputFormat,
    onSubmit,
  };
}
