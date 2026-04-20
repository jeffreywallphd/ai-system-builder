import type { ApiArtifactUploadClient } from "../api/apiArtifactUploadClient";
import type { ArtifactBrowserApiClient } from "../../artifact-browser/api/apiArtifactBrowserClient";
import { useArtifactUploadFeature } from "../hooks/useArtifactUploadFeature";
import { ArtifactUploadForm } from "./ArtifactUploadForm";
import { ArtifactScrapeForm } from "./ArtifactScrapeForm";
import { ArtifactHuggingFaceForm } from "./ArtifactHuggingFaceForm";

export interface ArtifactIngestionFeatureProps {
  client?: ApiArtifactUploadClient;
  ingestionClient?: ArtifactBrowserApiClient;
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
    <section className="ui-stack ui-stack--sm">
      <h2>Data Artifact Ingester</h2>
      <p>Please select a method below to add data to the system.</p>

      <ArtifactUploadForm
        selectedFile={selectedFile}
        viewState={viewState}
        acceptedFileTypes={acceptedFileTypes}
        onFileChange={onFileChange}
        onSubmit={(event) => void onUploadSubmit(event)}
      />

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

      <ArtifactHuggingFaceForm client={ingestionClient} onRegistered={() => onUploadComplete?.()} />
    </section>
  );
}
