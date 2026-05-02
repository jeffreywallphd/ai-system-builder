import { useEffect, useMemo, useRef, useState } from "react";
import type { ModelBrowseItem, ModelBrowseProvider, ModelInventoryRecord } from "../../../../../../modules/contracts/model";
import { createApiModelManagementClient, type ModelManagementApiClient } from "../api/apiModelManagementClient";

type SupportedProvider = Extract<ModelBrowseProvider, "huggingface">;

export function useModelManagementFeature(client: ModelManagementApiClient = createApiModelManagementClient()) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<SupportedProvider>("huggingface");
  const [browseResults, setBrowseResults] = useState<ModelBrowseItem[]>([]);
  const [inventory, setInventory] = useState<ModelInventoryRecord[]>([]);
  const [details, setDetails] = useState<Record<string, unknown> | undefined>();
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [browsing, setBrowsing] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [downloadingModelId, setDownloadingModelId] = useState<string | undefined>();
  const [deletingModelRecordId, setDeletingModelRecordId] = useState<string | undefined>();

  const mountedRef = useRef(true);
  const browseRequestRef = useRef(0);
  const inventoryRequestRef = useRef(0);
  const detailsRequestRef = useRef(0);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const loading = useMemo(
    () => browsing || inventoryLoading || Boolean(downloadingModelId) || Boolean(deletingModelRecordId),
    [browsing, inventoryLoading, downloadingModelId, deletingModelRecordId],
  );

  const refreshInventory = async () => {
    const requestId = ++inventoryRequestRef.current;
    setInventoryLoading(true);
    setError("");
    try {
      const result = await client.listModels({ provider });
      if (!mountedRef.current || requestId !== inventoryRequestRef.current) return;
      setInventory(result.models);
    } catch (e) {
      if (!mountedRef.current || requestId !== inventoryRequestRef.current) return;
      setError(e instanceof Error ? e.message : "Inventory refresh failed.");
    } finally {
      if (mountedRef.current && requestId === inventoryRequestRef.current) setInventoryLoading(false);
    }
  };

  useEffect(() => {
    void refreshInventory();
  }, []);

  const browse = async () => {
    const trimmedQuery = query.trim();
    const requestId = ++browseRequestRef.current;
    setBrowsing(true);
    setError("");
    setStatus("");
    try {
      const res = await client.browseModels({ provider, query: trimmedQuery });
      if (!mountedRef.current || requestId !== browseRequestRef.current) return;
      setBrowseResults(res.models);
      setStatus(`Loaded ${res.models.length} models.`);
    } catch (e) {
      if (!mountedRef.current || requestId !== browseRequestRef.current) return;
      setError(e instanceof Error ? e.message : "Browse failed.");
    } finally {
      if (mountedRef.current && requestId === browseRequestRef.current) setBrowsing(false);
    }
  };

  const clear = () => {
    setQuery("");
    setBrowseResults([]);
    setStatus("");
    setError("");
  };

  const viewDetails = async (modelId: string) => {
    const normalizedModelId = modelId.trim();
    if (!normalizedModelId) {
      setError("Model details require a non-empty model id.");
      return;
    }
    const requestId = ++detailsRequestRef.current;
    setError("");
    try {
      const res = await client.getModelDetails({ provider, modelId: normalizedModelId });
      if (!mountedRef.current || requestId !== detailsRequestRef.current) return;
      setDetails(res.model as unknown as Record<string, unknown>);
    } catch (e) {
      if (!mountedRef.current || requestId !== detailsRequestRef.current) return;
      setError(e instanceof Error ? e.message : "Details failed.");
    }
  };

  const saveReference = async (item: ModelBrowseItem) => {
    if (!item.provider || !item.modelId?.trim()) {
      setError("Save requires a provider and model id.");
      return;
    }
    setError("");
    try {
      await client.saveModelReference({ ...item, modelId: item.modelId.trim() });
      setStatus(`Saved ${item.displayName}.`);
      await refreshInventory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    }
  };

  const download = async (item: ModelBrowseItem) => {
    if (!item.provider || !item.modelId?.trim()) {
      setError("Download requires a provider and model id.");
      return;
    }
    setDownloadingModelId(item.modelId);
    setError("");
    try {
      const result = await client.downloadModel({ ...item, modelId: item.modelId.trim() });
      const downloadState = result.download.downloaded ? (result.download.fromCache ? "Already available" : "Downloaded") : "Reference saved";
      setStatus(`${item.displayName}: ${downloadState}.`);
      await refreshInventory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      if (mountedRef.current) setDownloadingModelId(undefined);
    }
  };

  const deleteRecord = async (modelRecordId: string) => {
    const normalized = modelRecordId.trim();
    if (!normalized) {
      setError("Delete requires a model record id.");
      return;
    }
    if (!window.confirm("Delete this model record?")) return;
    setDeletingModelRecordId(normalized);
    setError("");
    try {
      await client.deleteModelRecord({ modelRecordId: normalized, deleteLocalFiles: false });
      await refreshInventory();
      setStatus("Model record deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      if (mountedRef.current) setDeletingModelRecordId(undefined);
    }
  };

  return { query, setQuery, provider, setProvider, browseResults, inventory, details, status, error, loading, browsing, inventoryLoading, downloadingModelId, deletingModelRecordId, browse, clear, refreshInventory, viewDetails, saveReference, download, deleteRecord };
}
