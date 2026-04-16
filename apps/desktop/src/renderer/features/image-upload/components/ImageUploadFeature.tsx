import { FormEvent, useState } from "react";

import type { DesktopImageUploadApi } from "../../../lib/desktopApi";
import { useImageUploadClient } from "../hooks/useImageUploadClient";
import { ImageUploadForm } from "./ImageUploadForm";
import { ImageUploadStatus, type UploadViewState } from "./ImageUploadStatus";

export interface ImageUploadFeatureProps {
  uploadApi?: DesktopImageUploadApi;
}

export function ImageUploadFeature({ uploadApi }: ImageUploadFeatureProps) {
  const uploadClient = useImageUploadClient(uploadApi);
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

  return (
    <section className="ui-panel ui-panel--elevated ui-stack ui-stack--sm">
      <h2 className="ui-panel__title">Image upload</h2>
      <ImageUploadForm
        selectedFile={selectedFile}
        uploadStatus={viewState.status}
        onFileChange={onFileChange}
        onSubmit={(event) => void onUploadSubmit(event)}
      />
      <ImageUploadStatus viewState={viewState} />
    </section>
  );
}
