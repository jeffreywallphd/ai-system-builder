import { useEffect, useState, type FormEvent } from "react";

import { useArtifactUploadClient } from "./useArtifactUploadClient";
import type { ArtifactUploadClient } from "../api/desktopArtifactUploadClient";
import type { UploadViewState } from "../components/ArtifactUploadStatus";

export interface UseArtifactUploadFeatureResult {
  selectedFile: File | null;
  viewState: UploadViewState;
  acceptedFileTypes: string;
  onFileChange: (event: FormEvent<HTMLInputElement>) => void;
  onUploadSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useArtifactUploadFeature(client?: ArtifactUploadClient, onUploadComplete?: (storageKey: string) => void): UseArtifactUploadFeatureResult {
  const uploadClient = useArtifactUploadClient(client);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewState, setViewState] = useState<UploadViewState>({
    status: "idle",
  });
  const [acceptedFileTypes, setAcceptedFileTypes] = useState<string>("*");

  useEffect(() => {
    void uploadClient.getAcceptedTypes().then((policy) => {
      setAcceptedFileTypes([...policy.acceptedExtensions, ...policy.acceptedMediaTypes].join(","));
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
        mediaType: selectedFile.type,
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

  return {
    selectedFile,
    viewState,
    acceptedFileTypes,
    onFileChange,
    onUploadSubmit,
  };
}
