import type { ExecutionRunDetailProjection } from "@application/execution/ExecutionRunDetailProjectionService";
import type { ExecutionRunProjection } from "@application/execution/ExecutionRunProjectionService";
import type { RuntimeQueueItem } from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import type { RuntimeRealtimeConnectionStateSnapshot } from "@shared/runtime/RuntimeRealtimeSubscriptionService";
import {
  SurfaceActionButtonStrip,
  SurfaceActionMenu,
  createSurfaceActionContext,
  type SurfaceActionDescriptor,
  type SurfaceActionSurface,
} from "../actions";
import {
  SurfaceResponsiveActionMenuContainer,
  SurfaceResponsiveTableContainer,
} from "../components/shell";
import {
  SurfaceStateBoundary,
  createEmptyState,
  createLoadingState,
  type SurfacePresentationState,
} from "../components/presentation-state";
import type { SurfaceResponsiveProfile } from "../responsive";
import { OperationalRealtimeStatusPill } from "./OperationalRealtimeIndicators";

export interface OperationalRunInspectionState {
  readonly executionId?: string;
  readonly status?: string;
  readonly progressLabel?: string;
  readonly diagnosticsCount?: number;
  readonly traceEventCount?: number;
  readonly traceLogCount?: number;
  readonly outputFieldCount?: number;
  readonly outputContractIds?: ReadonlyArray<string>;
}

interface OperationalRunListRow {
  readonly executionId: string;
  readonly queueItem?: RuntimeQueueItem;
  readonly recentRun?: ExecutionRunProjection;
}

export interface OperationalRunListPanelProps {
  readonly queueItems: ReadonlyArray<RuntimeQueueItem>;
  readonly recentRuns: ReadonlyArray<ExecutionRunProjection>;
  readonly selectedExecutionId?: string;
  readonly isQueueLoading: boolean;
  readonly queueError?: string;
  readonly realtimeConnectionState: RuntimeRealtimeConnectionStateSnapshot;
  readonly responsiveProfile: SurfaceResponsiveProfile;
  readonly actorPermissionIds: ReadonlyArray<string>;
  readonly surface: SurfaceActionSurface;
  readonly onRefreshQueue: () => void;
  readonly onInspectRun: (executionId: string) => void;
  readonly onCancelRun: (executionId: string) => void;
  readonly onDequeue: (queueItemId: string) => void;
}

