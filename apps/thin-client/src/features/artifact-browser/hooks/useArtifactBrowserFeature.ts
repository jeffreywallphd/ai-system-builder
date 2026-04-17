import { useEffect, useState } from "react";

import {
  type ArtifactBrowserApiClient,
  type ThinClientArtifactBrowseItem,
  type ThinClientArtifactContentDescriptor,
  type ThinClientArtifactDetail,
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
  viewState: ArtifactBrowserViewState;
  selectArtifact: (storageKey: string) => Promise<void>;
}

export function useArtifactBrowserFeature(
  client?: ArtifactBrowserApiClient,
): UseArtifactBrowserFeatureResult {
  const artifactClient = useArtifactBrowserClient(client);
  const [items, setItems] = useState<ThinClientArtifactBrowseItem[]>([]);
  const [selectedStorageKey, setSelectedStorageKey] = useState<string | undefined>();
  const [detail, setDetail] = useState<ThinClientArtifactDetail | undefined>();
  const [content, setContent] = useState<ThinClientArtifactContentDescriptor | undefined>();
  const [viewState, setViewState] = useState<ArtifactBrowserViewState>({ status: "idle" });

  useEffect(() => {
    void (async () => {
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
    })();
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
      setViewState({ status: "success", message: `Loaded ${storageKey}.` });
    } catch (error) {
      setDetail(undefined);
      setContent(undefined);
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
    viewState,
    selectArtifact,
  };
}
