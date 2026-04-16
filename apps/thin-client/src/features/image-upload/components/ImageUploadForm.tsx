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
      <form className="ui-stack ui-stack--sm" onSubmit={onSubmit}>
        <label className="ui-label" htmlFor="thin-client-image-file-input">
          Choose image
        </label>
        <input
          id="thin-client-image-file-input"
          className="ui-file-input"
          name="thin-client-image-file-input"
          type="file"
          accept="image/*"
          multiple={false}
          onChange={onFileChange}
        />
        <button className="ui-button" type="submit" disabled={uploadStatus === "uploading"}>
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
