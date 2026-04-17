import type { ArtifactBrowserApiClient } from "../api/apiArtifactBrowserClient";
import { useArtifactBrowserFeature } from "../hooks/useArtifactBrowserFeature";

export interface ArtifactBrowserFeatureProps {
  client?: ArtifactBrowserApiClient;
}

export function ArtifactBrowserFeature({ client }: ArtifactBrowserFeatureProps) {
  const { items, detail, content, selectedStorageKey, viewState, selectArtifact } = useArtifactBrowserFeature(
    client,
  );

  return (
    <section className="ui-panel ui-stack ui-stack--sm">
      <h2>Artifact browser (images)</h2>
      {viewState.message ? <p role={viewState.status === "error" ? "alert" : "status"}>{viewState.message}</p> : null}

      <ul className="ui-stack ui-stack--sm">
        {items.map((item) => (
          <li key={item.storageKey}>
            <button
              className="ui-button"
              type="button"
              onClick={() => void selectArtifact(item.storageKey)}
              disabled={viewState.status === "loading" && selectedStorageKey === item.storageKey}
            >
              {item.storageKey}
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
        </dl>
      ) : null}
    </section>
  );
}
