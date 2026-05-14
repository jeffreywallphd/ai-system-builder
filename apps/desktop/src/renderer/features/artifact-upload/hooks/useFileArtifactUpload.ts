import { useState, type FormEvent } from "react";

import type { ArtifactUploadClient } from "../api/desktopArtifactUploadClient";
import type { UploadViewState } from "../components/ArtifactUploadForm";
import { resolveArtifactUploadMediaType } from "./resolveArtifactUploadMediaType";

export interface UseFileArtifactUploadResult {
  selectedFile: File | null;
  viewState: UploadViewState;
  onFileChange: (event: FormEvent<HTMLInputElement>) => void;
  onUploadSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

interface PersistedFileUploadState {
  selectedFile: File | null;
  viewState: UploadViewState;
}

let persistedFileUploadState: PersistedFileUploadState = {
  selectedFile: null,
  viewState: { status: "idle" },
};

export function useFileArtifactUpload(
  uploadClient: ArtifactUploadClient,
  onUploadComplete?: () => void,
  options: { persistState?: boolean; workspaceId?: string } = {},
): UseFileArtifactUploadResult {
  const shouldPersistState = options.persistState ?? true;
  const [selectedFile, setSelectedFile] = useState<File | null>(shouldPersistState ? persistedFileUploadState.selectedFile : null);
  const [viewState, setViewState] = useState<UploadViewState>(shouldPersistState ? persistedFileUploadState.viewState : { status: "idle" });

  function persist(nextSelectedFile: File | null, nextViewState: UploadViewState): void {
    if (!shouldPersistState) return;
    persistedFileUploadState = { selectedFile: nextSelectedFile, viewState: nextViewState };
  }

  function onFileChange(event: FormEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0] ?? null;
    const nextViewState = file
      ? { status: "idle" as const, message: `Selected ${file.name}.` }
      : { status: "idle" as const, message: undefined };
    setSelectedFile(file);
    setViewState(nextViewState);
    persist(file, nextViewState);
  }

  async function onUploadSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!options.workspaceId) {
      const nextViewState = { status: "error" as const, message: "Select an active workspace before uploading." };
      setViewState(nextViewState);
      persist(selectedFile, nextViewState);
      return;
    }

    if (!selectedFile) {
      const nextViewState = { status: "error" as const, message: "Select one artifact file before uploading." };
      setViewState(nextViewState);
      persist(selectedFile, nextViewState);
      return;
    }

    const uploadingState = { status: "uploading" as const, message: `Uploading ${selectedFile.name}...` };
    setViewState(uploadingState);
    persist(selectedFile, uploadingState);

    try {
      const response = await uploadClient.uploadArtifact({
        workspaceId: options.workspaceId,
        fileName: selectedFile.name,
        mediaType: resolveArtifactUploadMediaType({
          workspaceId: options.workspaceId,
        fileName: selectedFile.name,
          browserMediaType: selectedFile.type,
        }),
        bytes: new Uint8Array(await selectedFile.arrayBuffer()),
      });

      if (!response.ok) {
        const nextViewState = { status: "error" as const, message: response.error.message };
        setViewState(nextViewState);
        persist(selectedFile, nextViewState);
        return;
      }

      const nextViewState = {
        status: "success",
        message: `Stored ${selectedFile.name}.`,
        key: response.value.descriptor.key,
        mediaType: response.value.descriptor.mediaType,
        sizeBytes: response.value.descriptor.sizeBytes,
      } as const;
      setViewState(nextViewState);
      persist(selectedFile, nextViewState);
      onUploadComplete?.();
    } catch (error) {
      const nextViewState = {
        status: "error",
        message: error instanceof Error ? error.message : "Artifact upload failed.",
      } as const;
      setViewState(nextViewState);
      persist(selectedFile, nextViewState);
    }
  }

  return { selectedFile, viewState, onFileChange, onUploadSubmit };
}

