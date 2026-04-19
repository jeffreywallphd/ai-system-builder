import { useCallback, useEffect, useState } from "react";

import {
  useArtifactBrowserPublishLogic,
  type ArtifactBrowserViewState,
  type UseArtifactBrowserPublishLogicResult,
} from "../../../../../../../modules/ui/shared";
import type {
  DesktopArtifactBrowseItem,
  DesktopArtifactContentDescriptor,
  DesktopArtifactDetail,
  DesktopArtifactFamily,
  DesktopLocalizedArtifactFromRepo,
  DesktopHuggingFaceDatasetParquetFile,
  DesktopHuggingFaceNamespaceDataset,
  DesktopPublishedBacking,
  DesktopUnregisteredArtifactBrowseItem,
} from "../../../lib/desktopApi";
import type { DesktopArtifactBrowserClient } from "../api/desktopArtifactBrowserClient";
import { useArtifactBrowserClient } from "./useArtifactBrowserClient";
import {
  type PendingDeleteConfirmation,
  useArtifactDeleteConfirmation,
} from "./useArtifactDeleteConfirmation";
import { useArtifactSelectionContent } from "./useArtifactSelectionContent";
import { useArtifactBrowserHuggingFace } from "./useArtifactBrowserHuggingFace";

export interface UseArtifactBrowserFeatureResult {
  huggingFaceTokenStatus: { configured: boolean; maskedToken?: string };
  tokenInput: string;
  tokenState: ArtifactBrowserViewState;
  items: DesktopArtifactBrowseItem[];
  unregisteredItems: DesktopUnregisteredArtifactBrowseItem[];
  selectedStorageKey?: string;
  detail?: DesktopArtifactDetail;
  content?: DesktopArtifactContentDescriptor;
  imageViewUrl?: string;
  htmlPreview?: string;
  publishState: ArtifactBrowserViewState;
  registerState: ArtifactBrowserViewState;
  localizeState: ArtifactBrowserViewState;
  sourceVerifyState: ArtifactBrowserViewState;
  publishedBacking?: DesktopPublishedBacking;
  localizedArtifact?: DesktopLocalizedArtifactFromRepo;
  publishForm: UseArtifactBrowserPublishLogicResult["publishForm"];
  registerForm: {
    namespace: string;
    repository: string;
    pathInRepo: string;
    revision: string;
    mediaType: string;
    showRegisterForm: boolean;
  };
  viewState: ArtifactBrowserViewState;
  pendingDeleteConfirmation?: PendingDeleteConfirmation;
  deleteConfirmationInput: string;
  selectArtifact: (storageKey: string) => Promise<void>;
  refreshArtifacts: () => Promise<void>;
  registerUnregisteredArtifact: (storageKey: string) => Promise<void>;
  requestDeleteUnregisteredArtifact: (storageKey: string) => void;
  requestDeleteRegisteredArtifact: (storageKey: string) => void;
  setDeleteConfirmationInput: (value: string) => void;
  confirmPendingDelete: () => Promise<void>;
  cancelPendingDelete: () => void;
  selectedArtifactFamily: DesktopArtifactFamily | "all";
  setSelectedArtifactFamily: (value: DesktopArtifactFamily | "all") => void;
  publishArtifactToHuggingFace: () => Promise<void>;
  registerArtifactFromHuggingFace: (input?: {
    repository?: string;
    pathInRepo?: string;
    revision?: string;
    mediaType?: string;
  }) => Promise<void>;
  registerHuggingFaceNamespace: () => Promise<void>;
  browseHuggingFaceDatasetParquetFiles: (repository: string) => Promise<void>;
  closeHuggingFaceDatasetParquetFiles: () => void;
  huggingFaceNamespaceDatasets: DesktopHuggingFaceNamespaceDataset[];
  getHuggingFaceDatasetParquetFiles: (repository: string) => DesktopHuggingFaceDatasetParquetFile[];
  getHuggingFaceDatasetFilesState: (repository: string) => ArtifactBrowserViewState;
  expandedHuggingFaceDataset?: string;
  localizeArtifactFromRepo: () => Promise<void>;
  recheckPublishedBacking: () => Promise<void>;
  recheckSourceBacking: () => Promise<void>;
  setRepository: (value: string) => void;
  setPathInRepo: (value: string) => void;
  setRevision: (value: string) => void;
  setMediaType: (value: string) => void;
  togglePublishForm: () => void;
  setRegisterRepository: (value: string) => void;
  setRegisterNamespace: (value: string) => void;
  setRegisterPathInRepo: (value: string) => void;
  setRegisterRevision: (value: string) => void;
  setRegisterMediaType: (value: string) => void;
  toggleRegisterForm: () => void;
  setTokenInput: (value: string) => void;
  saveHuggingFaceToken: () => Promise<void>;
  clearHuggingFaceToken: () => Promise<void>;
}

