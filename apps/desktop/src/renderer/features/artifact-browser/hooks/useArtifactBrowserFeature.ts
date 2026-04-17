import { useCallback, useEffect, useState } from "react";

import type {
  DesktopArtifactBrowseItem,
  DesktopArtifactContentDescriptor,
  DesktopArtifactDetail,
} from "../../../lib/desktopApi";
import type { DesktopArtifactBrowserClient } from "../api/desktopArtifactBrowserClient";
import { useArtifactBrowserClient } from "./useArtifactBrowserClient";

export interface ArtifactBrowserViewState {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
}

export interface UseArtifactBrowserFeatureResult {
  items: DesktopArtifactBrowseItem[];
  selectedStorageKey?: string;
  detail?: DesktopArtifactDetail;
  content?: DesktopArtifactContentDescriptor;
  imageViewUrl?: string;
  viewState: ArtifactBrowserViewState;
  selectArtifact: (storageKey: string) => Promise<void>;
  refreshArtifacts: () => Promise<void>;
}

export function useArtifactBrowserFeature(
  client?: DesktopArtifactBrowserClient,
): UseArtifactBrowserFeatureResult {
  const artifactClient = useArtifactBrowserClient(client);
  const [items, setItems] = useState<DesktopArtifactBrowseItem[]>([]);
  const [selectedStorageKey, setSelectedStorageKey] = useState<string | undefined>();
  const [detail, setDetail] = useState<DesktopArtifactDetail | undefined>();
  const [content, setContent] = useState<DesktopArtifactContentDescriptor | undefined>();
  const [imageViewUrl, setImageViewUrl] = useState<string | undefined>();
  const [viewState, setViewState] = useState<ArtifactBrowserViewState>({ status: "idle" });

  const refreshArtifacts = useCallback(async () => {
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
  }, [artifactClient]);

  useEffect(() => {
    void refreshArtifacts();
  }, [refreshArtifacts]);

  async function selectArtifact(storageKey: string): Promise<void> {
    setSelectedStorageKey(storageKey);
    setViewState({ status: "loading", message: `Loading ${storageKey}...` });

    try {
      const locator = { storageKey };
      const [artifactDetail, contentDescriptor, nextImageViewUrl] = await Promise.all([
        artifactClient.readArtifactDetail(locator),
        artifactClient.readArtifactContent(locator),
        artifactClient.createArtifactMediaViewUrl(locator),
      ]);

      setDetail(artifactDetail);
      setContent(contentDescriptor);
      setImageViewUrl(nextImageViewUrl);
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

  return {
    items,
    selectedStorageKey,
    detail,
    content,
    imageViewUrl,
    viewState,
    selectArtifact,
    refreshArtifacts,
  };
}
