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
  huggingFaceTokenStatus: { configured: boolean; maskedToken?: string };
  tokenInput: string;
  tokenState: ArtifactBrowserViewState;
  items: ThinClientArtifactBrowseItem[];
  selectedStorageKey?: string;
  detail?: ThinClientArtifactDetail;
  content?: ThinClientArtifactContentDescriptor;
  imageViewUrl?: string;
  publishState: ArtifactBrowserViewState;
  registerState: ArtifactBrowserViewState;
  localizeState: ArtifactBrowserViewState;
  sourceVerifyState: ArtifactBrowserViewState;
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
  recheckSourceBacking: () => Promise<void>;
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
  setTokenInput: (value: string) => void;
  saveHuggingFaceToken: () => Promise<void>;
  clearHuggingFaceToken: () => Promise<void>;
}

export function useArtifactBrowserFeature(
  client?: ArtifactBrowserApiClient,
): UseArtifactBrowserFeatureResult {
  const withHuggingFaceAuthGuidance = (message: string): string => {
    const normalized = message.toLowerCase();
    const mentionsAuth = normalized.includes("hugging face")
      && (
        normalized.includes("token")
        || normalized.includes("auth")
        || normalized.includes("401")
        || normalized.includes("403")
        || normalized.includes("access denied")
        || normalized.includes("private")
        || normalized.includes("gated")
      );
    if (!mentionsAuth) {
      return message;
    }

    return `${message} This Hugging Face repository may require an access token. Open Hugging Face token settings in this page to configure host/server access for private or gated repos.`;
  };

  const artifactClient = useArtifactBrowserClient(client);
  const [items, setItems] = useState<ThinClientArtifactBrowseItem[]>([]);
  const [selectedStorageKey, setSelectedStorageKey] = useState<string | undefined>();
  const [detail, setDetail] = useState<ThinClientArtifactDetail | undefined>();
  const [content, setContent] = useState<ThinClientArtifactContentDescriptor | undefined>();
  const [imageViewUrl, setImageViewUrl] = useState<string | undefined>();
  const [viewState, setViewState] = useState<ArtifactBrowserViewState>({ status: "idle" });
  const [registerState, setRegisterState] = useState<ArtifactBrowserViewState>({ status: "idle" });
  const [localizeState, setLocalizeState] = useState<ArtifactBrowserViewState>({ status: "idle" });
  const [sourceVerifyState, setSourceVerifyState] = useState<ArtifactBrowserViewState>({ status: "idle" });
  const [localizedArtifact, setLocalizedArtifact] = useState<ThinClientLocalizedArtifactFromRepo | undefined>();
  const [registerRepository, setRegisterRepository] = useState("");
  const [registerPathInRepo, setRegisterPathInRepo] = useState("");
  const [registerRevision, setRegisterRevision] = useState("main");
  const [registerMediaType, setRegisterMediaType] = useState("");
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenState, setTokenState] = useState<ArtifactBrowserViewState>({ status: "idle" });
  const [huggingFaceTokenStatus, setHuggingFaceTokenStatus] = useState<{ configured: boolean; maskedToken?: string }>({
    configured: false,
  });

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
    void artifactClient.getHuggingFaceTokenStatus().then(setHuggingFaceTokenStatus).catch(() => {
      setHuggingFaceTokenStatus({ configured: false });
    });
  }, [artifactClient]);

  async function saveHuggingFaceToken(): Promise<void> {
    setTokenState({ status: "loading", message: "Saving Hugging Face token..." });
    try {
      const status = await artifactClient.setHuggingFaceToken({ token: tokenInput });
      setHuggingFaceTokenStatus(status);
      setTokenInput("");
      setTokenState({ status: "success", message: "Hugging Face token saved." });
    } catch (error) {
      setTokenState({ status: "error", message: error instanceof Error ? error.message : "Failed to save Hugging Face token." });
    }
  }

  async function clearHuggingFaceToken(): Promise<void> {
    setTokenState({ status: "loading", message: "Removing Hugging Face token..." });
    try {
      const status = await artifactClient.clearHuggingFaceToken();
      setHuggingFaceTokenStatus(status);
      setTokenInput("");
      setTokenState({ status: "success", message: "Hugging Face token removed." });
    } catch (error) {
      setTokenState({ status: "error", message: error instanceof Error ? error.message : "Failed to remove Hugging Face token." });
    }
  }

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
      const message = error instanceof Error ? error.message : "Failed to register artifact from repo.";
      setRegisterState({
        status: "error",
        message: withHuggingFaceAuthGuidance(message),
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
      await refreshArtifacts();
      await selectArtifact(selectedStorageKey);
      setLocalizeState({
        status: "success",
        message: `Localized ${localized.artifactId} to local object storage.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to localize imported artifact.";
      setLocalizeState({
        status: "error",
        message: withHuggingFaceAuthGuidance(message),
      });
    }
  }

  async function recheckSourceBacking(): Promise<void> {
    if (!selectedStorageKey) {
      setSourceVerifyState({ status: "error", message: "Select an artifact before verification." });
      return;
    }

    setSourceVerifyState({ status: "loading", message: "Verifying imported source backing..." });
    try {
      if (!artifactClient.verifyImportedSourceBacking) {
        throw new Error("Source verification is unavailable for this client.");
      }
      await artifactClient.verifyImportedSourceBacking({
        artifactId: selectedStorageKey,
      });
      await refreshArtifacts();
      await selectArtifact(selectedStorageKey);
      setSourceVerifyState({
        status: "success",
        message: "Imported source backing verification refreshed.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to verify imported source backing.";
      setSourceVerifyState({
        status: "error",
        message: withHuggingFaceAuthGuidance(message),
      });
    }
  }

  async function publishArtifactToHuggingFace(): Promise<void> {
    await publishLogic.publishArtifactToHuggingFace();
    await refreshArtifacts();
  }

  async function recheckPublishedBacking(): Promise<void> {
    await publishLogic.recheckPublishedBacking();
    await refreshArtifacts();
  }

  return {
    huggingFaceTokenStatus,
    tokenInput,
    tokenState,
    items,
    selectedStorageKey,
    detail,
    content,
    imageViewUrl,
    publishState: publishLogic.publishState,
    registerState,
    localizeState,
    sourceVerifyState,
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
    publishArtifactToHuggingFace,
    registerArtifactFromHuggingFace,
    localizeArtifactFromRepo,
    recheckPublishedBacking,
    recheckSourceBacking,
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
    setTokenInput,
    saveHuggingFaceToken,
    clearHuggingFaceToken,
  };
}
