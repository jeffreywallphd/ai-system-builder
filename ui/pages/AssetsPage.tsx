import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { AssetDetailDto, AssetSummaryDto } from "../../src/shared/contracts/assets/AssetTransportContracts";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { AssetWorkflowService } from "../services/AssetWorkflowService";
import { IdentityAuthSessionStore } from "../shared/identity/IdentityAuthSessionStore";
import { toUserFacingAssetWorkflowError } from "../shared/assets/AssetWorkflowClient";

interface UploadDraftState {
  readonly assetId: string;
  readonly storageInstanceId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: string;
  readonly area: "input" | "output" | "reference";
}

const defaultUploadDraft: UploadDraftState = Object.freeze({
  assetId: "",
  storageInstanceId: "",
  fileName: "",
  mimeType: "application/octet-stream",
  sizeBytes: "0",
  area: "output",
});

export default function AssetsPage(): JSX.Element {
  const service = useMemo(() => new AssetWorkflowService(), []);
  const sessionStore = useMemo(() => new IdentityAuthSessionStore(), []);
  const [session] = useState(() => sessionStore.getSession());
  const sessionToken = session?.sessionToken;

  const [workspaceId, setWorkspaceId] = useState("workspace-1");
  const [scope, setScope] = useState<"private" | "workspace" | "all">("workspace");
  const [assets, setAssets] = useState<ReadonlyArray<AssetSummaryDto>>(Object.freeze([]));
  const [selectedAssetId, setSelectedAssetId] = useState<string>();
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<AssetDetailDto>();
  const [statusMessage, setStatusMessage] = useState("Run a list query to load logical assets.");
  const [previewMessage, setPreviewMessage] = useState<string>();
  const [downloadMessage, setDownloadMessage] = useState<string>();
  const [downloadPath, setDownloadPath] = useState<string>();
  const [uploadDraft, setUploadDraft] = useState<UploadDraftState>(defaultUploadDraft);
  const [uploadMessage, setUploadMessage] = useState<string>();

  const loadAssets = async (): Promise<void> => {
    if (!sessionToken) {
      return;
    }
    const response = await service.listAssets({
      workspaceId: workspaceId.trim(),
      scope,
      limit: 25,
      offset: 0,
    }, sessionToken);
    if (!response.ok || !response.data) {
      setAssets(Object.freeze([]));
      setSelectedAssetId(undefined);
      setSelectedAssetDetail(undefined);
      setStatusMessage(toUserFacingAssetWorkflowError(response.error, "Logical asset listing failed."));
      return;
    }

    setAssets(response.data.items);
    const firstAssetId = response.data.items[0]?.assetId;
    setSelectedAssetId(firstAssetId);
    setSelectedAssetDetail(undefined);
    setStatusMessage(
      response.data.items.length > 0
        ? `Loaded ${response.data.pagination.returned} logical asset record(s).`
        : "No assets matched this workspace query.",
    );
    setPreviewMessage(undefined);
    setDownloadMessage(undefined);
    setDownloadPath(undefined);
  };

  const loadSelectedAssetDetail = async (assetId: string): Promise<void> => {
    if (!sessionToken) {
      return;
    }
    setSelectedAssetId(assetId);
    const response = await service.getAssetDetail({
      workspaceId: workspaceId.trim(),
      assetId,
    }, sessionToken);
    if (!response.ok || !response.data) {
      setSelectedAssetDetail(undefined);
      setStatusMessage(toUserFacingAssetWorkflowError(response.error, "Logical asset detail lookup failed."));
      return;
    }

    setSelectedAssetDetail(response.data.asset);
    setStatusMessage(`Loaded detail for asset '${response.data.asset.assetId}'.`);
  };

  const resolvePreview = async (): Promise<void> => {
    if (!sessionToken || !selectedAssetId) {
      return;
    }

    const response = await service.resolvePreview({
      workspaceId: workspaceId.trim(),
      assetId: selectedAssetId,
      preferredMimeTypes: ["image/webp", "image/png", "image/jpeg"],
    }, sessionToken);
    if (!response.ok || !response.data) {
      setPreviewMessage(toUserFacingAssetWorkflowError(response.error, "Preview resolution failed."));
      return;
    }

    setPreviewMessage(response.data.preview.previewAssetId
      ? `Resolved derivative preview asset '${response.data.preview.previewAssetId}' (${response.data.preview.previewMimeType ?? "unknown mime"}).`
      : "No derivative preview asset was resolved for this item.");
  };

  const authorizeDownload = async (purpose: "download" | "inline-preview"): Promise<void> => {
    if (!sessionToken || !selectedAssetId) {
      return;
    }

    const response = await service.authorizeDownload({
      workspaceId: workspaceId.trim(),
      assetId: selectedAssetId,
      purpose,
    }, sessionToken);
    if (!response.ok || !response.data) {
      setDownloadMessage(toUserFacingAssetWorkflowError(response.error, "Download authorization failed."));
      setDownloadPath(undefined);
      return;
    }

    setDownloadPath(response.data.downloadPath);
    setDownloadMessage(
      `Authorized ${purpose} for ${response.data.authorization.mimeType} (${response.data.authorization.sizeBytes} bytes).`,
    );
  };

  const initiateUpload = async (): Promise<void> => {
    if (!sessionToken) {
      return;
    }

    const sizeBytes = Number.parseInt(uploadDraft.sizeBytes, 10);
    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
      setUploadMessage("Upload size must be a positive integer byte count.");
      return;
    }

    const response = await service.initiateUpload({
      workspaceId: workspaceId.trim(),
      assetId: uploadDraft.assetId.trim(),
      storageInstanceId: uploadDraft.storageInstanceId.trim(),
      fileName: uploadDraft.fileName.trim(),
      mimeType: uploadDraft.mimeType.trim(),
      sizeBytes,
      area: uploadDraft.area,
    }, sessionToken);

    if (!response.ok || !response.data) {
      setUploadMessage(toUserFacingAssetWorkflowError(response.error, "Upload initiation failed."));
      return;
    }

    setUploadMessage(
      `Upload session '${response.data.upload.uploadSessionId}' created for asset '${response.data.asset.assetId}'.`,
    );
    await loadAssets();
  };

  if (!sessionToken || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page">
        <div className="ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">Asset workflows</h1>
            <p className="ui-card__subtitle">
              Sign in to access protected logical asset workflows.
            </p>
          </div>
          <div className="ui-card__body">
            <Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ui-page" data-testid="asset-workflow-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Asset workflows</h1>
          <p className="ui-page__subtitle">
            Use protected logical asset APIs for listing, detail lookup, upload initiation, download authorization, and preview retrieval.
          </p>
        </div>
        <div className="ui-page__actions">
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => { void loadAssets(); }}>
            Refresh assets
          </button>
        </div>
      </div>

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">List assets</h2>
          <p className="ui-card__subtitle">Workspace-scoped logical asset query without raw path access.</p>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-storage-admin-page__filters-grid">
            <label className="ui-field">
              <span className="ui-field__label">Workspace id</span>
              <input
                className="ui-input"
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
                placeholder="workspace-1"
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Scope</span>
              <select className="ui-select" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
                <option value="private">private</option>
                <option value="workspace">workspace</option>
                <option value="all">all</option>
              </select>
            </label>
          </div>
          <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => { void loadAssets(); }}>
            Load list
          </button>
          <p className="ui-text-small ui-text-secondary">{statusMessage}</p>
          {assets.length > 0 ? (
            <div className="ui-table-wrapper">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th scope="col">Asset id</th>
                    <th scope="col">Kind</th>
                    <th scope="col">Visibility</th>
                    <th scope="col">Lifecycle</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.assetId} className={asset.assetId === selectedAssetId ? "ui-storage-admin-page__table-row--selected" : undefined}>
                      <td>
                        <button
                          type="button"
                          className="ui-button ui-button--ghost ui-button--sm"
                          onClick={() => { void loadSelectedAssetDetail(asset.assetId); }}
                        >
                          {asset.assetId}
                        </button>
                      </td>
                      <td>{asset.kind}</td>
                      <td>{asset.visibility}</td>
                      <td>{asset.lifecycleState}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Asset detail and actions</h2>
          <p className="ui-card__subtitle">Authoritative detail lookup plus secure preview/download actions.</p>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          {!selectedAssetDetail ? <p className="ui-text-secondary">Select an asset from the list to load details.</p> : null}
          {selectedAssetDetail ? (
            <>
              <div className="ui-storage-admin-page__detail-grid">
                <div>
                  <strong>Asset id</strong>
                  <div className="ui-text-secondary">{selectedAssetDetail.assetId}</div>
                </div>
                <div>
                  <strong>Kind</strong>
                  <div className="ui-text-secondary">{selectedAssetDetail.kind}</div>
                </div>
                <div>
                  <strong>Current version</strong>
                  <div className="ui-text-secondary">{selectedAssetDetail.currentVersionId}</div>
                </div>
                <div>
                  <strong>Storage instance</strong>
                  <div className="ui-text-secondary">{selectedAssetDetail.storageInstanceId}</div>
                </div>
              </div>
              <div className="ui-page__actions">
                <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => { void resolvePreview(); }}>
                  Resolve preview
                </button>
                <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => { void authorizeDownload("inline-preview"); }}>
                  Authorize inline preview
                </button>
                <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => { void authorizeDownload("download"); }}>
                  Authorize download
                </button>
              </div>
              {previewMessage ? <p className="ui-text-small ui-text-secondary">{previewMessage}</p> : null}
              {downloadMessage ? <p className="ui-text-small ui-text-secondary">{downloadMessage}</p> : null}
              {downloadPath ? (
                <p className="ui-text-small">
                  Authorized content path: <code>{downloadPath}</code>
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Initiate upload</h2>
          <p className="ui-card__subtitle">Start a protected upload session using logical asset metadata.</p>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-storage-admin-page__filters-grid">
            <label className="ui-field">
              <span className="ui-field__label">Asset id</span>
              <input
                className="ui-input"
                value={uploadDraft.assetId}
                onChange={(event) => setUploadDraft((current) => ({ ...current, assetId: event.target.value }))}
                placeholder="asset-generated-001"
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Storage instance id</span>
              <input
                className="ui-input"
                value={uploadDraft.storageInstanceId}
                onChange={(event) => setUploadDraft((current) => ({ ...current, storageInstanceId: event.target.value }))}
                placeholder="storage-instance-1"
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">File name</span>
              <input
                className="ui-input"
                value={uploadDraft.fileName}
                onChange={(event) => setUploadDraft((current) => ({ ...current, fileName: event.target.value }))}
                placeholder="example.png"
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Mime type</span>
              <input
                className="ui-input"
                value={uploadDraft.mimeType}
                onChange={(event) => setUploadDraft((current) => ({ ...current, mimeType: event.target.value }))}
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Size bytes</span>
              <input
                className="ui-input"
                value={uploadDraft.sizeBytes}
                onChange={(event) => setUploadDraft((current) => ({ ...current, sizeBytes: event.target.value }))}
                placeholder="2048"
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Storage area</span>
              <select
                className="ui-select"
                value={uploadDraft.area}
                onChange={(event) => setUploadDraft((current) => ({ ...current, area: event.target.value as UploadDraftState["area"] }))}
              >
                <option value="input">input</option>
                <option value="output">output</option>
                <option value="reference">reference</option>
              </select>
            </label>
          </div>
          <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => { void initiateUpload(); }}>
            Initiate upload session
          </button>
          {uploadMessage ? <p className="ui-text-small ui-text-secondary">{uploadMessage}</p> : null}
        </div>
      </section>
    </section>
  );
}
