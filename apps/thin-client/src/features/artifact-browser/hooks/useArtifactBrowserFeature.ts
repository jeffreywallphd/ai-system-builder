import { useEffect, useState } from "react";

import {
  useArtifactBrowserPublishLogic,
  type ArtifactBrowserViewState,
  type UseArtifactBrowserPublishLogicResult,
} from "../../../../../../modules/ui/shared";
import {
  type ArtifactBrowserApiClient,
  type ThinClientArtifactBrowseItem,
  type ThinClientArtifactContentDescriptor,
  type ThinClientArtifactDetail,
  type ThinClientLocalizedArtifactFromRepo,
  type ThinClientPublishedBacking,
} from "../api/apiArtifactBrowserClient";
import { useArtifactBrowserClient } from "./useArtifactBrowserClient";

export interface UseArtifactBrowserFeatureResult {
  items: ThinClientArtifactBrowseItem[];
  selectedStorageKey?: string;
  detail?: ThinClientArtifactDetail;
  content?: ThinClientArtifactContentDescriptor;
  imageViewUrl?: string;
  publishState: ArtifactBrowserViewState;
  registerState: ArtifactBrowserViewState;
  localizeState: ArtifactBrowserViewState;
  publishedBacking?: ThinClientPublishedBacking;
  localizedArtifact?: ThinClientLocalizedArtifactFromRepo;
  publishForm: UseArtifactBrowserPublishLogicResult["publishForm"];
  registerForm: {
    repository: string;
    pathInRepo: string;
    revision: string;
    mediaType: string;
    showRegisterForm: boolean;
  };
  viewState: ArtifactBrowserViewState;
  selectArtifact: (storageKey: string) => Promise<void>;
  refreshArtifacts: () => Promise<void>;
  publishArtifactToHuggingFace: () => Promise<void>;
  registerArtifactFromHuggingFace: () => Promise<void>;
  localizeArtifactFromRepo: () => Promise<void>;
  recheckPublishedBacking: () => Promise<void>;
  setRepository: (value: string) => void;
  setPathInRepo: (value: string) => void;
  setRevision: (value: string) => void;
  setMediaType: (value: string) => void;
  togglePublishForm: () => void;
  setRegisterRepository: (value: string) => void;
  setRegisterPathInRepo: (value: string) => void;
  setRegisterRevision: (value: string) => void;
  setRegisterMediaType: (value: string) => void;
  toggleRegisterForm: () => void;
}

