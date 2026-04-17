import { useState } from "react";

import type { ArtifactBrowserApiClient } from "../api/apiArtifactBrowserClient";
import { useArtifactBrowserFeature } from "../hooks/useArtifactBrowserFeature";

export interface ArtifactBrowserFeatureProps {
  client?: ArtifactBrowserApiClient;
}

export function ArtifactBrowserFeature({ client }: ArtifactBrowserFeatureProps) {
  const {
    items,
    detail,
    content,
    imageViewUrl,
    publishState,
    publishedBacking,
    selectedStorageKey,
    viewState,
    selectArtifact,
    refreshArtifacts,
    publishArtifactToHuggingFace,
  } = useArtifactBrowserFeature(client);
  const [repository, setRepository] = useState("");
  const [pathInRepo, setPathInRepo] = useState("");
  const [revision, setRevision] = useState("main");
  const [mediaType, setMediaType] = useState("");

  return (
    <section className="ui-panel ui-stack ui-stack--sm">
      <header className="ui-grid ui-grid--two"><h2>Artifact browser (images)</h2><button className="ui-button" type="button" onClick={() => void refreshArtifacts()}>Refresh</button></header>
      {viewState.message ? <p role={viewState.status === "error" ? "alert" : "status"}>{viewState.message}</p> : null}

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
          <h3>Publish to Hugging Face</h3>
          <label className="ui-stack ui-stack--sm">
            <span>Repository</span>
            <input className="ui-input" value={repository} onChange={(event) => setRepository(event.target.value)} required />
          </label>
          <label className="ui-stack ui-stack--sm">
            <span>Path in repo</span>
            <input className="ui-input" value={pathInRepo} onChange={(event) => setPathInRepo(event.target.value)} required />
          </label>
          <label className="ui-stack ui-stack--sm">
            <span>Revision (optional)</span>
            <input className="ui-input" value={revision} onChange={(event) => setRevision(event.target.value)} />
          </label>
          <label className="ui-stack ui-stack--sm">
            <span>Media type (optional)</span>
            <input className="ui-input" value={mediaType} onChange={(event) => setMediaType(event.target.value)} />
          </label>
          <button
            className="ui-button"
            type="button"
            disabled={publishState.status === "loading" || repository.trim().length === 0 || pathInRepo.trim().length === 0}
            onClick={() => void publishArtifactToHuggingFace({
              repository,
              path: pathInRepo,
              revision: revision.trim() || undefined,
              mediaType: mediaType.trim() || undefined,
            })}
          >
            Publish to Hugging Face
          </button>
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
            <dd>{publishedBacking.provider}</dd>
            <dt>Repo</dt>
            <dd>{publishedBacking.repository}</dd>
            <dt>Path</dt>
            <dd>{publishedBacking.path}</dd>
            <dt>Revision</dt>
            <dd>{publishedBacking.revision ?? "main"}</dd>
            <dt>Verified</dt>
            <dd>{publishedBacking.exists ? "yes" : "no"}</dd>
          </dl>
        </section>
      ) : null}

    </section>
  );
}
