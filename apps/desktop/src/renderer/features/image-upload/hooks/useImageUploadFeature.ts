import { useState, type FormEvent } from "react";

import { useImageUploadClient } from "./useImageUploadClient";
import type { ImageUploadClient } from "../api/desktopImageUploadClient";
import type { UploadViewState } from "../components/ImageUploadStatus";

export interface UseImageUploadFeatureResult {
  selectedFile: File | null;
  viewState: UploadViewState;
  onFileChange: (event: FormEvent<HTMLInputElement>) => void;
  onUploadSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useImageUploadFeature(client?: ImageUploadClient, onUploadComplete?: (storageKey: string) => void): UseImageUploadFeatureResult {
  const uploadClient = useImageUploadClient(client);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewState, setViewState] = useState<UploadViewState>({
    status: "idle",
  });

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
        message: "Select one image file before uploading.",
      });
      return;
    }

    setViewState({
      status: "uploading",
      message: `Uploading ${selectedFile.name}...`,
    });

    try {
      const response = await uploadClient.uploadImage({
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
        message: error instanceof Error ? error.message : "Image upload failed.",
      });
    }
  }

  return {
    selectedFile,
    viewState,
    onFileChange,
    onUploadSubmit,
  };
}
