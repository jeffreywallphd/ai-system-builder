import { Fragment } from "react";

import {
  deriveArtifactBackingState,
  deriveArtifactListStatusLabels,
  derivePublishedBackingDisplayRows,
  derivePublishedBackingVerificationPresentation,
  type PublishedBackingView,
} from "../../../../../../modules/ui/shared";
import type { ArtifactBrowserApiClient } from "../api/apiArtifactBrowserClient";
import { useArtifactBrowserFeature } from "../hooks/useArtifactBrowserFeature";

export interface ArtifactBrowserFeatureProps {
  client?: ArtifactBrowserApiClient;
}

function PublishedBackingPanel(
  props: {
    publishedBacking: PublishedBackingView;
    loading: boolean;
    onRecheck: () => void;
  },
) {
  const verification = derivePublishedBackingVerificationPresentation(props.publishedBacking);
  const rows = derivePublishedBackingDisplayRows(props.publishedBacking);

  return (
    <section className="ui-stack ui-stack--sm">
      <h3>Published Backing</h3>
      <dl className="ui-grid ui-grid--two">
        {rows.map((row) => (
          <Fragment key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </Fragment>
        ))}
        <dt>Verification</dt>
        <dd>{verification.statusLabel}</dd>
        <dt>Checked</dt>
        <dd>{verification.lastCheckedLabel}</dd>
      </dl>
      <button className="ui-button" type="button" onClick={props.onRecheck} disabled={props.loading}>
        Re-check published backing
      </button>
    </section>
  );
}

