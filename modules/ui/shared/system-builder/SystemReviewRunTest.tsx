import { useEffect, useMemo, useState } from "react";
import type {
  SystemReviewArtifactDetail,
  SystemReviewArtifactPage,
  SystemReviewAuditEntry,
  SystemReviewDescriptor,
  SystemReviewPreview,
  SystemReviewResult,
} from "../../../contracts/system-review";
import type { SystemRelease } from "../../../contracts/system-build";
import {
  ArtifactPreviewPanel,
  describeArtifactPreview,
  type ArtifactPreviewView,
} from "../artifact-preview";
import { ApplicationIcon } from "../components/ApplicationIcon";
import { EmptyState } from "../components/EmptyState";
import type { SystemBuildClient } from "./SystemBuildReleaseWorkflow";

export interface SystemReviewClient {
  describe(input: {
    workspaceId: string;
    releaseId: string;
  }): Promise<SystemReviewResult<SystemReviewDescriptor>>;
  browse(input: {
    workspaceId: string;
    releaseId: string;
    nameQuery?: string;
    limit?: number;
  }): Promise<SystemReviewResult<SystemReviewArtifactPage>>;
  detail(input: {
    workspaceId: string;
    releaseId: string;
    artifactRef: string;
  }): Promise<SystemReviewResult<SystemReviewArtifactDetail>>;
  preview(input: {
    workspaceId: string;
    releaseId: string;
    artifactRef: string;
  }): Promise<SystemReviewResult<SystemReviewPreview>>;
  listAudit(input: {
    workspaceId: string;
    releaseId: string;
    limit?: number;
  }): Promise<SystemReviewResult<readonly SystemReviewAuditEntry[]>>;
}

export interface SystemReviewRunTestProps {
  readonly workspaceId: string;
  readonly client: SystemReviewClient;
  readonly buildClient: Pick<SystemBuildClient, "listReleases">;
}

