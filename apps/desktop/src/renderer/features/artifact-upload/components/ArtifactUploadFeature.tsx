import type { ArtifactUploadClient } from "../api/desktopArtifactUploadClient";
import { useArtifactUploadFeature } from "../hooks/useArtifactUploadFeature";
import { ArtifactUploadForm } from "./ArtifactUploadForm";
import { ArtifactUploadStatus } from "./ArtifactUploadStatus";

export interface ArtifactUploadFeatureProps {
  client?: ArtifactUploadClient;
  onUploadComplete?: (storageKey: string) => void;
}

export function ArtifactUploadFeature({ client, onUploadComplete }: ArtifactUploadFeatureProps) {
  const { selectedFile, viewState, acceptedFileTypes, onFileChange, onUploadSubmit } = useArtifactUploadFeature(client, onUploadComplete);

  return (
    <section className="ui-panel ui-panel--elevated ui-stack ui-stack--sm">
      <h2 className="ui-panel__title">Artifact upload</h2>
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