export function ArtifactBrowserFeature({ client }: ArtifactBrowserFeatureProps) {
  const {
    items,
    selectedStorageKey,
    pendingDeleteStorageKey,
    deleteConfirmationInput,
    selectedArtifactKeys,
    bulkDeleteConfirmationInput,
    detail,
    content,
    imageViewUrl,
    canSelectPreviousImage,
    canSelectNextImage,
    publishState,
    registerState,
    localizeState,
    sourceVerifyState,
    publishedBacking,
    localizedArtifact,
    registerForm,
    viewState,
    selectArtifact,
    refreshArtifacts,
    selectPreviousImage,
    selectNextImage,
    requestDeleteRegisteredArtifact,
    confirmPendingDelete,
    cancelPendingDelete,
    setDeleteConfirmationInput,
    toggleSelectedArtifactKey,
    clearSelectedArtifactKeys,
    setBulkDeleteConfirmationInput,
    deleteSelectedArtifacts,
    registerArtifactFromHuggingFace,
    registerHuggingFaceNamespace,
    browseHuggingFaceDatasetParquetFiles,
    closeHuggingFaceDatasetParquetFiles,
    huggingFaceNamespaceDatasets,
    getHuggingFaceDatasetParquetFiles,
    getHuggingFaceDatasetFilesState,
    expandedHuggingFaceDataset,
    localizeArtifactFromRepo,
    recheckPublishedBacking,
    recheckSourceBacking,
    setRegisterRepository,
    setRegisterNamespace,
    setRegisterPathInRepo,
    setRegisterRevision,
    setRegisterMediaType,
    toggleRegisterForm,
  } = useArtifactBrowserFeature(client);

  const backingState = deriveArtifactBackingState(detail, content);

  return (
    <section className="ui-panel ui-stack ui-stack--sm">
      <header className="ui-grid ui-grid--two">
        <h2>Data Artifact Browser</h2>
        <button className="ui-button" type="button" onClick={() => void refreshArtifacts()}>Refresh</button>
      </header>
      {viewState.message ? <p role={viewState.status === "error" ? "alert" : "status"}>{viewState.message}</p> : null}
      {pendingDeleteStorageKey ? (
        <div className="ui-modal-overlay" role="presentation">
          <section className="ui-panel ui-modal-dialog ui-stack ui-stack--sm" role="dialog" aria-label="Delete artifact confirmation" aria-modal="true">
            <h3>Delete Artifact</h3>
            <p>Type <strong>Delete</strong> to remove this artifact and local backing data.</p>
            <p className="ui-text-muted">{pendingDeleteStorageKey}</p>
            <label className="ui-stack ui-stack--sm">
              <span>Confirmation</span>
              <input
                className="ui-input"
                value={deleteConfirmationInput}
                onChange={(event) => setDeleteConfirmationInput(event.target.value)}
                placeholder="Delete"
              />
            </label>
            <div className="ui-grid ui-grid--two">
              <button
                className="ui-button ui-button--destructive"
                type="button"
                onClick={() => void confirmPendingDelete()}
                disabled={deleteConfirmationInput !== "Delete"}
              >
                Confirm delete
              </button>
              <button className="ui-button" type="button" onClick={cancelPendingDelete}>Cancel</button>
            </div>
          </section>
        </div>
      ) : null}

      <button className="ui-button" type="button" onClick={toggleRegisterForm} disabled={registerState.status === "loading"}>Register from Hugging Face</button>
      {registerForm.showRegisterForm ? (
        <section className="ui-stack ui-stack--sm">
          <p role="note">Private or gated Hugging Face repositories may require a host/server token.</p>
          <label className="ui-stack ui-stack--sm"><span>Namespace (user/org)</span><input className="ui-input" value={registerForm.namespace} onChange={(event) => setRegisterNamespace(event.target.value)} placeholder="OpenFinAL" required /></label>
          <button className="ui-button" type="button" disabled={registerState.status === "loading" || registerForm.namespace.trim().length === 0} onClick={() => void registerHuggingFaceNamespace()}>
            Register namespace
          </button>
          <h4>Namespace datasets</h4>
          {huggingFaceNamespaceDatasets.length === 0 ? <p className="ui-text-muted">No datasets loaded yet.</p> : (
            <ul className="ui-stack ui-stack--sm">
              {huggingFaceNamespaceDatasets.map((dataset) => (
                <li key={dataset.repository} className="ui-panel ui-stack ui-stack--sm">
                  <header className="ui-grid ui-grid--two">
                    <strong>{dataset.repository}</strong>
                    <button
                      className="ui-button"
                      type="button"
                      disabled={registerState.status === "loading"}
                      onClick={() => void browseHuggingFaceDatasetParquetFiles(dataset.repository)}
                    >
                      View Files
                    </button>
                  </header>
                  {expandedHuggingFaceDataset === dataset.repository ? (
                    <section className="ui-stack ui-stack--sm">
                      <div className="ui-grid ui-grid--two">
                        <h5>Dataset files</h5>
                        <button className="ui-button" type="button" onClick={closeHuggingFaceDatasetParquetFiles}>
                          Close
                        </button>
                      </div>
                      {getHuggingFaceDatasetFilesState(dataset.repository).status === "loading" ? <p role="status">Loading dataset files...</p> : null}
                      {getHuggingFaceDatasetFilesState(dataset.repository).status === "error" ? (
                        <p role="alert">{getHuggingFaceDatasetFilesState(dataset.repository).message ?? "Failed to load dataset files."}</p>
                      ) : null}
                      {getHuggingFaceDatasetParquetFiles(dataset.repository).length === 0
                        && getHuggingFaceDatasetFilesState(dataset.repository).status !== "loading"
                        && getHuggingFaceDatasetFilesState(dataset.repository).status !== "error" ? (
                          <p className="ui-text-muted">No files found for this dataset.</p>
                        ) : null}
                      {getHuggingFaceDatasetParquetFiles(dataset.repository).length > 0 ? (
                        <ul className="ui-stack ui-stack--sm">
                          {getHuggingFaceDatasetParquetFiles(dataset.repository).map((file) => (
                            <li key={`${file.repository}:${file.path}`}>
                              <span>{file.path}</span>
                              <button className="ui-button" type="button" disabled={registerState.status === "loading"} onClick={() => {
                                void registerArtifactFromHuggingFace({
                                  repository: file.repository,
                                  pathInRepo: file.path,
                                  revision: file.revision,
                                });
                              }}>Register</button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </section>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <label className="ui-stack ui-stack--sm"><span>Repository</span><input className="ui-input" value={registerForm.repository} onChange={(event) => setRegisterRepository(event.target.value)} required /></label>
          <label className="ui-stack ui-stack--sm"><span>Path in repo</span><input className="ui-input" value={registerForm.pathInRepo} onChange={(event) => setRegisterPathInRepo(event.target.value)} required /></label>
          <label className="ui-stack ui-stack--sm"><span>Revision (optional)</span><input className="ui-input" value={registerForm.revision} onChange={(event) => setRegisterRevision(event.target.value)} /></label>
          <label className="ui-stack ui-stack--sm"><span>Media type (optional)</span><input className="ui-input" value={registerForm.mediaType} onChange={(event) => setRegisterMediaType(event.target.value)} /></label>
          <button className="ui-button" type="button" disabled={registerState.status === "loading" || registerForm.repository.trim().length === 0 || registerForm.pathInRepo.trim().length === 0} onClick={() => void registerArtifactFromHuggingFace()}>
            {registerState.status === "loading" ? "Registering..." : "Register"}
          </button>
          {registerState.message ? <p role={registerState.status === "error" ? "alert" : "status"}>{registerState.message}</p> : null}
        </section>
      ) : null}

      <ul className="ui-stack ui-stack--sm">
        <li className="ui-grid ui-grid--two">
          <label className="ui-stack ui-stack--sm">
            <span>Bulk delete confirmation</span>
            <input className="ui-input" value={bulkDeleteConfirmationInput} onChange={(event) => setBulkDeleteConfirmationInput(event.target.value)} placeholder="Delete All" />
          </label>
          <div className="ui-stack ui-stack--sm">
            <button className="ui-button ui-button--destructive" type="button" onClick={() => void deleteSelectedArtifacts()} disabled={selectedArtifactKeys.length === 0 || bulkDeleteConfirmationInput !== "Delete All"}>
              Delete Selected ({selectedArtifactKeys.length})
            </button>
            <button className="ui-button" type="button" onClick={clearSelectedArtifactKeys} disabled={selectedArtifactKeys.length === 0}>Clear selection</button>
          </div>
        </li>
        {items.map((item) => (
          <li key={item.storageKey}>
            <input type="checkbox" checked={selectedArtifactKeys.includes(item.storageKey)} onChange={() => toggleSelectedArtifactKey(item.storageKey)} />
            <button
              className="ui-button"
              type="button"
              onClick={() => void selectArtifact(item.storageKey)}
              disabled={viewState.status === "loading" && selectedStorageKey === item.storageKey}
            >
              {item.originalName ?? item.storageKey}
            </button>
            {item.metadata?.backingState ? (
              <small>{deriveArtifactListStatusLabels(item.metadata.backingState).join(" - ")}</small>
            ) : null}
          </li>
        ))}
      </ul>

      {detail ? (
        <dl className="ui-grid ui-grid--two">
          <dt>Selected key</dt>
          <dd>{detail.locator.storageKey}</dd>
          <dt>Media type</dt>
          <dd>{detail.mediaType ?? "unknown"}</dd>
          <dt>Artifact family</dt>
          <dd>{detail.artifactFamily}</dd>
          <dt>Source</dt>
          <dd>{detail.sourceKind ?? "unknown"}</dd>
          <dt>Size bytes</dt>
          <dd>{detail.sizeBytes ?? "unknown"}</dd>
          <dt>Created at</dt>
          <dd>{detail.createdAt ?? "unknown"}</dd>
        </dl>
      ) : <p className="ui-text-muted">Select a data artifact to inspect metadata and preview availability.</p>}

      {content ? (
        <dl className="ui-grid ui-grid--two">
          <dt>Availability</dt>
          <dd>{content.availability}</dd>
          <dt>Retrieval</dt>
          <dd>{content.retrieval}</dd>
          <dt>Local bytes</dt>
          <dd>{content.availability === "available" ? "present" : "missing"}</dd>
        </dl>
      ) : null}

      {detail ? (
        <section className="ui-stack ui-stack--sm">
          <button
            className="ui-button ui-button--destructive"
            type="button"
            onClick={() => requestDeleteRegisteredArtifact(detail.locator.storageKey)}
          >
            Delete artifact
          </button>
          <h3>Local Object State</h3>
          <dl className="ui-grid ui-grid--two">
            <dt>Local object availability</dt>
            <dd>{backingState.hasLocalObjectAvailable ? "available" : "not available"}</dd>
            <dt>Localization state</dt>
            <dd>{backingState.isLocalized ? "localized" : backingState.isRemoteOnly ? "not localized" : "n/a"}</dd>
          </dl>
          {backingState.isRemoteOnly ? (
            <p role="status">Remote-only artifact. Local preview is unavailable until localization.</p>
          ) : null}
        </section>
      ) : null}

      {detail?.metadata?.importedSourceBacking ? (
        <section className="ui-stack ui-stack--sm">
          <h3>Imported Source Backing</h3>
          <dl className="ui-grid ui-grid--two">
            <dt>Provider</dt>
            <dd>{detail.metadata.importedSourceBacking.target.provider}</dd>
            <dt>Repo</dt>
            <dd>{detail.metadata.importedSourceBacking.target.repository}</dd>
            <dt>Path</dt>
            <dd>{detail.metadata.importedSourceBacking.target.path}</dd>
            <dt>Revision</dt>
            <dd>{detail.metadata.importedSourceBacking.target.revision ?? "main"}</dd>
            <dt>Source verified</dt>
            <dd>{detail.metadata.importedSourceBacking.verification.exists ? "yes" : "no"}</dd>
            <dt>Source checked</dt>
            <dd>{detail.metadata.importedSourceBacking.verification.verifiedAt ?? "never"}</dd>
          </dl>
          <button
            className="ui-button"
            type="button"
            onClick={() => void recheckSourceBacking()}
            disabled={sourceVerifyState.status === "loading"}
          >
            {sourceVerifyState.status === "loading" ? "Checking source..." : "Re-check source backing"}
          </button>
          {backingState.hasImportedSourceBacking && !backingState.hasLocalObjectAvailable ? (
            <button
              className="ui-button"
              type="button"
              onClick={() => void localizeArtifactFromRepo()}
              disabled={localizeState.status === "loading"}
            >
              {localizeState.status === "loading" ? "Localizing..." : "Localize artifact"}
            </button>
          ) : null}
          {sourceVerifyState.message ? (
            <p role={sourceVerifyState.status === "error" ? "alert" : "status"}>{sourceVerifyState.message}</p>
          ) : null}
          {localizeState.message ? (
            <p role={localizeState.status === "error" ? "alert" : "status"}>{localizeState.message}</p>
          ) : null}
          {localizedArtifact ? (
            <p role="status">Localized bytes key: {localizedArtifact.localObject.key}</p>
          ) : null}
        </section>
      ) : null}

      {imageViewUrl && content?.availability === "available" ? (
        <figure id="artifact-browser-image-preview" className="ui-stack ui-stack--sm">
          <img src={imageViewUrl} alt={detail?.locator.storageKey ?? "Selected artifact"} />
          <figcaption>Image preview for {detail?.locator.storageKey}</figcaption>
          <div className="ui-grid ui-grid--two">
            <button className="ui-button" type="button" onClick={() => void selectPreviousImage()} disabled={!canSelectPreviousImage}>
              Previous
            </button>
            <button className="ui-button" type="button" onClick={() => void selectNextImage()} disabled={!canSelectNextImage}>
              Next
            </button>
          </div>
        </figure>
      ) : null}

      {publishedBacking ? (
        <PublishedBackingPanel
          publishedBacking={publishedBacking}
          loading={publishState.status === "loading"}
          onRecheck={() => void recheckPublishedBacking()}
        />
      ) : null}
    </section>
  );
}
