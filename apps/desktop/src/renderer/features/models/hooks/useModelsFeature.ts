import { useCallback, useEffect, useMemo, useState } from "react";

import type { ModelArtifactForm, ModelLifecycleStatus, ModelSource, ModelTaskTag } from "../../../../../../../modules/contracts/model";
import type { DesktopModelBrowseItem, DesktopModelDetailsResult, DesktopModelInventoryRecord } from "../../../lib/desktopApi";
import type { DesktopModelsClient } from "../api/desktopModelsClient";
import { useModelsClient } from "./useModelsClient";

interface ViewState {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
}

function normalizeOptionalNumber(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeOptionalTaskTag(value: string): ModelTaskTag | undefined {
  const normalized = value.trim().toLowerCase();
  const allowed: ModelTaskTag[] = ["text-generation", "text2text-generation", "chat", "embeddings", "classification", "summarization", "question-answering", "code-generation"];
  return allowed.includes(normalized as ModelTaskTag) ? normalized as ModelTaskTag : undefined;
}

function normalizeOptionalSelect<TOption extends string>(value: string, options: readonly TOption[]): TOption | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return options.includes(normalized as TOption) ? normalized as TOption : undefined;
}

export function useModelsFeature(client?: DesktopModelsClient) {
  const modelClient = useModelsClient(client);
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseTaskTag, setBrowseTaskTag] = useState("");
  const [browseLimit, setBrowseLimit] = useState("25");
  const [browseState, setBrowseState] = useState<ViewState>({ status: "idle" });
  const [browseItems, setBrowseItems] = useState<DesktopModelBrowseItem[]>([]);
  const [selectedBrowseModel, setSelectedBrowseModel] = useState<DesktopModelBrowseItem>();
  const [selectedBrowseModelDetails, setSelectedBrowseModelDetails] = useState<DesktopModelDetailsResult["model"]>();
  const [saveState, setSaveState] = useState<ViewState>({ status: "idle" });

  const [manageState, setManageState] = useState<ViewState>({ status: "idle" });
  const [models, setModels] = useState<DesktopModelInventoryRecord[]>([]);
  const [manageSource, setManageSource] = useState("");
  const [manageLifecycleStatus, setManageLifecycleStatus] = useState("");
  const [manageArtifactForm, setManageArtifactForm] = useState("");
  const [manageSearch, setManageSearch] = useState("");
  const [selectedManagedModel, setSelectedManagedModel] = useState<DesktopModelInventoryRecord>();
  const [pendingDeleteModelRecordId, setPendingDeleteModelRecordId] = useState<string>();
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [publishRepository, setPublishRepository] = useState("");

  const searchModels = useCallback(async () => {
    setBrowseState({ status: "loading", message: "Searching models..." });
    try {
      const taskTag = normalizeOptionalTaskTag(browseTaskTag);
      const result = await modelClient.browseModels({
        provider: "huggingface",
        query: browseQuery || undefined,
        taskTags: taskTag ? [taskTag] : undefined,
        limit: normalizeOptionalNumber(browseLimit),
      });
      setBrowseItems(result.models);
      setBrowseState({ status: "success", message: result.models.length > 0 ? "Loaded model results." : "No model results found." });
    } catch (error) {
      setBrowseState({ status: "error", message: error instanceof Error ? error.message : "Failed to browse models." });
    }
  }, [browseLimit, browseQuery, browseTaskTag, modelClient]);

  const selectBrowseModel = useCallback(async (model: DesktopModelBrowseItem) => {
    setSelectedBrowseModel(model);
    setSelectedBrowseModelDetails(undefined);
    try {
      const details = await modelClient.getModelDetails({ provider: "huggingface", modelId: model.modelId });
      setSelectedBrowseModelDetails(details);
    } catch {
      setSelectedBrowseModelDetails(undefined);
    }
  }, [modelClient]);

  const saveModelReference = useCallback(async () => {
    if (!selectedBrowseModel) {
      return;
    }
    setSaveState({ status: "loading", message: "Saving model reference..." });
    try {
      await modelClient.saveModelReference({
        modelId: selectedBrowseModel.modelId,
        displayName: selectedBrowseModel.displayName,
        inferenceMode: selectedBrowseModel.inferenceMode,
        taskTags: selectedBrowseModel.taskTags,
        metadata: {
          source: "huggingface",
          likes: selectedBrowseModel.likes,
          downloads: selectedBrowseModel.downloads,
          gated: selectedBrowseModel.gated,
          private: selectedBrowseModel.private,
          license: selectedBrowseModel.license,
        },
      });
      setSaveState({ status: "success", message: "Model reference saved." });
      await refreshModels();
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "Failed to save model reference." });
    }
  }, [modelClient, selectedBrowseModel]);

  const refreshModels = useCallback(async () => {
    setManageState({ status: "loading", message: "Loading model inventory..." });
    try {
      const listed = await modelClient.listModels({
        source: normalizeOptionalSelect<ModelSource>(manageSource, ["huggingface", "local", "generated"]),
        lifecycleStatus: normalizeOptionalSelect<ModelLifecycleStatus>(manageLifecycleStatus, ["remote-reference", "saved-reference", "downloaded", "generated", "validated", "invalid"]),
        artifactForm: normalizeOptionalSelect<ModelArtifactForm>(manageArtifactForm, ["full-model", "adapter", "merged-model", "quantized-model", "checkpoint"]),
        search: manageSearch || undefined,
      });
      setModels(listed);
      setSelectedManagedModel((current) => listed.find((item) => item.modelRecordId === current?.modelRecordId));
      setManageState({ status: "success", message: listed.length > 0 ? "Loaded model inventory." : "No model records found." });
    } catch (error) {
      setManageState({ status: "error", message: error instanceof Error ? error.message : "Failed to list model records." });
    }
  }, [manageArtifactForm, manageLifecycleStatus, manageSearch, manageSource, modelClient]);

  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  const confirmDeleteModelRecord = useCallback(async () => {
    if (!pendingDeleteModelRecordId || deleteConfirmationInput !== "Delete") {
      return;
    }
    await modelClient.deleteModelRecord({ modelRecordId: pendingDeleteModelRecordId, deleteBackingArtifacts: false, deleteLocalFiles: false });
    setPendingDeleteModelRecordId(undefined);
    setDeleteConfirmationInput("");
    await refreshModels();
  }, [deleteConfirmationInput, modelClient, pendingDeleteModelRecordId, refreshModels]);

  const lifecycleCounts = useMemo(() => ({
    saved: models.filter((item) => item.lifecycleStatus === "saved-reference").length,
    generated: models.filter((item) => item.lifecycleStatus === "generated").length,
    downloaded: models.filter((item) => item.lifecycleStatus === "downloaded").length,
  }), [models]);

  const validateManagedModel = useCallback(async () => {
    if (!selectedManagedModel) {
      return;
    }
    setManageState({ status: "loading", message: "Validating model..." });
    try {
      const result = await modelClient.validateModel({ modelRecordId: selectedManagedModel.modelRecordId });
      setManageState({ status: result.status === "invalid" ? "error" : "success", message: `Validation ${result.status}.` });
      await refreshModels();
    } catch (error) {
      setManageState({ status: "error", message: error instanceof Error ? error.message : "Validation failed." });
    }
  }, [modelClient, refreshModels, selectedManagedModel]);

  const publishManagedModel = useCallback(async () => {
    if (!selectedManagedModel || publishRepository.trim().length === 0) {
      return;
    }
    setManageState({ status: "loading", message: "Publishing model..." });
    try {
      const result = await modelClient.publishModel({ modelRecordId: selectedManagedModel.modelRecordId, repository: publishRepository.trim() });
      setManageState({ status: result.published ? "success" : "error", message: result.published ? "Model published." : "Publish failed." });
      await refreshModels();
    } catch (error) {
      setManageState({ status: "error", message: error instanceof Error ? error.message : "Publish failed." });
    }
  }, [modelClient, publishRepository, refreshModels, selectedManagedModel]);

  return {
    browseQuery,
    setBrowseQuery,
    browseTaskTag,
    setBrowseTaskTag,
    browseLimit,
    setBrowseLimit,
    browseState,
    browseItems,
    selectedBrowseModel,
    selectedBrowseModelDetails,
    saveState,
    searchModels,
    selectBrowseModel,
    saveModelReference,
    manageState,
    models,
    manageSource,
    setManageSource,
    manageLifecycleStatus,
    setManageLifecycleStatus,
    manageArtifactForm,
    setManageArtifactForm,
    manageSearch,
    setManageSearch,
    selectedManagedModel,
    setSelectedManagedModel,
    refreshModels,
    pendingDeleteModelRecordId,
    setPendingDeleteModelRecordId,
    deleteConfirmationInput,
    setDeleteConfirmationInput,
    confirmDeleteModelRecord,
    lifecycleCounts,
    validateManagedModel,
    publishManagedModel,
    publishRepository,
    setPublishRepository,
  };
}
