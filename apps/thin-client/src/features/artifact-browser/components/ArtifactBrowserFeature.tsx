import { Fragment } from "react";

import {
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
    detail,
    content,
    imageViewUrl,
    publishState,
    registerState,
    localizeState,
    publishedBacking,
    localizedArtifact,
    publishForm,
    registerForm,
    viewState,
    selectArtifact,
    refreshArtifacts,
    publishArtifactToHuggingFace,
    registerArtifactFromHuggingFace,
    localizeArtifactFromRepo,
    recheckPublishedBacking,
    setRepository,
    setPathInRepo,
    setRevision,
    setMediaType,
    togglePublishForm,
    setRegisterRepository,
    setRegisterPathInRepo,
    setRegisterRevision,
    setRegisterMediaType,
    toggleRegisterForm,
  } = useArtifactBrowserFeature(client);

  return (
    <section className="ui-panel ui-stack ui-stack--sm">
      <header className="ui-grid ui-grid--two"><h2>Artifact browser (images)</h2><button className="ui-button" type="button" onClick={() => void refreshArtifacts()}>Refresh</button></header>
      {viewState.message ? <p role={viewState.status === "error" ? "alert" : "status"}>{viewState.message}</p> : null}

      <button className="ui-button" type="button" onClick={toggleRegisterForm} disabled={registerState.status === "loading"}>Register from Hugging Face</button>
      {registerForm.showRegisterForm ? (
        <section className="ui-stack ui-stack--sm">
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
        {items.map((item) => (
          <li key={item.originalName ?? item.storageKey}>
            <button
              className="ui-button"
              type="button"
              onClick={() => void selectArtifact(item.storageKey)}
              disabled={viewState.status === "loading" && selectedStorageKey === item.storageKey}
            >
              {item.originalName ?? item.storageKey}
            </button>
          </li>
        ))}
      </ul>

      {detail ? (
        <dl className="ui-grid ui-grid--two">
          <dt>Selected key</dt>
          <dd>{detail.locator.storageKey}</dd>
          <dt>Media type</dt>
          <dd>{detail.mediaType ?? "unknown"}</dd>
          <dt>Size bytes</dt>
          <dd>{detail.sizeBytes ?? "unknown"}</dd>
          <dt>Created at</dt>
          <dd>{detail.createdAt ?? "unknown"}</dd>
        </dl>
      ) : null}

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
          </dl>
          {content?.availability === "unavailable" ? (
            <button
              className="ui-button"
              type="button"
              onClick={() => void localizeArtifactFromRepo()}
              disabled={localizeState.status === "loading"}
            >
              {localizeState.status === "loading" ? "Localizing..." : "Localize/download artifact"}
            </button>
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
          <button className="ui-button" type="button" disabled={publishState.status === "loading"} onClick={togglePublishForm}>Publish to Hugging Face</button>
          {publishForm.showPublishForm ? (
            <>
              <label className="ui-stack ui-stack--sm"><span>Repository</span><input className="ui-input" value={publishForm.repository} onChange={(event) => setRepository(event.target.value)} required /></label>
              <label className="ui-stack ui-stack--sm"><span>Path in repo</span><input className="ui-input" value={publishForm.pathInRepo} onChange={(event) => setPathInRepo(event.target.value)} required /></label>
              <label className="ui-stack ui-stack--sm"><span>Revision (optional)</span><input className="ui-input" value={publishForm.revision} onChange={(event) => setRevision(event.target.value)} /></label>
              <label className="ui-stack ui-stack--sm"><span>Media type (optional)</span><input className="ui-input" value={publishForm.mediaType} onChange={(event) => setMediaType(event.target.value)} /></label>
              <button className="ui-button" type="button" disabled={publishState.status === "loading" || publishForm.repository.trim().length === 0 || publishForm.pathInRepo.trim().length === 0} onClick={() => void publishArtifactToHuggingFace()}>
                {publishState.status === "loading" ? "Publishing..." : "Publish"}
              </button>
            </>
          ) : null}
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

    </section>
  );
}
