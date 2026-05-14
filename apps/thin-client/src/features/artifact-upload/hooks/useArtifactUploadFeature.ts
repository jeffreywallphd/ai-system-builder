import { useEffect, useRef, useState, type FormEvent } from "react";

import { type ApiArtifactUploadClient } from "../api/apiArtifactUploadClient";
import type { UploadViewState } from "../components/ArtifactUploadForm";
import { useArtifactUploadClient } from "./useArtifactUploadClient";
import { toHtmlFileAcceptAttribute } from "./toHtmlFileAcceptAttribute";
import { useWebsiteArtifactIngestion } from "./useWebsiteArtifactIngestion";

export interface UseArtifactUploadFeatureResult {
  selectedFile: File | null;
  viewState: UploadViewState;
  acceptedFileTypes: string;
  websiteSingleUrl: string;
  websiteSingleMode: "automatic" | "rendered";
  websiteBatchInput: string;
  websiteBatchMode: "automatic" | "rendered";
  websiteSingleViewState: {
    status: "idle" | "loading" | "success" | "error";
    message?: string;
    result?: {
      acquisitionMechanismUsed: "simple-http" | "rendered-browser";
      stagedArtifact?: {
        storage: { key: string };
        originalName?: string;
      };
    };
  };
  websiteBatchViewState: {
    status: "idle" | "loading" | "success" | "error";
    message?: string;
    summary?: {
      attempted: number;
      succeeded: number;
      failed: number;
    };
  };
  onFileChange: (event: FormEvent<HTMLInputElement>) => void;
  onUploadSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setWebsiteSingleUrl: (value: string) => void;
  setWebsiteSingleMode: (mode: "automatic" | "rendered") => void;
  setWebsiteBatchInput: (value: string) => void;
  setWebsiteBatchMode: (mode: "automatic" | "rendered") => void;
  ingestWebsiteSingle: () => Promise<void>;
  ingestWebsiteBatch: () => Promise<void>;
}

interface PersistedFileUploadState {
  selectedFile: File | null;
  viewState: UploadViewState;
}

let persistedFileUploadState: PersistedFileUploadState = {
  selectedFile: null,
  viewState: { status: "idle" },
};

export function useArtifactUploadFeature(client?: ApiArtifactUploadClient, onUploadComplete?: () => void, workspaceId?: string): UseArtifactUploadFeatureResult {
  const uploadClient = useArtifactUploadClient(client);
  const shouldPersistFileUploadState = client === undefined;
  const [selectedFile, setSelectedFile] = useState<File | null>(shouldPersistFileUploadState ? persistedFileUploadState.selectedFile : null);
  const [acceptedFileTypes, setAcceptedFileTypes] = useState<string>("*");
  const [viewState, setViewState] = useState<UploadViewState>(shouldPersistFileUploadState ? persistedFileUploadState.viewState : { status: "idle" });
  const selectedFileRef = useRef<File | null>(selectedFile);
  const uploadInProgressRef = useRef(false);
  const websiteIngestion = useWebsiteArtifactIngestion(uploadClient, onUploadComplete);

  useEffect(() => {
    if (!shouldPersistFileUploadState) return;
    persistedFileUploadState = { selectedFile, viewState };
  }, [selectedFile, shouldPersistFileUploadState, viewState]);

  useEffect(() => {
    void uploadClient.getAcceptedTypes().then((policy) => {
      setAcceptedFileTypes(toHtmlFileAcceptAttribute(policy));
    }).catch(() => {
      setAcceptedFileTypes("*");
    });
  }, [uploadClient]);

  async function uploadSelectedFile(file: File): Promise<void> {
    if (uploadInProgressRef.current) {
      return;
    }

    if (!workspaceId) {
      setViewState({ status: "error", message: "Select an active workspace before uploading." });
      return;
    }

    uploadInProgressRef.current = true;
    setViewState({ status: "uploading", message: `Uploading ${file.name}...` });

    try {
      const response = await uploadClient.uploadArtifact({
        workspaceId,
        fileName: file.name,
        mediaType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });

      if (response.ok) {
        setViewState({
          status: "success",
          message: `Stored ${file.name}.`,
          key: response.value.descriptor.key,
          mediaType: response.value.descriptor.mediaType,
          sizeBytes: response.value.descriptor.sizeBytes,
        });
        onUploadComplete?.();
        return;
      }

      setViewState({ status: "error", message: response.error.message });
    } catch (error) {
      setViewState({
        status: "error",
        message: error instanceof Error ? error.message : "Artifact upload failed.",
      });
    } finally {
      uploadInProgressRef.current = false;
    }
  }

  function onFileChange(event: FormEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0] ?? null;
    selectedFileRef.current = file;
    setSelectedFile(file);

    if (file) {
      setViewState({
        status: "idle",
        message: `Selected ${file.name}.`,
      });
      void uploadSelectedFile(file);
      return;
    }

    setViewState({ status: "idle", message: undefined });
  }

  async function onUploadSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const file = selectedFileRef.current;
    if (!file) {
      setViewState({ status: "error", message: "Select one artifact file before uploading." });
      return;
    }

    await uploadSelectedFile(file);
  }

  return {
    selectedFile,
    viewState,
    acceptedFileTypes,
    websiteSingleUrl: websiteIngestion.websiteSingleUrl,
    websiteSingleMode: websiteIngestion.websiteSingleMode,
    websiteBatchInput: websiteIngestion.websiteBatchInput,
    websiteBatchMode: websiteIngestion.websiteBatchMode,
    websiteSingleViewState: websiteIngestion.websiteSingleViewState,
    websiteBatchViewState: websiteIngestion.websiteBatchViewState,
    onFileChange,
    onUploadSubmit,
    setWebsiteSingleUrl: websiteIngestion.setWebsiteSingleUrl,
    setWebsiteSingleMode: websiteIngestion.setWebsiteSingleMode,
    setWebsiteBatchInput: websiteIngestion.setWebsiteBatchInput,
    setWebsiteBatchMode: websiteIngestion.setWebsiteBatchMode,
    ingestWebsiteSingle: websiteIngestion.ingestWebsiteSingle,
    ingestWebsiteBatch: websiteIngestion.ingestWebsiteBatch,
  };
}
