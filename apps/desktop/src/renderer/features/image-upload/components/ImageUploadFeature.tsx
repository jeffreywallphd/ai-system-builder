import { FormEvent, useState } from "react";

import type { DesktopImageUploadApi } from "../../../lib/desktopApi";
import {
  useImageUploadClient,
} from "../hooks/useImageUpload";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface UploadViewState {
  status: UploadStatus;
  message?: string;
  key?: string;
  mediaType?: string;
  sizeBytes?: number;
}

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
    <section>
      <h2>Image upload</h2>
      <form onSubmit={(event) => void onUploadSubmit(event)}>
        <label htmlFor="desktop-image-file-input">Choose image</label>
        <input
          id="desktop-image-file-input"
          name="desktop-image-file-input"
          type="file"
          accept="image/*"
          multiple={false}
          onChange={onFileChange}
        />
        <button type="submit" disabled={viewState.status === "uploading"}>
          Upload
        </button>
      </form>

      {selectedFile ? (
        <p>
          Selected file: {selectedFile.name} ({selectedFile.type || "unknown"})
        </p>
      ) : null}

      {viewState.message ? (
        <p role={viewState.status === "error" ? "alert" : "status"}>{viewState.message}</p>
      ) : null}

      {viewState.status === "success" && viewState.key ? (
        <dl>
          <dt>Stored key</dt>
          <dd>{viewState.key}</dd>
          <dt>Stored media type</dt>
          <dd>{viewState.mediaType}</dd>
          <dt>Stored size bytes</dt>
          <dd>{viewState.sizeBytes}</dd>
        </dl>
      ) : null}
    </section>
  );
}
