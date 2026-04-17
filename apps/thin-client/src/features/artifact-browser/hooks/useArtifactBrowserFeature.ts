import { useEffect, useState } from "react";

import {
  type ArtifactBrowserApiClient,
  type ThinClientArtifactBrowseItem,
  type ThinClientArtifactContentDescriptor,
  type ThinClientArtifactDetail,
  type ThinClientPublishedBacking,
} from "../api/apiArtifactBrowserClient";
import { useArtifactBrowserClient } from "./useArtifactBrowserClient";

export interface ArtifactBrowserViewState {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
}

export interface UseArtifactBrowserFeatureResult {
  items: ThinClientArtifactBrowseItem[];
  selectedStorageKey?: string;
  detail?: ThinClientArtifactDetail;
  content?: ThinClientArtifactContentDescriptor;
  imageViewUrl?: string;
  publishState: ArtifactBrowserViewState;
  publishedBacking?: ThinClientPublishedBacking;
  viewState: ArtifactBrowserViewState;
  selectArtifact: (storageKey: string) => Promise<void>;
  refreshArtifacts: () => Promise<void>;
  publishArtifactToHuggingFace: (input: {
    repository: string;
    path: string;
    revision?: string;
    mediaType?: string;
  }) => Promise<void>;
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
  const [publishState, setPublishState] = useState<ArtifactBrowserViewState>({ status: "idle" });
  const [publishedBacking, setPublishedBacking] = useState<ThinClientPublishedBacking | undefined>();

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
      const [artifactDetail, contentDescriptor] = await Promise.all([
        artifactClient.readArtifactDetail(locator),
        artifactClient.readArtifactContent(locator),
      ]);

      setDetail(artifactDetail);
      setContent(contentDescriptor);
      setImageViewUrl(artifactClient.createArtifactMediaViewUrl(locator));
      setViewState({ status: "success", message: `Loaded ${storageKey}.` });
    } catch (error) {
      setDetail(undefined);
      setContent(undefined);
      setImageViewUrl(undefined);
      setViewState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load artifact detail.",
      });
    }
  }

  async function publishArtifactToHuggingFace(input: {
    repository: string;
    path: string;
    revision?: string;
    mediaType?: string;
  }): Promise<void> {
    if (!selectedStorageKey) {
      setPublishState({ status: "error", message: "Select an artifact before publishing." });
      return;
    }

    setPublishState({ status: "loading", message: "Publishing to Hugging Face..." });
    try {
      const backing = await artifactClient.publishArtifactToHuggingFace({
        artifactId: selectedStorageKey,
        repository: input.repository,
        path: input.path,
        revision: input.revision,
        mediaType: input.mediaType,
      });
      setPublishedBacking(backing);
      setPublishState({
        status: "success",
        message: "Published artifact backing to Hugging Face.",
      });
      await selectArtifact(selectedStorageKey);
    } catch (error) {
      setPublishState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to publish artifact.",
      });
    }
  }

  return {
    items,
    selectedStorageKey,
    detail,
    content,
    imageViewUrl,
    publishState,
    publishedBacking,
    viewState,
    selectArtifact,
    refreshArtifacts,
    publishArtifactToHuggingFace,
  };
}
