import type { FormEvent } from "react";

import type { UploadStatus } from "./ArtifactUploadStatus";

export interface ArtifactUploadFormProps {
  selectedFile: File | null;
  uploadStatus: UploadStatus;
  acceptedFileTypes: string;
  onFileChange: (event: FormEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ArtifactUploadForm({
  selectedFile,
  uploadStatus,
  acceptedFileTypes,
  onFileChange,
  onSubmit,
}: ArtifactUploadFormProps) {
  return (
    <>
      <form className="ui-stack ui-stack--sm" onSubmit={onSubmit}>
        <label className="ui-label" htmlFor="thin-client-artifact-file-input">
          Choose artifact
        </label>
        <input
          id="thin-client-artifact-file-input"
          className="ui-file-input"
          name="thin-client-artifact-file-input"
          type="file"
          accept={acceptedFileTypes}
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
