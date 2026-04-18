import type { DesktopArtifactBrowserClient } from "../api/desktopArtifactBrowserClient";
import { useArtifactBrowserFeature } from "../hooks/useArtifactBrowserFeature";

export interface ArtifactBrowserFeatureProps {
  client?: DesktopArtifactBrowserClient;
}

export function ArtifactBrowserFeature({ client }: ArtifactBrowserFeatureProps) {
  const {
    items,
    detail,
    content,
    imageViewUrl,
    publishState,
    publishedBacking,
    publishForm,
    viewState,
    selectArtifact,
    refreshArtifacts,
    publishArtifactToHuggingFace,
    recheckPublishedBacking,
    setRepository,
    setPathInRepo,
    setRevision,
    setMediaType,
    togglePublishForm,
  } = useArtifactBrowserFeature(client);

  return (
    <section className="ui-panel ui-panel--elevated ui-stack ui-stack--sm">
      <header className="ui-grid ui-grid--two">
        <h2 className="ui-panel__title">Artifact browser (images)</h2>
        <button className="ui-button" type="button" onClick={() => void refreshArtifacts()}>
          Refresh
        </button>
      </header>
      {viewState.message ? <p role={viewState.status === "error" ? "alert" : "status"}>{viewState.message}</p> : null}

      <div className="ui-grid ui-grid--two">
        <div className="ui-stack ui-stack--sm">
          <h3>Artifacts</h3>
          <ul className="ui-stack ui-stack--sm">
            {items.map((item) => (
              <li key={item.storageKey}>
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
        </div>

        <div className="ui-stack ui-stack--sm">
          <h3>Detail & preview</h3>
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
          ) : (
            <p className="ui-text-muted">Select an image artifact to inspect metadata and preview.</p>
          )}

          {content ? (
            <dl className="ui-grid ui-grid--two">
              <dt>Availability</dt>
              <dd>{content.availability}</dd>
              <dt>Retrieval</dt>
              <dd>{content.retrieval}</dd>
            </dl>
          ) : null}

          {imageViewUrl && content?.availability === "available" ? (
            <figure className="ui-stack ui-stack--sm">
              <img src={imageViewUrl} alt={detail?.locator.storageKey ?? "Selected artifact"} />
              <figcaption>Image preview for {detail?.locator.storageKey}</figcaption>
            </figure>
          ) : null}

          {detail ? (
            <section className="ui-stack ui-stack--sm">
              <button
                className="ui-button"
                type="button"
                disabled={publishState.status === "loading"}
                onClick={togglePublishForm}
              >
                Publish to Hugging Face
              </button>
              {publishForm.showPublishForm ? (
                <>
                  <label className="ui-stack ui-stack--sm">
                    <span>Repository</span>
                    <input className="ui-input" value={publishForm.repository} onChange={(event) => setRepository(event.target.value)} required />
                  </label>
                  <label className="ui-stack ui-stack--sm">
                    <span>Path in repo</span>
                    <input className="ui-input" value={publishForm.pathInRepo} onChange={(event) => setPathInRepo(event.target.value)} required />
                  </label>
                  <label className="ui-stack ui-stack--sm">
                    <span>Revision (optional)</span>
                    <input className="ui-input" value={publishForm.revision} onChange={(event) => setRevision(event.target.value)} />
                  </label>
                  <label className="ui-stack ui-stack--sm">
                    <span>Media type (optional)</span>
                    <input className="ui-input" value={publishForm.mediaType} onChange={(event) => setMediaType(event.target.value)} />
                  </label>
                  <button
                    className="ui-button"
                    type="button"
                    disabled={publishState.status === "loading" || publishForm.repository.trim().length === 0 || publishForm.pathInRepo.trim().length === 0}
                    onClick={() => void publishArtifactToHuggingFace()}
                  >
                    {publishState.status === "loading" ? "Publishing..." : "Publish"}
                  </button>
                </>
              ) : null}
              {publishState.message ? (
                <p role={publishState.status === "error" ? "alert" : "status"}>{publishState.message}</p>
              ) : null}
            </section>
          ) : null}

          {publishedBacking ? (
            <section className="ui-stack ui-stack--sm">
              <h3>Published Backing</h3>
              <dl className="ui-grid ui-grid--two">
                <dt>Provider</dt>
                <dd>{publishedBacking.target.provider}</dd>
                <dt>Repo</dt>
                <dd>{publishedBacking.target.repository}</dd>
                <dt>Path</dt>
                <dd>{publishedBacking.target.path}</dd>
                <dt>Revision</dt>
                <dd>{publishedBacking.target.revision ?? "main"}</dd>
                <dt>Verified</dt>
                <dd>{publishedBacking.verification.exists ? "yes" : "no"}</dd>
                <dt>Last verified at</dt>
                <dd>{publishedBacking.verification.verifiedAt ?? "never"}</dd>
              </dl>
              <button className="ui-button" type="button" onClick={() => void recheckPublishedBacking()} disabled={publishState.status === "loading"}>
                Re-check published backing
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
