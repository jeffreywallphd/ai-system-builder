import { useCallback, useState } from "react";

import type { ArtifactBrowserViewState } from "../../../../../../../modules/ui/shared";
import type {
  DesktopArtifactBrowseItem,
  DesktopArtifactFamily,
  DesktopUnregisteredArtifactBrowseItem,
} from "../../../lib/desktopApi";
import type { DesktopArtifactBrowserClient } from "../api/desktopArtifactBrowserClient";

interface UseArtifactBrowserArtifactsParams {
  client: DesktopArtifactBrowserClient;
  setViewState: (value: ArtifactBrowserViewState) => void;
  workspaceId?: string;
}

export interface UseArtifactBrowserArtifactsResult {
  items: DesktopArtifactBrowseItem[];
  uploadedItems: DesktopArtifactBrowseItem[];
  generatedItems: DesktopArtifactBrowseItem[];
  unregisteredItems: DesktopUnregisteredArtifactBrowseItem[];
  selectedArtifactFamily: DesktopArtifactFamily | "all";
  setSelectedArtifactFamily: (value: DesktopArtifactFamily | "all") => void;
  selectedStorageFilter: "all" | "uploaded" | "generated";
  setSelectedStorageFilter: (value: "all" | "uploaded" | "generated") => void;
  refreshArtifacts: () => Promise<void>;
}

export function useArtifactBrowserArtifacts({
  client,
  setViewState,
  workspaceId,
}: UseArtifactBrowserArtifactsParams): UseArtifactBrowserArtifactsResult {
  const [items, setItems] = useState<DesktopArtifactBrowseItem[]>([]);
  const [unregisteredItems, setUnregisteredItems] = useState<DesktopUnregisteredArtifactBrowseItem[]>([]);
  const [selectedArtifactFamily, setSelectedArtifactFamily] = useState<DesktopArtifactFamily | "all">("all");
  const [selectedStorageFilter, setSelectedStorageFilter] = useState<"all" | "uploaded" | "generated">("all");

  const refreshArtifacts = useCallback(async () => {
    setViewState({ status: "loading", message: "Loading artifacts..." });
    try {
      const [browseItems, unregistered] = await Promise.all([
        workspaceId ? client.browseArtifacts(selectedArtifactFamily === "all" ? { workspaceId } : { artifactFamily: selectedArtifactFamily, workspaceId }) : Promise.resolve([]),
        workspaceId ? (client.browseUnregisteredArtifacts?.({ workspaceId }) ?? Promise.resolve([])) : Promise.resolve([]),
      ]);

      const filteredByStorage = browseItems.filter((item) => {
        if (selectedStorageFilter === "uploaded") {
          return item.storageKey.startsWith("uploads/");
        }
        if (selectedStorageFilter === "generated") {
          return item.storageKey.startsWith("generated/");
        }
        return true;
      });
      setItems(filteredByStorage);
      setUnregisteredItems(unregistered);
      setViewState({
        status: "success",
        message: (filteredByStorage.length + unregistered.length) > 0
          ? "Loaded artifacts."
          : "No artifacts found yet.",
      });
    } catch (error) {
      setViewState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load artifacts.",
      });
    }
  }, [client, selectedArtifactFamily, selectedStorageFilter, setViewState, workspaceId]);

  const uploadedItems = items.filter((item) => item.storageKey.startsWith("uploads/"));
  const generatedItems = items.filter((item) => item.storageKey.startsWith("generated/"));

  return {
    items,
    uploadedItems,
    generatedItems,
    unregisteredItems,
    selectedArtifactFamily,
    setSelectedArtifactFamily,
    selectedStorageFilter,
    setSelectedStorageFilter,
    refreshArtifacts,
  };
}
