import type { ArtifactUploadClient } from "../api/desktopArtifactUploadClient";
import type { DesktopArtifactBrowserClient } from "../../artifact-browser/api/desktopArtifactBrowserClient";
import { useArtifactUploadFeature } from "../hooks/useArtifactUploadFeature";
import { ArtifactUploadForm } from "./ArtifactUploadForm";
import { ArtifactUploadStatus } from "./ArtifactUploadStatus";
import { ArtifactIngestionControls } from "./ArtifactIngestionControls";

export interface ArtifactUploadFeatureProps {
  client?: ArtifactUploadClient;
  ingestionClient?: DesktopArtifactBrowserClient;
  onUploadComplete?: () => void;
}

export function ArtifactUploadFeature({ client, ingestionClient, onUploadComplete }: ArtifactUploadFeatureProps) {
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
      
      <section className="ui-panel">
        <h2 className="ui-panel__title">Upload data</h2>
        <ArtifactUploadForm
          selectedFile={selectedFile}
          uploadStatus={viewState.status}
          acceptedFileTypes={acceptedFileTypes}
          onFileChange={onFileChange}
          onSubmit={(event) => void onUploadSubmit(event)}
        />
        <ArtifactUploadStatus viewState={viewState} />
      </section>

      <hr className="ui-panel-divider"/>

      <section className="ui-panel">
        <h2>Scrape web data</h2>
        <label className="ui-stack ui-stack--sm">
          <span>Single page URL</span>
          <input
            className="ui-input"
            value={websiteSingleUrl}
            onChange={(event) => setWebsiteSingleUrl(event.target.value)}
            placeholder="https://example.com/docs"
          />
        </label>
        <label className="ui-stack ui-stack--sm">
          <span>Single-page mode</span>
          <select
            className="ui-input"
            value={websiteSingleMode}
            onChange={(event) => setWebsiteSingleMode(event.target.value as "automatic" | "rendered")}
          >
            <option value="automatic">automatic</option>
            <option value="rendered">rendered</option>
          </select>
        </label>
        <button className="ui-button" type="button" onClick={() => void ingestWebsiteSingle()} disabled={websiteSingleViewState.status === "loading"}>
          {websiteSingleViewState.status === "loading" ? "Ingesting..." : "Ingest page"}
        </button>
        {websiteSingleViewState.message ? (
          <p role={websiteSingleViewState.status === "error" ? "alert" : "status"}>{websiteSingleViewState.message}</p>
        ) : null}
        {websiteSingleViewState.result?.stagedArtifact ? (
          <dl className="ui-grid ui-grid--two">
            <dt>Requested mode</dt>
            <dd>{websiteSingleMode}</dd>
            <dt>Acquisition mechanism</dt>
            <dd>{websiteSingleViewState.result.acquisitionMechanismUsed}</dd>
            <dt>Stored key</dt>
            <dd>{websiteSingleViewState.result.stagedArtifact.storage.key}</dd>
            <dt>Original name</dt>
            <dd>{websiteSingleViewState.result.stagedArtifact.originalName ?? "unknown"}</dd>
          </dl>
        ) : null}

        <label className="ui-stack ui-stack--sm">
          <span>Batch URLs (one URL per line)</span>
          <textarea
            className="ui-input"
            rows={6}
            value={websiteBatchInput}
            onChange={(event) => setWebsiteBatchInput(event.target.value)}
            placeholder={"https://example.com\nhttps://example.com/docs"}
          />
        </label>
        <label className="ui-stack ui-stack--sm">
          <span>Batch mode</span>
          <select
            className="ui-input"
            value={websiteBatchMode}
            onChange={(event) => setWebsiteBatchMode(event.target.value as "automatic" | "rendered")}
          >
            <option value="automatic">automatic</option>
            <option value="rendered">rendered</option>
          </select>
        </label>
        <button className="ui-button" type="button" onClick={() => void ingestWebsiteBatch()} disabled={websiteBatchViewState.status === "loading"}>
          {websiteBatchViewState.status === "loading" ? "Ingesting batch..." : "Ingest batch"}
        </button>
        {websiteBatchViewState.message ? (
          <p role={websiteBatchViewState.status === "error" ? "alert" : "status"}>{websiteBatchViewState.message}</p>
        ) : null}
        {websiteBatchViewState.summary ? (
          <dl className="ui-grid ui-grid--two">
            <dt>Attempted</dt>
            <dd>{websiteBatchViewState.summary.attempted}</dd>
            <dt>Succeeded</dt>
            <dd>{websiteBatchViewState.summary.succeeded}</dd>
            <dt>Failed</dt>
            <dd>{websiteBatchViewState.summary.failed}</dd>
          </dl>
        ) : null}
      </section>

      <hr className="ui-panel-divider"/>

      <section className="ui-panel">
        <ArtifactIngestionControls client={ingestionClient} onRegistered={() => onUploadComplete?.()} />
      </section>
    </section>
  );
}