export function useArtifactBrowserFeature(
  client?: ArtifactBrowserApiClient,
): UseArtifactBrowserFeatureResult {
  const artifactClient = useArtifactBrowserClient(client);
  const [items, setItems] = useState<ThinClientArtifactBrowseItem[]>([]);
  const [selectedStorageKey, setSelectedStorageKey] = useState<string | undefined>();
  const [detail, setDetail] = useState<ThinClientArtifactDetail | undefined>();
  const [content, setContent] = useState<ThinClientArtifactContentDescriptor | undefined>();
  const [imageViewUrl, setImageViewUrl] = useState<string | undefined>();
  const [viewState, setViewState] = useState<ArtifactBrowserViewState>({ status: "idle" });
  const [registerState, setRegisterState] = useState<ArtifactBrowserViewState>({ status: "idle" });
  const [localizeState, setLocalizeState] = useState<ArtifactBrowserViewState>({ status: "idle" });
  const [localizedArtifact, setLocalizedArtifact] = useState<ThinClientLocalizedArtifactFromRepo | undefined>();
  const [registerRepository, setRegisterRepository] = useState("");
  const [registerPathInRepo, setRegisterPathInRepo] = useState("");
  const [registerRevision, setRegisterRevision] = useState("main");
  const [registerMediaType, setRegisterMediaType] = useState("");
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  const publishLogic = useArtifactBrowserPublishLogic<ThinClientArtifactDetail>({
    selectedStorageKey,
    client: artifactClient,
    async readSelectedArtifactDetail() {
      if (!selectedStorageKey) {
        return undefined;
      }

      const artifactDetail = await artifactClient.readArtifactDetail({ storageKey: selectedStorageKey });
      setDetail(artifactDetail);
      return artifactDetail;
    },
  });

  async function refreshArtifacts(): Promise<void> {
    setViewState({ status: "loading", message: "Loading image artifacts..." });
    try {
      const browseItems = await artifactClient.browseImageArtifacts();
      setItems(browseItems);
      setViewState({
        status: "success",
        message: browseItems.length > 0 ? "Loaded image artifacts." : "No image artifacts found yet.",
      });
    } catch (error) {
      setViewState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load image artifacts.",
      });
    }
  }

  useEffect(() => {
    void refreshArtifacts();
  }, [artifactClient]);

  async function selectArtifact(storageKey: string): Promise<void> {
    setSelectedStorageKey(storageKey);
    setViewState({ status: "loading", message: `Loading ${storageKey}...` });

    try {
      const locator = { storageKey };
      const artifactDetail = await artifactClient.readArtifactDetail(locator);
      setDetail(artifactDetail);
      publishLogic.setPublishedBackingFromDetail(artifactDetail);

      try {
        const contentDescriptor = await artifactClient.readArtifactContent(locator);
        setContent(contentDescriptor);
        setImageViewUrl(artifactClient.createArtifactMediaViewUrl(locator));
      } catch {
        setContent({
          locator,
          availability: "unavailable",
          retrieval: "deferred",
        });
        setImageViewUrl(undefined);
      }

      setViewState({ status: "success", message: `Loaded ${storageKey}.` });
    } catch (error) {
      setDetail(undefined);
      setContent(undefined);
      setImageViewUrl(undefined);
      publishLogic.setPublishedBackingFromDetail(undefined);
      setViewState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load artifact detail.",
      });
    }
  }

  async function registerArtifactFromHuggingFace(): Promise<void> {
    setRegisterState({ status: "loading", message: "Registering remote artifact..." });

    try {
      const registered = await artifactClient.registerArtifactFromRepo({
        repository: registerRepository,
        path: registerPathInRepo,
        revision: registerRevision,
        mediaType: registerMediaType || undefined,
      });
      await refreshArtifacts();
      await selectArtifact(registered.artifactId);
      setRegisterState({
        status: "success",
        message: `Registered ${registered.artifactId} from Hugging Face.`,
      });
    } catch (error) {
      setRegisterState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to register artifact from repo.",
      });
    }
  }

  async function localizeArtifactFromRepo(): Promise<void> {
    if (!selectedStorageKey) {
      setLocalizeState({ status: "error", message: "Select an artifact before localizing." });
      return;
    }

    setLocalizeState({ status: "loading", message: "Localizing imported artifact bytes..." });
    try {
      const localized = await artifactClient.localizeArtifactFromRepo({
        artifactId: selectedStorageKey,
      });
      setLocalizedArtifact(localized);
      await selectArtifact(selectedStorageKey);
      setLocalizeState({
        status: "success",
        message: `Localized ${localized.artifactId} to local object storage.`,
      });
    } catch (error) {
      setLocalizeState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to localize imported artifact.",
      });
    }
  }

  return {
    items,
    selectedStorageKey,
    detail,
    content,
    imageViewUrl,
    publishState: publishLogic.publishState,
    registerState,
    localizeState,
    publishedBacking: publishLogic.publishedBacking,
    localizedArtifact,
    publishForm: publishLogic.publishForm,
    registerForm: {
      repository: registerRepository,
      pathInRepo: registerPathInRepo,
      revision: registerRevision,
      mediaType: registerMediaType,
      showRegisterForm,
    },
    viewState,
    selectArtifact,
    refreshArtifacts,
    publishArtifactToHuggingFace: publishLogic.publishArtifactToHuggingFace,
    registerArtifactFromHuggingFace,
    localizeArtifactFromRepo,
    recheckPublishedBacking: publishLogic.recheckPublishedBacking,
    setRepository: publishLogic.setRepository,
    setPathInRepo: publishLogic.setPathInRepo,
    setRevision: publishLogic.setRevision,
    setMediaType: publishLogic.setMediaType,
    togglePublishForm: publishLogic.togglePublishForm,
    setRegisterRepository,
    setRegisterPathInRepo,
    setRegisterRevision,
    setRegisterMediaType,
    toggleRegisterForm: () => setShowRegisterForm((current) => !current),
  };
}
