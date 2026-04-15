import type { FormEvent } from "react";

import type { UploadStatus } from "./ImageUploadStatus";

export interface ImageUploadFormProps {
  selectedFile: File | null;
  uploadStatus: UploadStatus;
  onFileChange: (event: FormEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ImageUploadForm({
  selectedFile,
  uploadStatus,
  onFileChange,
  onSubmit,
}: ImageUploadFormProps) {
  return (
    <>
      <form onSubmit={onSubmit}>
        <label htmlFor="desktop-image-file-input">Choose image</label>
        <input
          id="desktop-image-file-input"
          name="desktop-image-file-input"
          type="file"
          accept="image/*"
          multiple={false}
          onChange={onFileChange}
        />
        <button type="submit" disabled={uploadStatus === "uploading"}>
          Upload
        </button>
      </form>

      {selectedFile ? (
        <p>
          Selected file: {selectedFile.name} ({selectedFile.type || "unknown"})
        </p>
      ) : null}
    </>
  );
}
