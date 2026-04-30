import { useEffect, useMemo, useState } from "react";

import type { DesktopArtifactBrowseItem } from "../../../lib/desktopApi";
import type { DesktopModelInventoryRecord, DesktopModelTrainingResult } from "../../../lib/desktopApi";
import type { DesktopModelsClient } from "../api/desktopModelsClient";
import { useModelsClient } from "./useModelsClient";

type TrainingStatus = "idle" | "running" | "succeeded" | "failed";

export function useModelTrainingFeature(client?: DesktopModelsClient) {
  const modelClient = useModelsClient(client);

  const [models, setModels] = useState<DesktopModelInventoryRecord[]>([]);
  const [datasetArtifacts, setDatasetArtifacts] = useState<DesktopArtifactBrowseItem[]>([]);
  const [baseModelRecordId, setBaseModelRecordId] = useState("");
  const [selectedDatasetArtifactIds, setSelectedDatasetArtifactIds] = useState<string[]>([]);
  const [method, setMethod] = useState<"lora" | "qlora" | "full-finetune">("lora");
  const [numEpochs, setNumEpochs] = useState("2");
  const [maxSteps, setMaxSteps] = useState("");
  const [batchSize, setBatchSize] = useState("2");
  const [learningRate, setLearningRate] = useState("0.0002");
  const [maxSequenceLength, setMaxSequenceLength] = useState("2048");
  const [seed, setSeed] = useState("42");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loraRank, setLoraRank] = useState("16");
  const [loraAlpha, setLoraAlpha] = useState("32");
  const [loraDropout, setLoraDropout] = useState("0.05");
  const [loraTargetModules, setLoraTargetModules] = useState("q_proj,v_proj");
  const [gradientAccumulationSteps, setGradientAccumulationSteps] = useState("8");
  const [checkpointIntervalSteps, setCheckpointIntervalSteps] = useState("100");
  const [evalIntervalSteps, setEvalIntervalSteps] = useState("100");
  const [outputModelName, setOutputModelName] = useState("my-lora-adapter");
  const [localOutputDirectory, setLocalOutputDirectory] = useState("");
  const [generatedDisplayName, setGeneratedDisplayName] = useState("My LoRA Adapter");
  const [maxShardSize, setMaxShardSize] = useState("2GB");
  const [validateAfterTraining, setValidateAfterTraining] = useState(true);

  const [status, setStatus] = useState<TrainingStatus>("idle");
  const [message, setMessage] = useState<string>();
  const [result, setResult] = useState<DesktopModelTrainingResult>();

  const isMethodSupported = true;

  const datasetArtifactIds = useMemo(() => selectedDatasetArtifactIds, [selectedDatasetArtifactIds]);

  useEffect(() => {
    const load = async () => {
      const listed = await modelClient.listModels({});
      let artifacts: DesktopArtifactBrowseItem[] = [];
      try {
        const { createDesktopArtifactBrowserClient } = await import("../../artifact-browser/api/desktopArtifactBrowserClient");
        artifacts = await createDesktopArtifactBrowserClient().browseArtifacts({});
      } catch {
        artifacts = [];
      }
      setModels(listed);
      setDatasetArtifacts(
        artifacts.filter((artifact) => artifact.mediaType === "application/x-parquet" || artifact.storageKey.toLowerCase().endsWith(".parquet")),
      );
      if (!baseModelRecordId && listed.length > 0) {
        setBaseModelRecordId(listed[0]?.modelRecordId ?? "");
      }
    };
    void load();
  }, [modelClient, baseModelRecordId]);

  const canSubmit = baseModelRecordId.length > 0 && datasetArtifactIds.length > 0 && outputModelName.trim().length > 0 && isMethodSupported && status !== "running";

  const submitTraining = async () => {
    if (!canSubmit) {
      setStatus("failed");
      setMessage("Training requires base model, dataset artifact IDs, and a supported method.");
      return;
    }

    setStatus("running");
    setMessage("Training started...");
    setResult(undefined);

    try {
      const trainingResult = await modelClient.trainModel({
        baseModel: { modelRecordId: baseModelRecordId },
        datasets: datasetArtifactIds.map((artifactId, index) => ({ artifactId, splitRole: index === 0 ? "train" : "validation" })),
        method,
        commonParameters: {
          numEpochs: Number.parseInt(numEpochs, 10) || undefined,
          maxSteps: Number.parseInt(maxSteps, 10) || undefined,
          batchSize: Number.parseInt(batchSize, 10) || undefined,
          learningRate: Number.parseFloat(learningRate) || undefined,
          maxSequenceLength: Number.parseInt(maxSequenceLength, 10) || undefined,
          seed: Number.parseInt(seed, 10) || undefined,
        },
        advancedParameters: {
          gradientAccumulationSteps: Number.parseInt(gradientAccumulationSteps, 10) || undefined,
          checkpointIntervalSteps: Number.parseInt(checkpointIntervalSteps, 10) || undefined,
          evalIntervalSteps: Number.parseInt(evalIntervalSteps, 10) || undefined,
          lora: {
            rank: Number.parseInt(loraRank, 10) || undefined,
            alpha: Number.parseInt(loraAlpha, 10) || undefined,
            dropout: Number.parseFloat(loraDropout) || undefined,
            targetModules: loraTargetModules.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0),
          },
        },
        output: {
          outputModelName,
          localOutputDirectory: localOutputDirectory.trim() || undefined,
          maxShardSize: maxShardSize.trim() || undefined,
          destination: { local: { enabled: true } },
          registration: {
            displayName: generatedDisplayName.trim() || outputModelName,
            artifactForm: method === "full-finetune" ? "full-model" : "adapter",
          },
        },
        validation: { enabled: validateAfterTraining, expectedLoRA: method !== "full-finetune" },
      });

      setResult(trainingResult);
      if (trainingResult.status === "succeeded") {
        setStatus("succeeded");
        setMessage("Training completed.");
        const refreshed = await modelClient.listModels({});
        setModels(refreshed);
      } else if (trainingResult.status === "queued" || trainingResult.status === "running") {
        setStatus("running");
        const configuredEpochs = Number.parseInt(numEpochs, 10) || 0;
        const configuredBatches = Number.parseInt(maxSteps, 10) || 0;
        setMessage(
          `Training ${trainingResult.status}. Run ID: ${trainingResult.runId}. Epoch [0]/[${configuredEpochs}], Batch [0]/[${configuredBatches}]`,
        );
      } else {
        setStatus("failed");
        setMessage(trainingResult.error?.message ?? "Training failed.");
      }
    } catch (error) {
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "Training failed.");
    }
  };

  return {
    models,
    datasetArtifacts,
    baseModelRecordId,
    setBaseModelRecordId,
    selectedDatasetArtifactIds,
    setSelectedDatasetArtifactIds,
    method,
    setMethod,
    numEpochs,
    setNumEpochs,
    maxSteps,
    setMaxSteps,
    batchSize,
    setBatchSize,
    learningRate,
    setLearningRate,
    maxSequenceLength,
    setMaxSequenceLength,
    seed,
    setSeed,
    showAdvanced,
    setShowAdvanced,
    loraRank,
    setLoraRank,
    loraAlpha,
    setLoraAlpha,
    loraDropout,
    setLoraDropout,
    loraTargetModules,
    setLoraTargetModules,
    gradientAccumulationSteps,
    setGradientAccumulationSteps,
    checkpointIntervalSteps,
    setCheckpointIntervalSteps,
    evalIntervalSteps,
    setEvalIntervalSteps,
    outputModelName,
    setOutputModelName,
    localOutputDirectory,
    setLocalOutputDirectory,
    generatedDisplayName,
    setGeneratedDisplayName,
    maxShardSize,
    setMaxShardSize,
    validateAfterTraining,
    setValidateAfterTraining,
    status,
    message,
    result,
    canSubmit,
    isMethodSupported,
    submitTraining,
  };
}