export function useArtifactBrowserFeature(
  client?: DesktopArtifactBrowserClient,
): UseArtifactBrowserFeatureResult {
  const artifactClient = useArtifactBrowserClient(client);
  const [items, setItems] = useState<DesktopArtifactBrowseItem[]>([]);
  const [unregisteredItems, setUnregisteredItems] = useState<DesktopUnregisteredArtifactBrowseItem[]>([]);
  const [viewState, setViewState] = useState<ArtifactBrowserViewState>({ status: "idle" });
  const [selectedArtifactFamily, setSelectedArtifactFamily] = useState<DesktopArtifactFamily | "all">("all");

  const selection = useArtifactSelectionContent(
    artifactClient,
    setViewState,
  );

  const publishLogic = useArtifactBrowserPublishLogic<DesktopArtifactDetail>({
    selectedStorageKey: selection.selectedStorageKey,
    client: artifactClient,
    async readSelectedArtifactDetail() {
      if (!selection.selectedStorageKey) {
        return undefined;
      }

      return artifactClient.readArtifactDetail({ storageKey: selection.selectedStorageKey });
    },
  });

  const refreshArtifacts = useCallback(async () => {
    setViewState({ status: "loading", message: "Loading artifacts..." });
    try {
      const [browseItems, unregistered] = await Promise.all([
        artifactClient.browseArtifacts(selectedArtifactFamily === "all" ? {} : { artifactFamily: selectedArtifactFamily }),
        artifactClient.browseUnregisteredArtifacts?.() ?? Promise.resolve([]),
      ]);
      setItems(browseItems);
      setUnregisteredItems(unregistered);
      setViewState({
        status: "success",
        message: (browseItems.length + unregistered.length) > 0
          ? "Loaded artifacts."
          : "No artifacts found yet.",
      });
    } catch (error) {
      setViewState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load artifacts.",
      });
    }
  }, [artifactClient, selectedArtifactFamily]);

  const deleteConfirmation = useArtifactDeleteConfirmation();

  async function registerUnregisteredArtifact(storageKey: string): Promise<void> {
    setViewState({ status: "loading", message: `Registering ${storageKey}...` });
    try {
      if (!artifactClient.registerUnregisteredArtifact) {
        throw new Error("Unregistered artifact register flow is unavailable.");
      }
      await artifactClient.registerUnregisteredArtifact({ storageKey });
      await refreshArtifacts();
      setViewState({ status: "success", message: `Registered ${storageKey}.` });
    } catch (error) {
      setViewState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to register unregistered artifact.",
      });
    }
  }

  async function runDeleteUnregisteredArtifact(storageKey: string): Promise<void> {
    setViewState({ status: "loading", message: `Deleting ${storageKey}...` });
    try {
      if (!artifactClient.deleteUnregisteredArtifact) {
        throw new Error("Unregistered artifact delete flow is unavailable.");
      }
      await artifactClient.deleteUnregisteredArtifact({ storageKey });
      await refreshArtifacts();
      setViewState({ status: "success", message: `Deleted ${storageKey}.` });
    } catch (error) {
      setViewState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to delete unregistered artifact.",
      });
    }
  }

  async function runDeleteRegisteredArtifact(storageKey: string): Promise<void> {
    setViewState({ status: "loading", message: `Deleting ${storageKey}...` });
    try {
      if (!artifactClient.deleteRegisteredArtifact) {
        throw new Error("Registered artifact delete flow is unavailable.");
      }
      await artifactClient.deleteRegisteredArtifact({ storageKey });
      selection.clearSelectedArtifact();
      await refreshArtifacts();
      setViewState({ status: "success", message: `Deleted ${storageKey}.` });
    } catch (error) {
      setViewState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to delete registered artifact.",
      });
    }
  }

  async function confirmPendingDelete(): Promise<void> {
    if (!deleteConfirmation.pendingDeleteConfirmation) {
      return;
    }

    if (deleteConfirmation.deleteConfirmationInput !== "Delete") {
      setViewState({ status: "error", message: "Delete cancelled: typed confirmation must be exactly Delete." });
      return;
    }

    const pending = deleteConfirmation.pendingDeleteConfirmation;
    deleteConfirmation.cancelPendingDelete();

    if (pending.kind === "registered") {
      await runDeleteRegisteredArtifact(pending.storageKey);
      return;
    }

    await runDeleteUnregisteredArtifact(pending.storageKey);
  }

  const huggingFace = useArtifactBrowserHuggingFace({
    client: artifactClient,
    refreshArtifacts,
    selectArtifact: selection.selectArtifact,
    selectedStorageKey: selection.selectedStorageKey,
  });

  useEffect(() => {
    publishLogic.setPublishedBackingFromDetail(selection.detail);
  }, [selection.detail]);

  useEffect(() => {
    void refreshArtifacts();
    void artifactClient.getHuggingFaceTokenStatus().then(huggingFace.setHuggingFaceTokenStatus).catch(() => {
      huggingFace.setHuggingFaceTokenStatus({ configured: false });
    });
  }, [artifactClient, refreshArtifacts]);

  async function publishArtifactToHuggingFace(): Promise<void> {
    await publishLogic.publishArtifactToHuggingFace();
    await refreshArtifacts();
  }

  async function recheckPublishedBacking(): Promise<void> {
    await publishLogic.recheckPublishedBacking();
    await refreshArtifacts();
  }

  return {
    huggingFaceTokenStatus: huggingFace.huggingFaceTokenStatus,
    tokenInput: huggingFace.tokenInput,
    tokenState: huggingFace.tokenState,
    items,
    unregisteredItems,
    selectedStorageKey: selection.selectedStorageKey,
    detail: selection.detail,
    content: selection.content,
    imageViewUrl: selection.imageViewUrl,
    htmlPreview: selection.htmlPreview,
    publishState: publishLogic.publishState,
    registerState: huggingFace.registerState,
    localizeState: huggingFace.localizeState,
    sourceVerifyState: huggingFace.sourceVerifyState,
    publishedBacking: publishLogic.publishedBacking,
    localizedArtifact: huggingFace.localizedArtifact,
    publishForm: publishLogic.publishForm,
    registerForm: huggingFace.registerForm,
    viewState,
    pendingDeleteConfirmation: deleteConfirmation.pendingDeleteConfirmation,
    deleteConfirmationInput: deleteConfirmation.deleteConfirmationInput,
    selectArtifact: selection.selectArtifact,
    refreshArtifacts,
    registerUnregisteredArtifact,
    requestDeleteUnregisteredArtifact: deleteConfirmation.requestDeleteUnregisteredArtifact,
    requestDeleteRegisteredArtifact: deleteConfirmation.requestDeleteRegisteredArtifact,
    setDeleteConfirmationInput: deleteConfirmation.setDeleteConfirmationInput,
    confirmPendingDelete,
    cancelPendingDelete: deleteConfirmation.cancelPendingDelete,
    selectedArtifactFamily,
    setSelectedArtifactFamily,
    publishArtifactToHuggingFace,
    registerArtifactFromHuggingFace: huggingFace.registerArtifactFromHuggingFace,
    registerHuggingFaceNamespace: huggingFace.registerHuggingFaceNamespace,
    browseHuggingFaceDatasetParquetFiles: huggingFace.browseHuggingFaceDatasetParquetFiles,
    closeHuggingFaceDatasetParquetFiles: huggingFace.closeHuggingFaceDatasetParquetFiles,
    huggingFaceNamespaceDatasets: huggingFace.huggingFaceNamespaceDatasets,
    getHuggingFaceDatasetParquetFiles: huggingFace.getHuggingFaceDatasetParquetFiles,
    getHuggingFaceDatasetFilesState: huggingFace.getHuggingFaceDatasetFilesState,
    expandedHuggingFaceDataset: huggingFace.expandedHuggingFaceDataset,
    localizeArtifactFromRepo: huggingFace.localizeArtifactFromRepo,
    recheckPublishedBacking,
    recheckSourceBacking: huggingFace.recheckSourceBacking,
    setRepository: publishLogic.setRepository,
    setPathInRepo: publishLogic.setPathInRepo,
    setRevision: publishLogic.setRevision,
    setMediaType: publishLogic.setMediaType,
    togglePublishForm: publishLogic.togglePublishForm,
    setRegisterRepository: huggingFace.setRegisterRepository,
    setRegisterNamespace: huggingFace.setRegisterNamespace,
    setRegisterPathInRepo: huggingFace.setRegisterPathInRepo,
    setRegisterRevision: huggingFace.setRegisterRevision,
    setRegisterMediaType: huggingFace.setRegisterMediaType,
    toggleRegisterForm: huggingFace.toggleRegisterForm,
    setTokenInput: huggingFace.setTokenInput,
    saveHuggingFaceToken: huggingFace.saveHuggingFaceToken,
    clearHuggingFaceToken: huggingFace.clearHuggingFaceToken,
  };
}
