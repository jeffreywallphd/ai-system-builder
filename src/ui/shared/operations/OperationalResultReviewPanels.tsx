import type { AssetDetailDto } from "@shared/contracts/assets/AssetTransportContracts";
import type { SurfaceResponsiveProfile } from "../responsive";
import { SurfaceStateBoundary, createEmptyState, createLoadingState, type SurfacePresentationState } from "../components/presentation-state";

export interface OperationalResultReviewEntry {
  readonly executionId: string;
  readonly status?: string;
  readonly rootAssetId?: string;
  readonly rootVersionId?: string;
  readonly outputFieldCount: number;
  readonly outputContractIds: ReadonlyArray<string>;
  readonly outputAssetIds: ReadonlyArray<string>;
}

export interface OperationalProtectedAssetActionState {
  readonly previewStatus: "idle" | "loading" | "ready" | "restricted" | "unavailable" | "error";
  readonly previewMessage?: string;
  readonly previewPath?: string;
  readonly downloadStatus: "idle" | "loading" | "ready" | "restricted" | "unavailable" | "error";
  readonly downloadMessage?: string;
  readonly downloadPath?: string;
}

export interface OperationalResultOutputCardProps {
  readonly entry: OperationalResultReviewEntry;
  readonly selected: boolean;
  readonly onSelect: (executionId: string) => void;
}

export function OperationalResultOutputCard({
  entry,
  selected,
  onSelect,
}: OperationalResultOutputCardProps): JSX.Element {
  const assetReferenceCount = resolveAssetReviewReferences(entry).length;
  return (
    <article className={`ui-operational-dashboard__item ${selected ? "ui-operational-result-review__card--selected" : ""}`}>
      <div className="ui-row ui-row--between ui-row--wrap">
        <strong className="ui-operational-truncate" title={entry.executionId}>{entry.executionId}</strong>
        <span className="ui-badge ui-badge--neutral">{entry.status ?? "unknown"}</span>
      </div>
      <p className="ui-text-small ui-text-secondary">
        {entry.outputFieldCount} output fields, {entry.outputContractIds.length} contract outputs, {assetReferenceCount} asset references
      </p>
      <div className="ui-page__actions">
        <button type="button" className="ui-button ui-button--ghost ui-button--small" onClick={() => onSelect(entry.executionId)}>
          Inspect result
        </button>
      </div>
    </article>
  );
}

export interface OperationalProtectedAssetActionsProps {
  readonly executionId: string;
  readonly assetId: string;
  readonly assetDetail?: AssetDetailDto;
  readonly actionState?: OperationalProtectedAssetActionState;
  readonly onRequestPreview: (executionId: string, assetId: string) => void;
  readonly onRequestDownload: (executionId: string, assetId: string) => void;
}

export function OperationalProtectedAssetActions({
  executionId,
  assetId,
  assetDetail,
  actionState,
  onRequestPreview,
  onRequestDownload,
}: OperationalProtectedAssetActionsProps): JSX.Element {
  const canResolvePreview = assetDetail?.allowedActions?.canResolvePreview ?? true;
  const canAuthorizeDownload = assetDetail?.allowedActions?.canAuthorizeDownload ?? true;
  return (
    <div className="ui-operational-result-review__protected-actions">
      <div className="ui-page__actions">
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--small"
          disabled={!canResolvePreview || actionState?.previewStatus === "loading"}
          onClick={() => onRequestPreview(executionId, assetId)}
        >
          {actionState?.previewStatus === "loading" ? "Authorizing preview..." : "Protected preview"}
        </button>
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--small"
          disabled={!canAuthorizeDownload || actionState?.downloadStatus === "loading"}
          onClick={() => onRequestDownload(executionId, assetId)}
        >
          {actionState?.downloadStatus === "loading" ? "Authorizing download..." : "Protected download"}
        </button>
      </div>
      {!canResolvePreview ? (
        <p className="ui-text-small ui-text-secondary">Preview is restricted by policy for this asset.</p>
      ) : null}
      {!canAuthorizeDownload ? (
        <p className="ui-text-small ui-text-secondary">Download is restricted by policy for this asset.</p>
      ) : null}
      {actionState?.previewMessage ? (
        <p className="ui-text-small ui-text-secondary">{actionState.previewMessage}</p>
      ) : null}
      {actionState?.previewPath ? (
        <a className="ui-button ui-button--ghost ui-button--small" href={actionState.previewPath} target="_blank" rel="noreferrer">
          Open protected preview
        </a>
      ) : null}
      {actionState?.downloadMessage ? (
        <p className="ui-text-small ui-text-secondary">{actionState.downloadMessage}</p>
      ) : null}
      {actionState?.downloadPath ? (
        <a className="ui-button ui-button--ghost ui-button--small" href={actionState.downloadPath} target="_blank" rel="noreferrer">
          Download authorized asset
        </a>
      ) : null}
    </div>
  );
}

