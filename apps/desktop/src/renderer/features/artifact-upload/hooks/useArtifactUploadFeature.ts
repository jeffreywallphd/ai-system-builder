import { useEffect, useState, type FormEvent } from "react";

import { useArtifactUploadClient } from "./useArtifactUploadClient";
import { parseWebsiteBatchTargets } from "./parseWebsiteBatchTargets";
import type { ArtifactUploadClient, WebsiteIngestionMode } from "../api/desktopArtifactUploadClient";
import type { UploadViewState } from "../components/ArtifactUploadStatus";
import { toHtmlFileAcceptAttribute } from "./toHtmlFileAcceptAttribute";
import { resolveArtifactUploadMediaType } from "./resolveArtifactUploadMediaType";
import type {
  DesktopWebsitePageIngestionResult,
  DesktopWebsitePagesBatchSummary,
} from "../../../lib/desktopApi";

interface WebsiteSingleIngestionViewState {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
  result?: DesktopWebsitePageIngestionResult;
}

interface WebsiteBatchIngestionViewState {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
  summary?: DesktopWebsitePagesBatchSummary;
}

export interface UseArtifactUploadFeatureResult {
  selectedFile: File | null;
  viewState: UploadViewState;
  acceptedFileTypes: string;
  websiteSingleUrl: string;
  websiteSingleMode: WebsiteIngestionMode;
  websiteBatchInput: string;
  websiteBatchMode: WebsiteIngestionMode;
  websiteSingleViewState: WebsiteSingleIngestionViewState;
  websiteBatchViewState: WebsiteBatchIngestionViewState;
  onFileChange: (event: FormEvent<HTMLInputElement>) => void;
  onUploadSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setWebsiteSingleUrl: (value: string) => void;
  setWebsiteSingleMode: (mode: WebsiteIngestionMode) => void;
  setWebsiteBatchInput: (value: string) => void;
  setWebsiteBatchMode: (mode: WebsiteIngestionMode) => void;
  ingestWebsiteSingle: () => Promise<void>;
  ingestWebsiteBatch: () => Promise<void>;
}

export function useArtifactUploadFeature(client?: ArtifactUploadClient, onUploadComplete?: (storageKey: string) => void): UseArtifactUploadFeatureResult {
  const uploadClient = useArtifactUploadClient(client);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewState, setViewState] = useState<UploadViewState>({
    status: "idle",
  });
  const [acceptedFileTypes, setAcceptedFileTypes] = useState<string>("*");
  const [websiteSingleUrl, setWebsiteSingleUrl] = useState("");
  const [websiteSingleMode, setWebsiteSingleMode] = useState<WebsiteIngestionMode>("automatic");
  const [websiteSingleViewState, setWebsiteSingleViewState] = useState<WebsiteSingleIngestionViewState>({
    status: "idle",
  });
  const [websiteBatchInput, setWebsiteBatchInput] = useState("");
  const [websiteBatchMode, setWebsiteBatchMode] = useState<WebsiteIngestionMode>("automatic");
  const [websiteBatchViewState, setWebsiteBatchViewState] = useState<WebsiteBatchIngestionViewState>({
    status: "idle",
  });

  useEffect(() => {
    void uploadClient.getAcceptedTypes().then((policy) => {
      setAcceptedFileTypes(toHtmlFileAcceptAttribute(policy));
    }).catch(() => {
      setAcceptedFileTypes("*");
    });
  }, [uploadClient]);

  function onFileChange(event: FormEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0] ?? null;
    setSelectedFile(file);

    if (file) {
      setViewState({
        status: "idle",
        message: `Selected ${file.name}.`,
      });
      return;
    }

    setViewState({
      status: "idle",
      message: undefined,
    });
  }

  async function onUploadSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!selectedFile) {
      setViewState({
        status: "error",
        message: "Select one artifact file before uploading.",
      });
      return;
    }

    setViewState({
      status: "uploading",
      message: `Uploading ${selectedFile.name}...`,
    });

    try {
      const response = await uploadClient.uploadArtifact({
        fileName: selectedFile.name,
        mediaType: resolveArtifactUploadMediaType({
          fileName: selectedFile.name,
          browserMediaType: selectedFile.type,
        }),
        bytes: new Uint8Array(await selectedFile.arrayBuffer()),
      });

      if (response.ok) {
        setViewState({
          status: "success",
          message: `Stored ${selectedFile.name}.`,
          key: response.value.descriptor.key,
          mediaType: response.value.descriptor.mediaType,
          sizeBytes: response.value.descriptor.sizeBytes,
        });
        onUploadComplete?.(response.value.descriptor.key);
        return;
      }

      setViewState({
        status: "error",
        message: response.error.message,
      });
    } catch (error) {
      setViewState({
        status: "error",
        message: error instanceof Error ? error.message : "Artifact upload failed.",
      });
    }
  }

  async function ingestWebsiteSingle(): Promise<void> {
    const url = websiteSingleUrl.trim();
    if (url.length === 0) {
      setWebsiteSingleViewState({
        status: "error",
        message: "Enter one URL to ingest.",
      });
      return;
    }

    setWebsiteSingleViewState({ status: "loading", message: "Ingesting website page..." });

    try {
      const response = await uploadClient.ingestWebsitePage({
        url,
        mode: websiteSingleMode,
      });

      if (!response.ok) {
        setWebsiteSingleViewState({ status: "error", message: response.error.message });
        return;
      }

      setWebsiteSingleViewState({
        status: "success",
        message: `Stored website page from ${response.value.resolvedUrl}.`,
        result: response.value,
      });
      if (response.value.stagedArtifact?.storage.key) {
        onUploadComplete?.(response.value.stagedArtifact.storage.key);
      }
    } catch (error) {
      setWebsiteSingleViewState({
        status: "error",
        message: error instanceof Error ? error.message : "Website ingestion failed.",
      });
    }
  }

  async function ingestWebsiteBatch(): Promise<void> {
    const targets = parseWebsiteBatchTargets(websiteBatchInput);
    if (targets.length === 0) {
      setWebsiteBatchViewState({
        status: "error",
        message: "Enter at least one URL (one per line) for batch ingestion.",
      });
      return;
    }

    setWebsiteBatchViewState({ status: "loading", message: `Ingesting ${targets.length} website page(s)...` });

    try {
      const response = await uploadClient.ingestWebsitePagesBatch({
        targets,
        mode: websiteBatchMode,
      });

      if (!response.ok) {
        setWebsiteBatchViewState({ status: "error", message: response.error.message });
        return;
      }

      response.value.items
        .filter((item) => item.ok)
        .forEach((item) => {
          const key = item.result?.stagedArtifact?.storage.key;
          if (key) {
            onUploadComplete?.(key);
          }
        });

      setWebsiteBatchViewState({
        status: "success",
        message: `Batch ingestion complete: ${response.value.summary.succeeded}/${response.value.summary.attempted} succeeded.`,
        summary: response.value.summary,
      });
    } catch (error) {
      setWebsiteBatchViewState({
        status: "error",
        message: error instanceof Error ? error.message : "Website batch ingestion failed.",
      });
    }
  }

  return {
    selectedFile,
    viewState,
    acceptedFileTypes,
    websiteSingleUrl,
    websiteSingleMode,
    websiteBatchInput,
    websiteBatchMode,
    websiteSingleViewState,
    websiteBatchViewState,
    onFileChange,
    onUploadSubmit,
    setWebsiteSingleUrl,
    setWebsiteSingleMode,
    setWebsiteBatchInput,
    setWebsiteBatchMode,
    ingestWebsiteSingle,
    ingestWebsiteBatch,
  };
}
