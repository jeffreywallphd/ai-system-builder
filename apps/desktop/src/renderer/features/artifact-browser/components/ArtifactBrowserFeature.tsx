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
    selectedStorageKey,
    viewState,
    selectArtifact,
    refreshArtifacts,
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
        </div>
      </div>
    </section>
  );
}