export interface OperationalResultDetailPanelProps {
  readonly selectedEntry?: OperationalResultReviewEntry;
  readonly isLoading: boolean;
  readonly error?: string;
  readonly assetDetailsByAssetId?: Readonly<Record<string, AssetDetailDto | undefined>>;
  readonly actionStateByAssetId?: Readonly<Record<string, OperationalProtectedAssetActionState | undefined>>;
  readonly onRequestPreview: (executionId: string, assetId: string) => void;
  readonly onRequestDownload: (executionId: string, assetId: string) => void;
}

export function OperationalResultDetailPanel({
  selectedEntry,
  isLoading,
  error,
  assetDetailsByAssetId,
  actionStateByAssetId,
  onRequestPreview,
  onRequestDownload,
}: OperationalResultDetailPanelProps): JSX.Element {
  const panelState = resolveResultDetailState({
    selectedEntry,
    isLoading,
    error,
  });
  const references = selectedEntry ? resolveAssetReviewReferences(selectedEntry) : Object.freeze([]);

  return (
    <section className="ui-card ui-operational-result-review__detail" data-testid="operational-result-detail">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Result detail</h2>
        <p className="ui-card__subtitle">Review run result metadata and protected asset access actions.</p>
      </div>
      <div className="ui-card__body ui-stack ui-stack--sm">
        <SurfaceStateBoundary state={panelState}>
          <div className="ui-operational-run-detail__section">
            <div className="ui-stack ui-stack--2xs ui-text-small">
              <span>Execution: {selectedEntry?.executionId ?? "-"}</span>
              <span>Status: {selectedEntry?.status ?? "unknown"}</span>
              <span>Root asset: {selectedEntry?.rootAssetId ?? "-"}</span>
              <span>Root version: {selectedEntry?.rootVersionId ?? "-"}</span>
              <span>Output field count: {selectedEntry?.outputFieldCount ?? 0}</span>
              <span>Output contracts: {selectedEntry?.outputContractIds.join(", ") || "-"}</span>
            </div>
          </div>
          <div className="ui-stack ui-stack--xs">
            <h3 className="ui-text-small">Protected asset references</h3>
            {references.length < 1 ? (
              <p className="ui-text-small ui-text-secondary">
                No logical asset references were resolved for this run result.
              </p>
            ) : (
              references.map((assetId) => (
                <article key={assetId} className="ui-operational-run-detail__section">
                  <div className="ui-stack ui-stack--2xs">
                    <strong className="ui-operational-truncate" title={assetId}>{assetId}</strong>
                    <span className="ui-text-small ui-text-secondary">
                      {assetDetailsByAssetId?.[assetId]?.kind ?? "asset"} | {assetDetailsByAssetId?.[assetId]?.visibility ?? "visibility unknown"}
                    </span>
                  </div>
                  <OperationalProtectedAssetActions
                    executionId={selectedEntry!.executionId}
                    assetId={assetId}
                    assetDetail={assetDetailsByAssetId?.[assetId]}
                    actionState={actionStateByAssetId?.[assetId]}
                    onRequestPreview={onRequestPreview}
                    onRequestDownload={onRequestDownload}
                  />
                </article>
              ))
            )}
          </div>
        </SurfaceStateBoundary>
      </div>
    </section>
  );
}

