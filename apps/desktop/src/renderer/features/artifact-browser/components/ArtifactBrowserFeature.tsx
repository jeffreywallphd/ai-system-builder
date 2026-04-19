import { Fragment } from "react";
import { ARTIFACT_FAMILIES } from "../../../../../../../modules/domain/artifact";

import {
  deriveArtifactBackingState,
  deriveArtifactListStatusLabels,
  derivePublishedBackingDisplayRows,
  derivePublishedBackingVerificationPresentation,
  type PublishedBackingView,
} from "../../../../../../../modules/ui/shared";
import type { DesktopArtifactBrowserClient } from "../api/desktopArtifactBrowserClient";
import { useArtifactBrowserFeature } from "../hooks/useArtifactBrowserFeature";

export interface ArtifactBrowserFeatureProps {
  client?: DesktopArtifactBrowserClient;
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
    unregisteredItems,
    selectedStorageKey,
    detail,
    content,
    imageViewUrl,
    publishState,
    localizeState,
    sourceVerifyState,
    publishedBacking,
    localizedArtifact,
    publishForm,
    viewState,
    selectArtifact,
    refreshArtifacts,
    registerUnregisteredArtifact,
    deleteUnregisteredArtifact,
    deleteRegisteredArtifact,
    selectedArtifactFamily,
    setSelectedArtifactFamily,
    publishArtifactToHuggingFace,
    localizeArtifactFromRepo,
    recheckPublishedBacking,
    recheckSourceBacking,
    setRepository,
    setPathInRepo,
    setRevision,
    setMediaType,
    togglePublishForm,
  } = useArtifactBrowserFeature(client);
  const backingState = deriveArtifactBackingState(detail, content);

  return (
    <section className="ui-panel ui-panel--elevated ui-stack ui-stack--sm">
      <header className="ui-grid ui-grid--two">
        <h2 className="ui-panel__title">Artifact Browser</h2>
        <button className="ui-button" type="button" onClick={() => void refreshArtifacts()}>
          Refresh
        </button>
      </header>
      {viewState.message ? <p role={viewState.status === "error" ? "alert" : "status"}>{viewState.message}</p> : null}
      <section className="ui-stack ui-stack--sm">
        <h3>Filter by family</h3>
        <div className="ui-grid ui-grid--two">
          <button className="ui-button" type="button" aria-current={selectedArtifactFamily === "all" ? "page" : undefined} onClick={() => setSelectedArtifactFamily("all")}>All</button>
          {ARTIFACT_FAMILIES.map((family) => (
            <button key={family} className="ui-button" type="button" aria-current={selectedArtifactFamily === family ? "page" : undefined} onClick={() => setSelectedArtifactFamily(family)}>{family}</button>
          ))}
        </div>
      </section>
      <div className="ui-grid ui-grid--two">
        <div className="ui-stack ui-stack--sm">
          <h3>Artifacts</h3>
          <ul className="ui-stack ui-stack--sm">
            {items.map((item) => (
              <li key={item.storageKey}>
                <button className="ui-button" type="button" onClick={() => void selectArtifact(item.storageKey)} disabled={viewState.status === "loading" && selectedStorageKey === item.storageKey}>
                  {item.originalName ?? item.storageKey}
                </button>
                {item.metadata?.backingState ? (
                  <small>{deriveArtifactListStatusLabels(item.metadata.backingState).join(" · ")}</small>
                ) : null}
              </li>
            ))}
          </ul>
          <section className="ui-stack ui-stack--sm">
            <h3>Unregistered Artifacts</h3>
            <ul className="ui-stack ui-stack--sm">
              {unregisteredItems.map((item) => (
                <li key={item.storageKey}>
                  <p>{item.relativePath}</p>
                  <small>{item.mediaType ?? "unknown media type"} · {item.storageKey.split(".").pop() ?? "unknown"}</small>
                  <div className="ui-grid ui-grid--two">
                    <button
                      className="ui-button"
                      type="button"
                      onClick={() => void registerUnregisteredArtifact(item.storageKey)}
                    >
                      Register
                    </button>
                    <button
                      className="ui-button ui-button--destructive"
                      type="button"
                      onClick={() => void deleteUnregisteredArtifact(item.storageKey)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="ui-stack ui-stack--sm">
          <h3>Detail & preview</h3>
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
          ) : (<p className="ui-text-muted">Select an artifact to inspect metadata and preview availability.</p>)}

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
              <button className="ui-button ui-button--destructive" type="button" onClick={() => void deleteRegisteredArtifact(detail.locator.storageKey)}>Delete registered artifact</button>
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
            <figure className="ui-stack ui-stack--sm">
              <img src={imageViewUrl} alt={detail?.locator.storageKey ?? "Selected artifact"} />
              <figcaption>Image preview for {detail?.locator.storageKey}</figcaption>
            </figure>
          ) : null}

          {detail ? (
            <section className="ui-stack ui-stack--sm">
              {backingState.hasLocalObjectAvailable ? (
                <>
                  <button className="ui-button" type="button" disabled={publishState.status === "loading"} onClick={togglePublishForm}>Publish to Hugging Face</button>
                  {publishForm.showPublishForm ? (
                    <>
                      <p role="note">Private or gated Hugging Face repositories may require a desktop-host token.</p>
                      <label className="ui-stack ui-stack--sm"><span>Repository</span><input className="ui-input" value={publishForm.repository} onChange={(event) => setRepository(event.target.value)} required /></label>
                      <label className="ui-stack ui-stack--sm"><span>Path in repo</span><input className="ui-input" value={publishForm.pathInRepo} onChange={(event) => setPathInRepo(event.target.value)} required /></label>
                      <label className="ui-stack ui-stack--sm"><span>Revision (optional)</span><input className="ui-input" value={publishForm.revision} onChange={(event) => setRevision(event.target.value)} /></label>
                      <label className="ui-stack ui-stack--sm"><span>Media type (optional)</span><input className="ui-input" value={publishForm.mediaType} onChange={(event) => setMediaType(event.target.value)} /></label>
                      <button className="ui-button" type="button" disabled={publishState.status === "loading" || publishForm.repository.trim().length === 0 || publishForm.pathInRepo.trim().length === 0} onClick={() => void publishArtifactToHuggingFace()}>
                        {publishState.status === "loading" ? "Publishing..." : "Publish"}
                      </button>
                    </>
                  ) : null}
                </>
              ) : (
                <p role="status">Publish is available after local bytes are present.</p>
              )}
              {publishState.message ? (<p role={publishState.status === "error" ? "alert" : "status"}>{publishState.message}</p>) : null}
            </section>
          ) : null}

          {publishedBacking ? (
            <PublishedBackingPanel
              publishedBacking={publishedBacking}
              loading={publishState.status === "loading"}
              onRecheck={() => void recheckPublishedBacking()}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
