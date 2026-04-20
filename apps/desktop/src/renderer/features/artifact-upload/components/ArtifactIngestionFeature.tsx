import type { ArtifactUploadClient } from "../api/desktopArtifactUploadClient";
import type { DesktopArtifactBrowserClient } from "../../artifact-browser/api/desktopArtifactBrowserClient";
import { useArtifactUploadFeature } from "../hooks/useArtifactUploadFeature";
import { ArtifactUploadForm } from "./ArtifactUploadForm";
import { ArtifactScrapeForm } from "./ArtifactScrapeForm";
import { ArtifactHuggingFaceForm } from "./ArtifactHuggingFaceForm";

export interface ArtifactIngestionFeatureProps {
  client?: ArtifactUploadClient;
  ingestionClient?: DesktopArtifactBrowserClient;
  onUploadComplete?: () => void;
}

export function ArtifactIngestionFeature({ client, ingestionClient, onUploadComplete }: ArtifactIngestionFeatureProps) {
  const {
    selectedFile,
    viewState,
    acceptedFileTypes,
    websiteSingleUrl,
    websiteSingleMode,
    websiteBatchInput,
    websiteBatchMode,
    websiteSingleViewState,
    websiteBatchViewState,
    onFileChange,
    onUploadSubmit,
    setWebsiteSingleUrl,
    setWebsiteSingleMode,
    setWebsiteBatchInput,
    setWebsiteBatchMode,
    ingestWebsiteSingle,
    ingestWebsiteBatch,
  } = useArtifactUploadFeature(client, onUploadComplete);

  return (
    <section className="ui-panel ui-panel--elevated ui-stack ui-stack--sm">
      <h1>Data Artifact Ingester</h1>
      <p>Please select a method below to add data to the system.</p>

      <ArtifactUploadForm
        selectedFile={selectedFile}
        viewState={viewState}
        acceptedFileTypes={acceptedFileTypes}
        onFileChange={onFileChange}
        onSubmit={(event) => void onUploadSubmit(event)}
      />

      <hr className="ui-panel-divider" />

      <ArtifactScrapeForm
        websiteSingleUrl={websiteSingleUrl}
        websiteSingleMode={websiteSingleMode}
        websiteBatchInput={websiteBatchInput}
        websiteBatchMode={websiteBatchMode}
        websiteSingleViewState={websiteSingleViewState}
        websiteBatchViewState={websiteBatchViewState}
        setWebsiteSingleUrl={setWebsiteSingleUrl}
        setWebsiteSingleMode={setWebsiteSingleMode}
        setWebsiteBatchInput={setWebsiteBatchInput}
        setWebsiteBatchMode={setWebsiteBatchMode}
        ingestWebsiteSingle={ingestWebsiteSingle}
        ingestWebsiteBatch={ingestWebsiteBatch}
      />

      <hr className="ui-panel-divider" />

      <ArtifactHuggingFaceForm client={ingestionClient} onRegistered={() => onUploadComplete?.()} />
    </section>
  );
}
