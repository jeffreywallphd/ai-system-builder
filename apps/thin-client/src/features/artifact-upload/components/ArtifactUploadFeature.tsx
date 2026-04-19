import type { ApiArtifactUploadClient } from "../api/apiArtifactUploadClient";
import { useArtifactUploadFeature } from "../hooks/useArtifactUploadFeature";
import { ArtifactUploadForm } from "./ArtifactUploadForm";
import { ArtifactUploadStatus } from "./ArtifactUploadStatus";

export interface ArtifactUploadFeatureProps {
  client?: ApiArtifactUploadClient;
  onUploadComplete?: (storageKey: string) => void;
}

export function ArtifactUploadFeature({ client, onUploadComplete }: ArtifactUploadFeatureProps) {
  const { selectedFile, viewState, acceptedFileTypes, onFileChange, onUploadSubmit } = useArtifactUploadFeature(client, onUploadComplete);

  return (
    <section className="ui-panel ui-stack ui-stack--sm">
      <h2>Artifact upload</h2>
      <ArtifactUploadForm
        selectedFile={selectedFile}
        uploadStatus={viewState.status}
        acceptedFileTypes={acceptedFileTypes}
        onFileChange={onFileChange}
        onSubmit={(event) => void onUploadSubmit(event)}
      />
      <ArtifactUploadStatus viewState={viewState} />
    </section>
  );
}