export interface OperationalResultReviewPanelsProps {
  readonly entries: ReadonlyArray<OperationalResultReviewEntry>;
  readonly selectedExecutionId?: string;
  readonly detailIsLoading: boolean;
  readonly detailError?: string;
  readonly responsiveProfile: SurfaceResponsiveProfile;
  readonly assetDetailsByExecutionAndAssetId?: Readonly<Record<string, Readonly<Record<string, AssetDetailDto | undefined> | undefined> | undefined>>;
  readonly actionStateByExecutionAndAssetId?: Readonly<Record<string, Readonly<Record<string, OperationalProtectedAssetActionState | undefined> | undefined> | undefined>>;
  readonly onSelectExecution: (executionId: string) => void;
  readonly onRequestPreview: (executionId: string, assetId: string) => void;
  readonly onRequestDownload: (executionId: string, assetId: string) => void;
}

export function OperationalResultReviewPanels({
  entries,
  selectedExecutionId,
  detailIsLoading,
  detailError,
  responsiveProfile,
  assetDetailsByExecutionAndAssetId,
  actionStateByExecutionAndAssetId,
  onSelectExecution,
  onRequestPreview,
  onRequestDownload,
}: OperationalResultReviewPanelsProps): JSX.Element {
  const selectedEntry = entries.find((entry) => entry.executionId === selectedExecutionId) ?? entries[0];
  const reviewState = resolveResultReviewState({
    hasEntries: entries.length > 0,
  });
  const isMobileViewport = responsiveProfile.viewport === "mobile";

  return (
    <section className="ui-card ui-operational-result-review" data-testid="operational-result-review">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Result and output review</h2>
        <p className="ui-card__subtitle">
          {responsiveProfile.viewport === "desktop"
            ? "Desktop-friendly output review with protected preview/download actions backed by authoritative asset APIs."
            : "Thin-client/mobile output review with practical protected preview and download controls."}
        </p>
      </div>
      <div className="ui-card__body ui-stack ui-stack--sm">
        <SurfaceStateBoundary state={reviewState}>
          <div className="ui-operational-result-review__layout">
            <div className="ui-stack ui-stack--xs">
              {isMobileViewport ? <p className="ui-text-small ui-text-secondary">Step 1: Select a run output card.</p> : null}
              {entries.map((entry) => (
                <OperationalResultOutputCard
                  key={entry.executionId}
                  entry={entry}
                  selected={entry.executionId === selectedEntry?.executionId}
                  onSelect={onSelectExecution}
                />
              ))}
            </div>
            {isMobileViewport ? <p className="ui-text-small ui-text-secondary">Step 2: Review metadata and protected asset actions.</p> : null}
            <OperationalResultDetailPanel
              selectedEntry={selectedEntry}
              isLoading={detailIsLoading}
              error={detailError}
              assetDetailsByAssetId={selectedEntry ? assetDetailsByExecutionAndAssetId?.[selectedEntry.executionId] : undefined}
              actionStateByAssetId={selectedEntry ? actionStateByExecutionAndAssetId?.[selectedEntry.executionId] : undefined}
              onRequestPreview={onRequestPreview}
              onRequestDownload={onRequestDownload}
            />
          </div>
        </SurfaceStateBoundary>
      </div>
    </section>
  );
}

export function resolveAssetReviewReferences(entry: OperationalResultReviewEntry): ReadonlyArray<string> {
  const seen = new Set<string>();
  if (entry.rootAssetId?.trim().startsWith("asset:")) {
    seen.add(entry.rootAssetId.trim());
  }
  for (const assetId of entry.outputAssetIds) {
    const normalized = assetId.trim();
    if (normalized.startsWith("asset:")) {
      seen.add(normalized);
    }
  }
  return Object.freeze([...seen.values()]);
}

function resolveResultReviewState(input: {
  readonly hasEntries: boolean;
}): SurfacePresentationState | undefined {
  if (!input.hasEntries) {
    return createEmptyState("No result outputs are available", "Run outputs will appear here when operational result metadata is available.");
  }
  return undefined;
}

function resolveResultDetailState(input: {
  readonly selectedEntry?: OperationalResultReviewEntry;
  readonly isLoading: boolean;
  readonly error?: string;
}): SurfacePresentationState | undefined {
  if (input.error) {
    return Object.freeze({
      kind: "error",
      title: "Result detail unavailable",
      message: input.error,
    });
  }
  if (!input.selectedEntry) {
    return createEmptyState("Select a result", "Pick an output card to inspect result metadata and protected asset actions.");
  }
  if (input.isLoading) {
    return createLoadingState("Loading result detail", "Loading result metadata and protected asset action state.");
  }
  return undefined;
}