export function SystemReviewRunTest({
  workspaceId,
  client,
  buildClient,
}: SystemReviewRunTestProps) {
  const [releases, setReleases] = useState<readonly SystemRelease[]>([]);
  const [releaseId, setReleaseId] = useState("");
  const [descriptor, setDescriptor] = useState<SystemReviewDescriptor>();
  const [page, setPage] = useState<SystemReviewArtifactPage>();
  const [detail, setDetail] = useState<SystemReviewArtifactDetail>();
  const [preview, setPreview] = useState<SystemReviewPreview>();
  const [audit, setAudit] = useState<readonly SystemReviewAuditEntry[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [mediaUrl, setMediaUrl] = useState<string>();

  useEffect(() => {
    let active = true;
    setDescriptor(undefined);
    setPage(undefined);
    setDetail(undefined);
    setPreview(undefined);
    setAudit([]);
    void buildClient.listReleases({ workspaceId }).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setReleases(result.value);
      setReleaseId(String(result.value[0]?.releaseId ?? ""));
    });
    return () => {
      active = false;
    };
  }, [buildClient, workspaceId]);

  useEffect(
    () => () => {
      if (mediaUrl && typeof URL.revokeObjectURL === "function")
        URL.revokeObjectURL(mediaUrl);
    },
    [mediaUrl],
  );

  const context = useMemo(
    () => ({ workspaceId, releaseId }),
    [releaseId, workspaceId],
  );

  async function refreshAudit(): Promise<void> {
    const result = await client.listAudit({ ...context, limit: 100 });
    if (result.ok) setAudit(result.value);
  }

  async function loadRelease(): Promise<void> {
    if (!releaseId) {
      setError("Choose an approved release.");
      return;
    }
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    setDetail(undefined);
    setPreview(undefined);
    const result = await client.describe(context);
    if (result.ok) {
      setDescriptor(result.value);
      const browse = await client.browse({
        ...context,
        limit: result.value.maximumListItems,
      });
      if (browse.ok) {
        setPage(browse.value);
        setNotice(
          "Verified review policy and authorized artifact list loaded.",
        );
      } else setError(browse.error.message);
      await refreshAudit();
    } else setError(result.error.message);
    setBusy(false);
  }

  async function applyFilter(): Promise<void> {
    if (!descriptor) return;
    setBusy(true);
    setError(undefined);
    const result = await client.browse({
      ...context,
      ...(nameQuery.trim() ? { nameQuery: nameQuery.trim() } : {}),
      limit: descriptor.maximumListItems,
    });
    if (result.ok) setPage(result.value);
    else setError(result.error.message);
    await refreshAudit();
    setBusy(false);
  }

  async function selectArtifact(artifactRef: string): Promise<void> {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    setPreview(undefined);
    const [detailResult, previewResult] = await Promise.all([
      client.detail({ ...context, artifactRef }),
      client.preview({ ...context, artifactRef }),
    ]);
    if (detailResult.ok) setDetail(detailResult.value);
    else setError(detailResult.error.message);
    if (previewResult.ok) {
      setPreview(previewResult.value);
      if (
        previewResult.value.status === "ready" &&
        previewResult.value.bytes?.byteLength &&
        typeof URL.createObjectURL === "function"
      ) {
        setMediaUrl(
          URL.createObjectURL(
            new Blob([Uint8Array.from(previewResult.value.bytes).buffer], {
              type: previewResult.value.mediaType,
            }),
          ),
        );
      } else setMediaUrl(undefined);
    } else setError(previewResult.error.message);
    await refreshAudit();
    setBusy(false);
  }

  const previewView = toPreviewView(preview, mediaUrl);

  return (
    <section
      className="ui-panel ui-panel--sectioned system-review-runtime"
      aria-labelledby="system-review-runtime-title"
    >
      <header className="ui-panel__section-header">
        <div className="ui-panel-heading ui-panel-heading--blue">
          <span className="ui-panel-heading__icon" aria-hidden="true">
            <ApplicationIcon name="artifacts" />
          </span>
          <div>
            <h2 id="system-review-runtime-title" className="ui-panel__title">
              Secured data-review release
            </h2>
            <p className="ui-text-muted">
              Browse masked artifact descriptors and request bounded previews
              through one verified release policy.
            </p>
          </div>
        </div>
      </header>
      <div className="ui-panel__section-body ui-stack ui-stack--md">
        {error ? (
          <p className="ui-status ui-status--error" role="alert" tabIndex={-1}>
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="ui-status ui-status--success" role="status">
            {notice}
          </p>
        ) : null}
        <label>
          Approved release
          <select
            value={releaseId}
            onChange={(event) => setReleaseId(event.currentTarget.value)}
            disabled={busy}
          >
            <option value="">Choose a release</option>
            {releases.map((release) => (
              <option
                key={String(release.releaseId)}
                value={String(release.releaseId)}
              >
                {release.releaseId}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void loadRelease()}
          disabled={busy || !releaseId}
        >
          <ApplicationIcon name="play" />
          <span>{busy ? "Loading..." : "Load verified review"}</span>
        </button>
        {descriptor ? (
          <>
            <form
              className="ui-inline-actions"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                void applyFilter();
              }}
            >
              <label>
                Filter artifacts by name
                <input
                  value={nameQuery}
                  onChange={(event) => setNameQuery(event.currentTarget.value)}
                  maxLength={160}
                />
              </label>
              <button type="submit" disabled={busy}>
                Apply filter
              </button>
            </form>
            <div className="system-review-runtime__layout">
              <section aria-labelledby="system-review-artifacts-title">
                <h3 id="system-review-artifacts-title">Authorized artifacts</h3>
                {page?.items.length ? (
                  <ul className="system-builder__asset-list">
                    {page.items.map((item) => (
                      <li key={item.artifactRef}>
                        <button
                          type="button"
                          className="system-builder__asset"
                          onClick={() => void selectArtifact(item.artifactRef)}
                          disabled={busy}
                        >
                          <strong>{item.displayName}</strong>
                          <span>{item.mediaType ?? item.artifactFamily}</span>
                          <small>
                            {item.sizeBytes === undefined
                              ? "Size unavailable"
                              : `${item.sizeBytes} bytes`}
                          </small>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    compact
                    title="No authorized artifacts"
                    description="Adjust the name filter or add artifacts to this workspace."
                    icon="artifacts"
                  />
                )}
              </section>
              <section aria-labelledby="system-review-detail-title">
                <h3 id="system-review-detail-title">Masked detail</h3>
                {detail ? (
                  <dl>
                    <div>
                      <dt>Name</dt>
                      <dd>{detail.displayName}</dd>
                    </div>
                    <div>
                      <dt>Type</dt>
                      <dd>{detail.mediaType ?? detail.artifactFamily}</dd>
                    </div>
                    {Object.entries(detail.metadata).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value === null ? "-" : String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="ui-text-muted">
                    Choose an artifact to inspect its authorized metadata.
                  </p>
                )}
                <ArtifactPreviewPanel preview={previewView} />
              </section>
            </div>
            <section aria-labelledby="system-review-audit-title">
              <h3 id="system-review-audit-title">Safe audit evidence</h3>
              {audit.length ? (
                <ul>
                  {audit.map((entry) => (
                    <li key={entry.auditId}>
                      <strong>
                        {entry.action} - {entry.outcome}
                      </strong>
                      <span>
                        {entry.actorId} at {entry.occurredAt}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ui-text-muted">
                  No review audit entries are available to this principal.
                </p>
              )}
            </section>
          </>
        ) : (
          <EmptyState
            compact
            title="Choose an approved review release"
            description="Only immutable releases with the complete review policy can run."
            icon="security"
          />
        )}
      </div>
    </section>
  );
}

function toPreviewView(
  preview: SystemReviewPreview | undefined,
  mediaUrl: string | undefined,
): ArtifactPreviewView | undefined {
  if (!preview) return undefined;
  const descriptor = describeArtifactPreview({
    storageKey: preview.artifactRef,
    originalName: preview.displayName,
    mediaType: preview.mediaType,
  });
  const status =
    preview.status === "ready"
      ? "ready"
      : preview.status === "unavailable"
        ? "unavailable"
        : preview.status === "unsupported"
          ? "ready"
          : "error";
  return {
    status,
    descriptor,
    title: `${descriptor.fileTypeLabel} preview for ${preview.displayName}`,
    message: preview.message,
    ...(preview.text ? { text: preview.text } : {}),
    ...(preview.table ? { table: preview.table } : {}),
    ...(mediaUrl ? { mediaUrl } : {}),
    ...(preview.truncated ? { truncated: true } : {}),
  };
}