export function OperationalRunListPanel({
  queueItems,
  recentRuns,
  selectedExecutionId,
  isQueueLoading,
  queueError,
  realtimeConnectionState,
  responsiveProfile,
  actorPermissionIds,
  surface,
  onRefreshQueue,
  onInspectRun,
  onCancelRun,
  onDequeue,
}: OperationalRunListPanelProps): JSX.Element {
  const rows = mergeOperationalRunRows(queueItems, recentRuns);
  const listState = resolveRunListState({
    queueError,
    isQueueLoading,
    hasRows: rows.length > 0,
  });
  const baseActionContext = createSurfaceActionContext({
    actorPermissionIds,
    surface,
    surfaceCapabilities: Object.freeze(["inline-actions", "menu-actions"]),
  });
  const pageActions = Object.freeze([
    {
      id: "operational-run-list-refresh",
      label: isQueueLoading ? "Refreshing..." : "Refresh list",
      scope: "page",
      tone: "secondary",
      requiredPermissions: Object.freeze(["runtime.queue.refresh"]),
      availability: () => (isQueueLoading
        ? Object.freeze({ disabled: true, disabledReason: "Run list refresh is already in progress." })
        : Object.freeze({})),
      onInvoke: () => {
        onRefreshQueue();
      },
    } satisfies SurfaceActionDescriptor,
  ]);

  return (
    <section className="ui-card ui-operational-run-list" data-testid="operational-run-list">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Run list</h2>
        <p className="ui-card__subtitle">
          Workspace-visible queued, running, and recent persisted runs for operational monitoring.
          {" "}
          <OperationalRealtimeStatusPill connectionState={realtimeConnectionState} />
        </p>
      </div>
      <div className="ui-card__body ui-stack ui-stack--sm">
        <SurfaceActionButtonStrip
          actions={pageActions}
          context={baseActionContext}
          scope="page"
          responsiveProfile={responsiveProfile}
          className="ui-page__actions"
        />
        <SurfaceStateBoundary state={listState}>
          <SurfaceResponsiveTableContainer responsiveProfile={responsiveProfile}>
            <div className="ui-table-wrapper">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th scope="col">Execution</th>
                    <th scope="col">Queue</th>
                    <th scope="col">Run status</th>
                    <th scope="col">Progress</th>
                    <th scope="col">Updated</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const rowActionContext = createSurfaceActionContext({
                      actorPermissionIds,
                      surface,
                      surfaceCapabilities: Object.freeze(["menu-actions"]),
                      resource: row,
                      selection: Object.freeze({ selectedExecutionId }),
                    });
                    return (
                      <tr
                        key={row.executionId}
                        className={row.executionId === selectedExecutionId ? "ui-operational-run-list__row--selected" : undefined}
                      >
                        <td>
                          <button
                            type="button"
                            className="ui-button ui-button--ghost ui-button--sm ui-operational-run-list__inspect"
                            onClick={() => onInspectRun(row.executionId)}
                          >
                            {row.executionId}
                          </button>
                          <div className="ui-text-secondary ui-text-small">
                            {row.queueItem?.systemId ?? row.recentRun?.executionPathLabel ?? "run detail only"}
                          </div>
                        </td>
                        <td>
                          {row.queueItem ? (
                            <span className={`ui-badge ui-badge--${mapQueueStatusToTone(row.queueItem.status)}`}>{row.queueItem.status}</span>
                          ) : (
                            <span className="ui-text-secondary ui-text-small">not queued</span>
                          )}
                        </td>
                        <td>
                          {row.recentRun ? (
                            <span className={`ui-badge ui-badge--${mapRunStatusTone(row.recentRun.statusTone)}`}>{row.recentRun.statusLabel}</span>
                          ) : (
                            <span className="ui-text-secondary ui-text-small">status pending detail lookup</span>
                          )}
                        </td>
                        <td>{row.recentRun?.progressLabel ?? "-"}</td>
                        <td>{formatOperationalTimestamp(row.recentRun?.updatedAt ?? row.queueItem?.startedAt ?? row.queueItem?.enqueuedAt)}</td>
                        <td>
                          <SurfaceResponsiveActionMenuContainer responsiveProfile={responsiveProfile}>
                            <SurfaceActionMenu
                              triggerLabel="Row actions"
                              actions={createRunListRowActions({
                                row,
                                onInspectRun,
                                onCancelRun,
                                onDequeue,
                              })}
                              context={rowActionContext}
                              scope="row"
                              responsiveProfile={responsiveProfile}
                            />
                          </SurfaceResponsiveActionMenuContainer>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SurfaceResponsiveTableContainer>
        </SurfaceStateBoundary>
      </div>
    </section>
  );
}

export interface OperationalRunDetailStatusPanelProps {
  readonly selectedExecutionId?: string;
  readonly inspection?: OperationalRunInspectionState;
  readonly runDetail?: ExecutionRunDetailProjection;
  readonly isLoading: boolean;
  readonly error?: string;
  readonly realtimeConnectionState: RuntimeRealtimeConnectionStateSnapshot;
  readonly responsiveProfile: SurfaceResponsiveProfile;
  readonly actorPermissionIds: ReadonlyArray<string>;
  readonly surface: SurfaceActionSurface;
  readonly onRefresh: () => void;
  readonly onCancel: (executionId: string) => void;
}

export function OperationalRunDetailStatusPanel({
  selectedExecutionId,
  inspection,
  runDetail,
  isLoading,
  error,
  realtimeConnectionState,
  responsiveProfile,
  actorPermissionIds,
  surface,
  onRefresh,
  onCancel,
}: OperationalRunDetailStatusPanelProps): JSX.Element {
  const detailState = resolveRunDetailState({
    selectedExecutionId,
    isLoading,
    error,
    inspection,
    runDetail,
  });
  const actionContext = createSurfaceActionContext({
    actorPermissionIds,
    surface,
    surfaceCapabilities: Object.freeze(["inline-actions"]),
    selection: Object.freeze({ selectedExecutionId }),
    meta: Object.freeze({ inspectionStatus: inspection?.status }),
  });

  const actions = Object.freeze([
    {
      id: "operational-run-detail-refresh",
      label: isLoading ? "Refreshing..." : "Refresh status",
      scope: "page",
      tone: "secondary",
      requiredPermissions: Object.freeze(["runtime.run.inspect"]),
      availability: () => {
        if (!selectedExecutionId) {
          return Object.freeze({ disabled: true, disabledReason: "Select a run before refreshing." });
        }
        if (isLoading) {
          return Object.freeze({ disabled: true, disabledReason: "Run detail refresh is already in progress." });
        }
        return Object.freeze({});
      },
      onInvoke: () => {
        onRefresh();
      },
    } satisfies SurfaceActionDescriptor,
    {
      id: "operational-run-detail-cancel",
      label: "Cancel run",
      scope: "page",
      tone: "danger",
      requiredPermissions: Object.freeze(["runtime.run.cancel"]),
      availability: () => {
        if (!selectedExecutionId) {
          return Object.freeze({ disabled: true, disabledReason: "Select a run before cancelling." });
        }
        const status = inspection?.status?.toLowerCase();
        if (!status || status === "failed" || status === "cancelled" || status === "succeeded") {
          return Object.freeze({ disabled: true, disabledReason: "Only active runs can be cancelled." });
        }
        return Object.freeze({});
      },
      onInvoke: () => {
        if (!selectedExecutionId) {
          return;
        }
        onCancel(selectedExecutionId);
      },
    } satisfies SurfaceActionDescriptor,
  ]);

  return (
    <section className="ui-card ui-operational-run-detail" data-testid="operational-run-detail">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Run detail and status</h2>
        <p className="ui-card__subtitle">
          Execution state, diagnostics, and persisted run detail for the selected run.
          {" "}
          <OperationalRealtimeStatusPill connectionState={realtimeConnectionState} />
        </p>
      </div>
      <div className="ui-card__body ui-stack ui-stack--sm">
        <SurfaceActionButtonStrip
          actions={actions}
          context={actionContext}
          scope="page"
          responsiveProfile={responsiveProfile}
          className="ui-page__actions"
        />
        <SurfaceStateBoundary state={detailState}>
          <div className="ui-operational-run-detail__grid">
            <article className="ui-operational-run-detail__section">
              <h3 className="ui-text-small">Live status</h3>
              <div className="ui-stack ui-stack--2xs ui-text-small">
                <span>Execution: {inspection?.executionId ?? selectedExecutionId ?? "-"}</span>
                <span>
                  Status:{" "}
                  <span className={`ui-badge ui-badge--${mapRuntimeStatusToTone(inspection?.status)}`}>
                    {inspection?.status ?? "unknown"}
                  </span>
                </span>
                <span>Progress: {inspection?.progressLabel ?? "-"}</span>
                <span>Diagnostics: {inspection?.diagnosticsCount ?? "-"}</span>
                <span>Trace events/logs: {inspection?.traceEventCount ?? "-"} / {inspection?.traceLogCount ?? "-"}</span>
                <span>Output fields: {inspection?.outputFieldCount ?? "-"}</span>
                <span>Output contracts: {inspection?.outputContractIds?.join(", ") || "-"}</span>
              </div>
            </article>
            <article className="ui-operational-run-detail__section">
              <h3 className="ui-text-small">Persisted detail</h3>
              {runDetail ? (
                <div className="ui-stack ui-stack--2xs ui-text-small">
                  <span>Run id: {runDetail.runId}</span>
                  <span>Plan id: {runDetail.planId}</span>
                  <span>Status: {runDetail.summary.statusLabel}</span>
                  <span>Duration: {runDetail.durationSummary}</span>
                  <span>Started: {formatOperationalTimestamp(runDetail.startedAt)}</span>
                  <span>Updated: {formatOperationalTimestamp(runDetail.updatedAt)}</span>
                  <span>Completed: {formatOperationalTimestamp(runDetail.completedAt) ?? "-"}</span>
                  <span>Diagnostics summary: {runDetail.diagnosticsSummary ?? "none"}</span>
                </div>
              ) : (
                <p className="ui-text-secondary ui-text-small">
                  Persisted detail is not available yet for this run.
                </p>
              )}
            </article>
          </div>
          <article className="ui-operational-run-detail__section">
            <h3 className="ui-text-small">Execution timeline</h3>
            {runDetail && runDetail.timeline.length > 0 ? (
              <ul className="ui-text-secondary ui-text-small">
                {runDetail.timeline.slice(0, 8).map((entry, index) => (
                  <li key={`${entry.unitId}:${entry.occurredAt}:${index}`}>
                    {entry.unitLabel}: {entry.fromStatus ? `${entry.fromStatus} -> ` : ""}{entry.toStatus} ({formatOperationalTimestamp(entry.occurredAt)})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ui-text-secondary ui-text-small">No transition timeline is available for the selected run.</p>
            )}
          </article>
        </SurfaceStateBoundary>
      </div>
    </section>
  );
}

function resolveRunListState(input: {
  readonly queueError?: string;
  readonly isQueueLoading: boolean;
  readonly hasRows: boolean;
}): SurfacePresentationState | undefined {
  if (input.queueError) {
    return Object.freeze({
      kind: "error",
      title: "Run list unavailable",
      message: input.queueError,
    });
  }
  if (input.isQueueLoading && !input.hasRows) {
    return createLoadingState("Loading run list", "Loading queue and recent run visibility.");
  }
  if (!input.hasRows) {
    return createEmptyState("No runs are visible", "No queued or recent runs are currently visible for this workspace.");
  }
  return undefined;
}

function resolveRunDetailState(input: {
  readonly selectedExecutionId?: string;
  readonly isLoading: boolean;
  readonly error?: string;
  readonly inspection?: OperationalRunInspectionState;
  readonly runDetail?: ExecutionRunDetailProjection;
}): SurfacePresentationState | undefined {
  if (input.error) {
    return Object.freeze({
      kind: "error",
      title: "Run detail unavailable",
      message: input.error,
    });
  }
  if (!input.selectedExecutionId) {
    return createEmptyState("Select a run", "Pick a run from the run list to inspect detail and live status.");
  }
  if (input.isLoading && !input.inspection && !input.runDetail) {
    return createLoadingState("Loading run detail", "Loading selected run status and detail.");
  }
  if (!input.inspection && !input.runDetail) {
    return createEmptyState("Run data is not available", "The selected run has no visible status or persisted detail yet.");
  }
  return undefined;
}

function mergeOperationalRunRows(
  queueItems: ReadonlyArray<RuntimeQueueItem>,
  recentRuns: ReadonlyArray<ExecutionRunProjection>,
): ReadonlyArray<OperationalRunListRow> {
  const byExecutionId = new Map<string, OperationalRunListRow>();
  for (const item of queueItems) {
    byExecutionId.set(item.executionId, Object.freeze({ executionId: item.executionId, queueItem: item }));
  }
  for (const run of recentRuns) {
    const existing = byExecutionId.get(run.runId);
    byExecutionId.set(run.runId, Object.freeze({
      executionId: run.runId,
      queueItem: existing?.queueItem,
      recentRun: run,
    }));
  }
  return Object.freeze([...byExecutionId.values()]);
}

function createRunListRowActions(input: {
  readonly row: OperationalRunListRow;
  readonly onInspectRun: (executionId: string) => void;
  readonly onCancelRun: (executionId: string) => void;
  readonly onDequeue: (queueItemId: string) => void;
}): ReadonlyArray<SurfaceActionDescriptor> {
  const { row, onInspectRun, onCancelRun, onDequeue } = input;
  return Object.freeze([
    {
      id: `operational-run-row-inspect:${row.executionId}`,
      label: "Inspect run",
      scope: "row",
      tone: "secondary",
      requiredPermissions: Object.freeze(["runtime.run.inspect"]),
      priority: 10,
      onInvoke: () => {
        onInspectRun(row.executionId);
      },
    } satisfies SurfaceActionDescriptor,
    {
      id: `operational-run-row-cancel:${row.executionId}`,
      label: "Cancel run",
      scope: "row",
      tone: "danger",
      requiredPermissions: Object.freeze(["runtime.run.cancel"]),
      priority: 20,
      availability: () => {
        if (!row.queueItem) {
          return Object.freeze({ disabled: true, disabledReason: "Run is not currently queued or running." });
        }
        if (row.queueItem.status === "completed" || row.queueItem.status === "failed" || row.queueItem.status === "cancelled") {
          return Object.freeze({ disabled: true, disabledReason: "Run is already in a terminal queue status." });
        }
        return Object.freeze({});
      },
      onInvoke: () => {
        onCancelRun(row.executionId);
      },
    } satisfies SurfaceActionDescriptor,
    {
      id: `operational-run-row-dequeue:${row.executionId}`,
      label: "Dequeue",
      scope: "row",
      tone: "secondary",
      requiredPermissions: Object.freeze(["runtime.queue.manage"]),
      priority: 30,
      availability: () => {
        if (!row.queueItem) {
          return Object.freeze({ disabled: true, disabledReason: "Run is not in queue." });
        }
        if (row.queueItem.status !== "queued") {
          return Object.freeze({ disabled: true, disabledReason: "Only queued items can be dequeued." });
        }
        return Object.freeze({});
      },
      onInvoke: () => {
        if (row.queueItem) {
          onDequeue(row.queueItem.queueItemId);
        }
      },
    } satisfies SurfaceActionDescriptor,
  ]);
}

function mapRunStatusTone(
  statusTone: ExecutionRunProjection["statusTone"],
): "neutral" | "success" | "warning" | "danger" {
  if (statusTone === "success") {
    return "success";
  }
  if (statusTone === "warning") {
    return "warning";
  }
  if (statusTone === "danger") {
    return "danger";
  }
  return "neutral";
}

function mapQueueStatusToTone(status: RuntimeQueueItem["status"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "running") {
    return "warning";
  }
  if (status === "completed") {
    return "success";
  }
  if (status === "failed" || status === "cancelled") {
    return "danger";
  }
  return "neutral";
}

function mapRuntimeStatusToTone(status: string | undefined): "neutral" | "success" | "warning" | "danger" {
  const normalized = status?.toLowerCase();
  if (normalized === "succeeded" || normalized === "completed") {
    return "success";
  }
  if (normalized === "failed" || normalized === "cancelled") {
    return "danger";
  }
  if (normalized === "running" || normalized === "pending") {
    return "warning";
  }
  return "neutral";
}

function formatOperationalTimestamp(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
}
