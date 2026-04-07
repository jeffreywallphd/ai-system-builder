import type { RuntimeQueueItem, RuntimeQueueItemStatus } from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import {
  SurfaceActionButtonStrip,
  SurfaceActionList,
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

export const QueueVisibilityScopes = Object.freeze({
  active: "active",
  all: "all",
  queued: "queued",
  running: "running",
  terminal: "terminal",
} as const);

export type QueueVisibilityScope = typeof QueueVisibilityScopes[keyof typeof QueueVisibilityScopes];

export interface OperationalQueueFilters {
  readonly visibilityScope: QueueVisibilityScope;
  readonly systemIdFilter: string;
  readonly queryFilter: string;
}

export interface OperationalQueueRowModel {
  readonly queueItem: RuntimeQueueItem;
  readonly queueOrder?: number;
  readonly statusGroup: "active" | "terminal";
}

export interface OperationalQueueVisibilityPanelProps {
  readonly queueItems: ReadonlyArray<RuntimeQueueItem>;
  readonly totalCount: number;
  readonly selectedQueueItemId?: string;
  readonly filters: OperationalQueueFilters;
  readonly isLoading: boolean;
  readonly error?: string;
  readonly responsiveProfile: SurfaceResponsiveProfile;
  readonly actorPermissionIds: ReadonlyArray<string>;
  readonly surface: SurfaceActionSurface;
  readonly onFiltersChanged: (next: OperationalQueueFilters) => void;
  readonly onRefreshQueue: () => void;
  readonly onInspectRun: (executionId: string) => void;
  readonly onCancelRun: (executionId: string) => void;
  readonly onDequeue: (queueItemId: string) => void;
  readonly onSelectQueueItem: (queueItemId: string) => void;
}

export function OperationalQueueVisibilityPanel({
  queueItems,
  totalCount,
  selectedQueueItemId,
  filters,
  isLoading,
  error,
  responsiveProfile,
  actorPermissionIds,
  surface,
  onFiltersChanged,
  onRefreshQueue,
  onInspectRun,
  onCancelRun,
  onDequeue,
  onSelectQueueItem,
}: OperationalQueueVisibilityPanelProps): JSX.Element {
  const rows = createOperationalQueueRowModels(queueItems);
  const listState = resolveQueueListState({
    error,
    isLoading,
    hasRows: rows.length > 0,
  });
  const pageActionContext = createSurfaceActionContext({
    actorPermissionIds,
    surface,
    surfaceCapabilities: Object.freeze(["inline-actions"]),
  });
  const pageActions = Object.freeze([
    {
      id: "operational-queue-refresh",
      label: isLoading ? "Refreshing..." : "Refresh queue",
      scope: "page",
      tone: "secondary",
      requiredPermissions: Object.freeze(["runtime.queue.refresh"]),
      availability: () => (isLoading
        ? Object.freeze({ disabled: true, disabledReason: "Queue refresh is already in progress." })
        : Object.freeze({})),
      onInvoke: () => {
        onRefreshQueue();
      },
    } satisfies SurfaceActionDescriptor,
  ]);

  return (
    <section className="ui-card ui-operational-queue-visibility" data-testid="operational-queue-visibility">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Queue visibility</h2>
        <p className="ui-card__subtitle">Authorized queue state with priority and order metadata across desktop and thin-client surfaces.</p>
      </div>
      <div className="ui-card__body ui-stack ui-stack--sm">
        <OperationalQueueFiltersPanel filters={filters} totalCount={totalCount} onFiltersChanged={onFiltersChanged} />
        <SurfaceActionButtonStrip
          actions={pageActions}
          context={pageActionContext}
          scope="page"
          responsiveProfile={responsiveProfile}
          className="ui-page__actions"
        />
        <SurfaceStateBoundary state={listState}>
          <SurfaceResponsiveTableContainer responsiveProfile={responsiveProfile}>
            <div className="ui-table-wrapper">
              <table className="ui-table ui-responsive-table__table">
                <thead>
                  <tr>
                    <th scope="col">Execution</th>
                    <th scope="col">System</th>
                    <th scope="col">Status</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Order</th>
                    <th scope="col">Enqueued</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isSelected = row.queueItem.queueItemId === selectedQueueItemId;
                    const rowActionContext = createSurfaceActionContext({
                      actorPermissionIds,
                      surface,
                      surfaceCapabilities: Object.freeze(["menu-actions", "inline-actions"]),
                      resource: row,
                    });
                    return (
                      <tr key={row.queueItem.queueItemId} className={isSelected ? "ui-operational-run-list__row--selected" : undefined}>
                        <td data-label="Execution">
                          <button
                            type="button"
                            className="ui-button ui-button--ghost ui-button--sm ui-operational-run-list__inspect"
                            onClick={() => {
                              onSelectQueueItem(row.queueItem.queueItemId);
                              onInspectRun(row.queueItem.executionId);
                            }}
                          >
                            {row.queueItem.executionId}
                          </button>
                        </td>
                        <td data-label="System">
                          <span className="ui-text-secondary ui-text-small">{row.queueItem.systemId}</span>
                        </td>
                        <td data-label="Status">
                          <span className={`ui-badge ui-badge--${mapQueueStatusToTone(row.queueItem.status)}`}>{row.queueItem.status}</span>
                        </td>
                        <td data-label="Priority">
                          <span className="ui-text-small">{formatQueuePriority(row.queueItem.priority)}</span>
                        </td>
                        <td data-label="Order">
                          <span className="ui-text-small">{row.queueOrder ? `#${row.queueOrder}` : "-"}</span>
                        </td>
                        <td data-label="Enqueued">
                          <span className="ui-text-small">{formatOperationalTimestamp(row.queueItem.enqueuedAt)}</span>
                        </td>
                        <td data-label="Actions">
                          <SurfaceResponsiveActionMenuContainer responsiveProfile={responsiveProfile}>
                            {responsiveProfile.actionMenuLayout === "sheet" ? (
                              <SurfaceActionList
                                actions={createOperationalQueueRowActions({
                                  row,
                                  onInspectRun,
                                  onCancelRun,
                                  onDequeue,
                                })}
                                context={rowActionContext}
                                scope="row"
                                responsiveProfile={responsiveProfile}
                              />
                            ) : (
                              <SurfaceActionMenu
                                triggerLabel="Row actions"
                                actions={createOperationalQueueRowActions({
                                  row,
                                  onInspectRun,
                                  onCancelRun,
                                  onDequeue,
                                })}
                                context={rowActionContext}
                                scope="row"
                                responsiveProfile={responsiveProfile}
                              />
                            )}
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

export interface OperationalQueueDetailPanelProps {
  readonly queueItems: ReadonlyArray<RuntimeQueueItem>;
  readonly selectedQueueItemId?: string;
  readonly responsiveProfile: SurfaceResponsiveProfile;
  readonly actorPermissionIds: ReadonlyArray<string>;
  readonly surface: SurfaceActionSurface;
  readonly isLoading: boolean;
  readonly error?: string;
  readonly onRefreshQueue: () => void;
  readonly onInspectRun: (executionId: string) => void;
  readonly onCancelRun: (executionId: string) => void;
  readonly onDequeue: (queueItemId: string) => void;
}

export function OperationalQueueDetailPanel({
  queueItems,
  selectedQueueItemId,
  responsiveProfile,
  actorPermissionIds,
  surface,
  isLoading,
  error,
  onRefreshQueue,
  onInspectRun,
  onCancelRun,
  onDequeue,
}: OperationalQueueDetailPanelProps): JSX.Element {
  const rows = createOperationalQueueRowModels(queueItems);
  const selectedRow = rows.find((row) => row.queueItem.queueItemId === selectedQueueItemId);
  const panelState = resolveQueueDetailState({
    selectedQueueItemId,
    selectedRow,
    isLoading,
    error,
  });
  const actionContext = createSurfaceActionContext({
    actorPermissionIds,
    surface,
    surfaceCapabilities: Object.freeze(["inline-actions"]),
    resource: selectedRow,
  });
  const actions = Object.freeze([
    {
      id: "operational-queue-detail-refresh",
      label: isLoading ? "Refreshing..." : "Refresh queue",
      scope: "page",
      tone: "secondary",
      requiredPermissions: Object.freeze(["runtime.queue.refresh"]),
      availability: () => (isLoading
        ? Object.freeze({ disabled: true, disabledReason: "Queue refresh is already in progress." })
        : Object.freeze({})),
      onInvoke: () => {
        onRefreshQueue();
      },
    } satisfies SurfaceActionDescriptor,
    {
      id: "operational-queue-detail-inspect",
      label: "Inspect run",
      scope: "page",
      tone: "secondary",
      requiredPermissions: Object.freeze(["runtime.run.inspect"]),
      availability: () => (!selectedRow
        ? Object.freeze({ disabled: true, disabledReason: "Select a queue item before inspecting." })
        : Object.freeze({})),
      onInvoke: () => {
        if (!selectedRow) {
          return;
        }
        onInspectRun(selectedRow.queueItem.executionId);
      },
    } satisfies SurfaceActionDescriptor,
    {
      id: "operational-queue-detail-cancel",
      label: "Cancel run",
      scope: "page",
      tone: "danger",
      requiredPermissions: Object.freeze(["runtime.run.cancel"]),
      availability: () => {
        if (!selectedRow) {
          return Object.freeze({ disabled: true, disabledReason: "Select a queue item before cancelling." });
        }
        if (selectedRow.statusGroup !== "active") {
          return Object.freeze({ disabled: true, disabledReason: "Terminal queue items cannot be cancelled." });
        }
        return Object.freeze({});
      },
      onInvoke: () => {
        if (!selectedRow) {
          return;
        }
        onCancelRun(selectedRow.queueItem.executionId);
      },
    } satisfies SurfaceActionDescriptor,
    {
      id: "operational-queue-detail-dequeue",
      label: "Dequeue item",
      scope: "page",
      tone: "secondary",
      requiredPermissions: Object.freeze(["runtime.queue.manage"]),
      availability: () => {
        if (!selectedRow) {
          return Object.freeze({ disabled: true, disabledReason: "Select a queue item before dequeuing." });
        }
        if (selectedRow.queueItem.status !== "queued") {
          return Object.freeze({ disabled: true, disabledReason: "Only queued items can be dequeued." });
        }
        return Object.freeze({});
      },
      onInvoke: () => {
        if (!selectedRow) {
          return;
        }
        onDequeue(selectedRow.queueItem.queueItemId);
      },
    } satisfies SurfaceActionDescriptor,
  ]);

  return (
    <section className="ui-card ui-operational-queue-detail" data-testid="operational-queue-detail">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Queue detail</h2>
        <p className="ui-card__subtitle">Selected queue item timing, priority/order detail, and lightweight queue controls.</p>
      </div>
      <div className="ui-card__body ui-stack ui-stack--sm">
        <SurfaceActionButtonStrip
          actions={actions}
          context={actionContext}
          scope="page"
          responsiveProfile={responsiveProfile}
          className="ui-page__actions"
        />
        <SurfaceStateBoundary state={panelState}>
          <div className="ui-operational-run-detail__section">
            <div className="ui-stack ui-stack--2xs ui-text-small">
              <span>Queue item: {selectedRow?.queueItem.queueItemId ?? "-"}</span>
              <span>Execution: {selectedRow?.queueItem.executionId ?? "-"}</span>
              <span>System: {selectedRow?.queueItem.systemId ?? "-"}</span>
              <span>
                Status:{" "}
                <span className={`ui-badge ui-badge--${mapQueueStatusToTone(selectedRow?.queueItem.status ?? "queued")}`}>
                  {selectedRow?.queueItem.status ?? "unknown"}
                </span>
              </span>
              <span>Priority: {formatQueuePriority(selectedRow?.queueItem.priority)}</span>
              <span>Queue order: {selectedRow?.queueOrder ? `#${selectedRow.queueOrder}` : "-"}</span>
              <span>Enqueued: {formatOperationalTimestamp(selectedRow?.queueItem.enqueuedAt) ?? "-"}</span>
              <span>Started: {formatOperationalTimestamp(selectedRow?.queueItem.startedAt) ?? "-"}</span>
              <span>Completed: {formatOperationalTimestamp(selectedRow?.queueItem.completedAt) ?? "-"}</span>
            </div>
          </div>
        </SurfaceStateBoundary>
      </div>
    </section>
  );
}

interface OperationalQueueFiltersPanelProps {
  readonly filters: OperationalQueueFilters;
  readonly totalCount: number;
  readonly onFiltersChanged: (next: OperationalQueueFilters) => void;
}

function OperationalQueueFiltersPanel({
  filters,
  totalCount,
  onFiltersChanged,
}: OperationalQueueFiltersPanelProps): JSX.Element {
  return (
    <section className="ui-operational-queue-filters">
      <div className="ui-operational-queue-filters__row">
        <label className="ui-field">
          <span className="ui-field__label">Visibility</span>
          <select
            className="ui-select"
            value={filters.visibilityScope}
            onChange={(event) => onFiltersChanged(Object.freeze({
              ...filters,
              visibilityScope: toQueueVisibilityScope(event.target.value),
            }))}
          >
            <option value={QueueVisibilityScopes.active}>Active (queued + running)</option>
            <option value={QueueVisibilityScopes.all}>All statuses</option>
            <option value={QueueVisibilityScopes.queued}>Queued only</option>
            <option value={QueueVisibilityScopes.running}>Running only</option>
            <option value={QueueVisibilityScopes.terminal}>Terminal only</option>
          </select>
        </label>
        <label className="ui-field">
          <span className="ui-field__label">System filter</span>
          <input
            className="ui-input"
            value={filters.systemIdFilter}
            onChange={(event) => onFiltersChanged(Object.freeze({
              ...filters,
              systemIdFilter: event.target.value,
            }))}
            placeholder="system id"
          />
        </label>
        <label className="ui-field">
          <span className="ui-field__label">Execution query</span>
          <input
            className="ui-input"
            value={filters.queryFilter}
            onChange={(event) => onFiltersChanged(Object.freeze({
              ...filters,
              queryFilter: event.target.value,
            }))}
            placeholder="execution id"
          />
        </label>
      </div>
      <p className="ui-text-secondary ui-text-small">Visible queue items: {totalCount}</p>
    </section>
  );
}

export function createOperationalQueueRowModels(
  queueItems: ReadonlyArray<RuntimeQueueItem>,
): ReadonlyArray<OperationalQueueRowModel> {
  const sorted = [...queueItems].sort(compareOperationalQueueItems);
  let activeOrder = 0;
  return Object.freeze(sorted.map((queueItem) => {
    const statusGroup = isActiveQueueStatus(queueItem.status) ? "active" : "terminal";
    if (statusGroup === "active") {
      activeOrder += 1;
    }
    return Object.freeze({
      queueItem,
      statusGroup,
      queueOrder: statusGroup === "active" ? activeOrder : undefined,
    });
  }));
}

export function resolveQueueVisibilityStatuses(
  visibilityScope: QueueVisibilityScope,
): ReadonlyArray<RuntimeQueueItemStatus> | undefined {
  if (visibilityScope === QueueVisibilityScopes.all) {
    return undefined;
  }
  if (visibilityScope === QueueVisibilityScopes.queued) {
    return Object.freeze(["queued"]);
  }
  if (visibilityScope === QueueVisibilityScopes.running) {
    return Object.freeze(["running"]);
  }
  if (visibilityScope === QueueVisibilityScopes.terminal) {
    return Object.freeze(["completed", "failed", "cancelled"]);
  }
  return Object.freeze(["queued", "running"]);
}

export function createOperationalQueueRowActions(input: {
  readonly row: OperationalQueueRowModel;
  readonly onInspectRun: (executionId: string) => void;
  readonly onCancelRun: (executionId: string) => void;
  readonly onDequeue: (queueItemId: string) => void;
}): ReadonlyArray<SurfaceActionDescriptor<OperationalQueueRowModel>> {
  const { row, onInspectRun, onCancelRun, onDequeue } = input;
  return Object.freeze([
    {
      id: `operational-queue-row-inspect:${row.queueItem.queueItemId}`,
      label: "Inspect run",
      scope: "row",
      tone: "secondary",
      requiredPermissions: Object.freeze(["runtime.run.inspect"]),
      priority: 10,
      onInvoke: () => {
        onInspectRun(row.queueItem.executionId);
      },
    } satisfies SurfaceActionDescriptor<OperationalQueueRowModel>,
    {
      id: `operational-queue-row-cancel:${row.queueItem.queueItemId}`,
      label: "Cancel run",
      scope: "row",
      tone: "danger",
      requiredPermissions: Object.freeze(["runtime.run.cancel"]),
      priority: 20,
      availability: () => {
        if (!isActiveQueueStatus(row.queueItem.status)) {
          return Object.freeze({ disabled: true, disabledReason: "Only active queue items can be cancelled." });
        }
        return Object.freeze({});
      },
      onInvoke: () => {
        onCancelRun(row.queueItem.executionId);
      },
    } satisfies SurfaceActionDescriptor<OperationalQueueRowModel>,
    {
      id: `operational-queue-row-dequeue:${row.queueItem.queueItemId}`,
      label: "Dequeue",
      scope: "row",
      tone: "secondary",
      requiredPermissions: Object.freeze(["runtime.queue.manage"]),
      priority: 30,
      availability: () => {
        if (row.queueItem.status !== "queued") {
          return Object.freeze({ disabled: true, disabledReason: "Only queued items can be dequeued." });
        }
        return Object.freeze({});
      },
      onInvoke: () => {
        onDequeue(row.queueItem.queueItemId);
      },
    } satisfies SurfaceActionDescriptor<OperationalQueueRowModel>,
  ]);
}

function resolveQueueListState(input: {
  readonly error?: string;
  readonly isLoading: boolean;
  readonly hasRows: boolean;
}): SurfacePresentationState | undefined {
  if (input.error) {
    return Object.freeze({
      kind: "error",
      title: "Queue visibility unavailable",
      message: input.error,
    });
  }
  if (input.isLoading && !input.hasRows) {
    return createLoadingState("Loading queue visibility", "Loading authorized queue items and scheduling metadata.");
  }
  if (!input.hasRows) {
    return createEmptyState("No queue items are visible", "No queue items matched the current queue visibility filters.");
  }
  return undefined;
}

function resolveQueueDetailState(input: {
  readonly selectedQueueItemId?: string;
  readonly selectedRow?: OperationalQueueRowModel;
  readonly isLoading: boolean;
  readonly error?: string;
}): SurfacePresentationState | undefined {
  if (input.error) {
    return Object.freeze({
      kind: "error",
      title: "Queue detail unavailable",
      message: input.error,
    });
  }
  if (!input.selectedQueueItemId) {
    return createEmptyState("Select a queue item", "Choose a queue item from the visibility list to inspect queue detail.");
  }
  if (input.isLoading && !input.selectedRow) {
    return createLoadingState("Loading queue detail", "Loading selected queue item details.");
  }
  if (!input.selectedRow) {
    return createEmptyState("Queue item not found", "The selected queue item is no longer visible in the current queue filter window.");
  }
  return undefined;
}

function toQueueVisibilityScope(raw: string): QueueVisibilityScope {
  if (raw === QueueVisibilityScopes.all) {
    return QueueVisibilityScopes.all;
  }
  if (raw === QueueVisibilityScopes.queued) {
    return QueueVisibilityScopes.queued;
  }
  if (raw === QueueVisibilityScopes.running) {
    return QueueVisibilityScopes.running;
  }
  if (raw === QueueVisibilityScopes.terminal) {
    return QueueVisibilityScopes.terminal;
  }
  return QueueVisibilityScopes.active;
}

function compareOperationalQueueItems(left: RuntimeQueueItem, right: RuntimeQueueItem): number {
  const statusRankDelta = toQueueStatusRank(left.status) - toQueueStatusRank(right.status);
  if (statusRankDelta !== 0) {
    return statusRankDelta;
  }
  const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }
  return (toComparableTime(left.enqueuedAt) - toComparableTime(right.enqueuedAt))
    || left.queueItemId.localeCompare(right.queueItemId);
}

function toQueueStatusRank(status: RuntimeQueueItemStatus): number {
  if (status === "running") {
    return 0;
  }
  if (status === "queued") {
    return 1;
  }
  if (status === "failed") {
    return 2;
  }
  if (status === "cancelled") {
    return 3;
  }
  return 4;
}

function isActiveQueueStatus(status: RuntimeQueueItemStatus): boolean {
  return status === "queued" || status === "running";
}

function mapQueueStatusToTone(status: RuntimeQueueItemStatus): "neutral" | "success" | "warning" | "danger" {
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

function formatQueuePriority(priority: number | undefined): string {
  if (typeof priority !== "number" || !Number.isFinite(priority)) {
    return "default";
  }
  return priority.toString(10);
}

function toComparableTime(value: string | undefined): number {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
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
