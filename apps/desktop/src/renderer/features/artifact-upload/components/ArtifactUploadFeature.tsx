import type { ArtifactUploadClient } from "../api/desktopArtifactUploadClient";
import type { DesktopArtifactBrowserClient } from "../../artifact-browser/api/desktopArtifactBrowserClient";
import { useArtifactUploadFeature } from "../hooks/useArtifactUploadFeature";
import { ArtifactUploadForm } from "./ArtifactUploadForm";
import { ArtifactUploadStatus } from "./ArtifactUploadStatus";
import { ArtifactIngestionControls } from "./ArtifactIngestionControls";

export interface ArtifactUploadFeatureProps {
  client?: ArtifactUploadClient;
  ingestionClient?: DesktopArtifactBrowserClient;
  onUploadComplete?: (storageKey: string) => void;
}

export function ArtifactUploadFeature({ client, ingestionClient, onUploadComplete }: ArtifactUploadFeatureProps) {
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
      <ArtifactIngestionControls client={ingestionClient} onRegistered={onUploadComplete} />
    </section>
  );
}
