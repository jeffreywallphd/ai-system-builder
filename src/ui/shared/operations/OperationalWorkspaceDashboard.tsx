import type { ExecutionRunProjection } from "@application/execution/ExecutionRunProjectionService";
import type { RuntimeQueueItem } from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import type { RuntimeRealtimeConnectionStateSnapshot } from "@shared/runtime/RuntimeRealtimeSubscriptionService";
import type { OperationalWorkspaceDashboardModel, OperationalWorkspaceRecentOutputSummary } from "../../presenters/OperationalWorkspaceDashboardPresenter";
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
  SurfaceResponsiveStatusCardGroup,
} from "../components/shell";
import type { SurfaceResponsiveProfile } from "../responsive";
import { OperationalRealtimeStatusPill } from "./OperationalRealtimeIndicators";

export interface OperationalWorkspaceDashboardProps {
  readonly model: OperationalWorkspaceDashboardModel;
  readonly queueItems: ReadonlyArray<RuntimeQueueItem>;
  readonly recentRuns: ReadonlyArray<ExecutionRunProjection>;
  readonly recentOutputs: ReadonlyArray<OperationalWorkspaceRecentOutputSummary>;
  readonly isQueueLoading: boolean;
  readonly isRecentOutputsLoading: boolean;
  readonly queueError?: string;
  readonly recentOutputsError?: string;
  readonly realtimeConnectionState: RuntimeRealtimeConnectionStateSnapshot;
  readonly responsiveProfile: SurfaceResponsiveProfile;
  readonly actorPermissionIds: ReadonlyArray<string>;
  readonly surface: SurfaceActionSurface;
  readonly onRefreshQueue: () => void;
  readonly onInspectRun: (executionId: string) => void;
  readonly onCancelRun: (executionId: string) => void;
  readonly onDequeue: (queueItemId: string) => void;
  readonly onOpenNodeInventory: () => void;
}

export default function OperationalWorkspaceDashboard({
  model,
  queueItems,
  recentRuns,
  recentOutputs,
  isQueueLoading,
  isRecentOutputsLoading,
  queueError,
  recentOutputsError,
  realtimeConnectionState,
  responsiveProfile,
  actorPermissionIds,
  surface,
  onRefreshQueue,
  onInspectRun,
  onCancelRun,
  onDequeue,
  onOpenNodeInventory,
}: OperationalWorkspaceDashboardProps): JSX.Element {
  const pageActionContext = createSurfaceActionContext({
    actorPermissionIds,
    surface,
    surfaceCapabilities: Object.freeze(["inline-actions"]),
  });
  const queueRefreshAction = Object.freeze([
    {
      id: "operational-dashboard-refresh-queue",
      label: isQueueLoading ? "Refreshing queue..." : "Refresh queue",
      scope: "page",
      tone: "secondary",
      requiredPermissions: Object.freeze(["runtime.queue.refresh"]),
      availability: () => (isQueueLoading
        ? Object.freeze({ disabled: true, disabledReason: "Queue refresh is already in progress." })
        : Object.freeze({})),
      onInvoke: () => {
        onRefreshQueue();
      },
    } satisfies SurfaceActionDescriptor,
  ]);

  return (
    <div className="ui-operational-dashboard ui-stack ui-stack--md" data-testid="operational-workspace-dashboard">
      <SurfaceResponsiveStatusCardGroup responsiveProfile={responsiveProfile}>
        <div className="ui-responsive-status-cards__grid ui-operational-dashboard__summary-grid">
          <article className="ui-card ui-operational-dashboard__summary-card">
            <div className="ui-card__body ui-stack ui-stack--2xs">
              <span className="ui-text-secondary ui-text-small">Queue</span>
              <strong>{model.queue.totalCount}</strong>
              <span className="ui-text-small ui-text-secondary">
                {model.queue.queuedCount} queued, {model.queue.runningCount} running
              </span>
            </div>
          </article>
          <article className="ui-card ui-operational-dashboard__summary-card">
            <div className="ui-card__body ui-stack ui-stack--2xs">
              <span className="ui-text-secondary ui-text-small">Recent runs</span>
              <strong>{model.runs.totalCount}</strong>
              <span className="ui-text-small ui-text-secondary">
                {model.runs.runningCount} running, {model.runs.failedCount} failed, {model.runs.cancelledCount} cancelled
              </span>
            </div>
          </article>
          <article className="ui-card ui-operational-dashboard__summary-card">
            <div className="ui-card__body ui-stack ui-stack--2xs">
              <span className="ui-text-secondary ui-text-small">Recent outputs</span>
              <strong>{model.outputs.totalCount}</strong>
              <span className="ui-text-small ui-text-secondary">
                {model.outputs.contractCount} output contract references
              </span>
            </div>
          </article>
          <article className="ui-card ui-operational-dashboard__summary-card">
            <div className="ui-card__body ui-stack ui-stack--2xs">
              <span className="ui-text-secondary ui-text-small">Node availability</span>
              <strong>{model.nodes.totalCount}</strong>
              <span className="ui-text-small ui-text-secondary">
                {model.nodes.onlineCount} online, {model.nodes.degradedCount} degraded, {model.nodes.offlineCount} offline/unknown
              </span>
            </div>
          </article>
        </div>
      </SurfaceResponsiveStatusCardGroup>

      <section className="ui-card" data-testid="operational-dashboard-alerts">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Actionable alerts</h2>
          <p className="ui-card__subtitle">Prioritized operational conditions generated from shared queue, run, node, and realtime status models.</p>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          {model.alerts.length === 0 ? (
            <p className="ui-text-secondary">No operational alerts are active right now.</p>
          ) : (
            model.alerts.map((alert) => (
              <article key={alert.id} className={`ui-operational-dashboard__alert ui-operational-dashboard__alert--${alert.tone}`}>
                <div className="ui-stack ui-stack--2xs">
                  <strong>{alert.title}</strong>
                  <span className="ui-text-small">{alert.message}</span>
                </div>
                {alert.action.kind === "none" ? null : (
                  <div className="ui-page__actions">
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--small"
                      onClick={() => {
                        if (alert.action.kind === "refresh-queue") {
                          onRefreshQueue();
                          return;
                        }
                        if (alert.action.kind === "inspect-run") {
                          onInspectRun(alert.action.executionId);
                          return;
                        }
                        if (alert.action.kind === "open-node-inventory") {
                          onOpenNodeInventory();
                        }
                      }}
                    >
                      {alert.action.label}
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      <div className="ui-operational-dashboard__grid">
        <section className="ui-card" data-testid="operational-dashboard-queue">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Queue state</h2>
            <p className="ui-card__subtitle">
              <OperationalRealtimeStatusPill connectionState={realtimeConnectionState} staleLabel="stale fallback" />
            </p>
          </div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            <SurfaceActionButtonStrip
              actions={queueRefreshAction}
              context={pageActionContext}
              scope="page"
              responsiveProfile={responsiveProfile}
              className="ui-page__actions"
            />
            {queueError ? <p role="alert">{queueError}</p> : null}
            {queueItems.length === 0 ? (
              <p className="ui-text-secondary">No queued or running executions are visible for this workspace.</p>
            ) : (
              <div className="ui-stack ui-stack--xs">
                {queueItems.map((item) => (
                  <article key={item.queueItemId} className="ui-operational-dashboard__item">
                    <div className="ui-row ui-row--between ui-row--wrap">
                      <strong className="ui-operational-truncate" title={item.executionId}>{item.executionId}</strong>
                      <span className="ui-badge ui-badge--neutral">{item.status}</span>
                    </div>
                    <p className="ui-text-small ui-text-secondary ui-operational-truncate" title={item.systemId}>{item.systemId}</p>
                    <SurfaceResponsiveActionMenuContainer responsiveProfile={responsiveProfile}>
                      {responsiveProfile.actionMenuLayout === "sheet" ? (
                        <SurfaceActionList
                          actions={createDashboardQueueItemActions({
                            queueItem: item,
                            onInspectRun,
                            onCancelRun,
                            onDequeue,
                          })}
                          context={createSurfaceActionContext({
                            actorPermissionIds,
                            surface,
                            surfaceCapabilities: Object.freeze(["inline-actions", "menu-actions"]),
                            resource: item,
                          })}
                          scope="row"
                          responsiveProfile={responsiveProfile}
                        />
                      ) : (
                        <SurfaceActionMenu
                          triggerLabel="Queue item actions"
                          actions={createDashboardQueueItemActions({
                            queueItem: item,
                            onInspectRun,
                            onCancelRun,
                            onDequeue,
                          })}
                          context={createSurfaceActionContext({
                            actorPermissionIds,
                            surface,
                            surfaceCapabilities: Object.freeze(["inline-actions", "menu-actions"]),
                            resource: item,
                          })}
                          scope="row"
                          responsiveProfile={responsiveProfile}
                        />
                      )}
                    </SurfaceResponsiveActionMenuContainer>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="ui-card" data-testid="operational-dashboard-runs">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Recent runs</h2>
            <p className="ui-card__subtitle">Latest workspace run projections from persistent execution history.</p>
          </div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            {recentRuns.length === 0 ? (
              <p className="ui-text-secondary">No recent runs are available yet.</p>
            ) : (
              <div className="ui-stack ui-stack--xs">
                {recentRuns.map((run) => (
                  <article key={run.runId} className="ui-operational-dashboard__item">
                    <div className="ui-row ui-row--between ui-row--wrap">
                      <strong className="ui-operational-truncate" title={run.runId}>{run.runId}</strong>
                      <span className={`ui-badge ui-badge--${statusToneToBadgeTone(run.statusTone)}`}>{run.statusLabel}</span>
                    </div>
                    <p className="ui-text-small ui-text-secondary">{run.progressLabel}</p>
                    <p className="ui-text-small ui-text-secondary ui-operational-truncate" title={run.executionPathLabel}>{run.executionPathLabel}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="ui-card" data-testid="operational-dashboard-outputs">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Recent outputs</h2>
            <p className="ui-card__subtitle">Output summaries inspected from authoritative runtime result contracts.</p>
          </div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            {isRecentOutputsLoading ? <p className="ui-text-secondary">Loading recent output summaries...</p> : null}
            {recentOutputsError ? <p role="alert">{recentOutputsError}</p> : null}
            {!isRecentOutputsLoading && !recentOutputsError && recentOutputs.length === 0 ? (
              <p className="ui-text-secondary">No output-bearing runs were found in the recent operational window.</p>
            ) : null}
            {!isRecentOutputsLoading && !recentOutputsError && recentOutputs.length > 0 ? (
              <div className="ui-stack ui-stack--xs">
                {recentOutputs.map((output) => (
                  <article key={output.executionId} className="ui-operational-dashboard__item">
                    <div className="ui-row ui-row--between ui-row--wrap">
                      <strong className="ui-operational-truncate" title={output.executionId}>{output.executionId}</strong>
                      <span className="ui-badge ui-badge--neutral">{output.status ?? "unknown"}</span>
                    </div>
                    <p className="ui-text-small ui-text-secondary">
                      {output.outputFieldCount} output fields, {output.outputContractIds.length} contract ids
                    </p>
                    <p className="ui-text-small ui-text-secondary ui-operational-truncate" title={output.outputContractIds.join(", ") || "No output contract ids."}>
                      {output.outputContractIds.join(", ") || "No output contract ids."}
                    </p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="ui-card" data-testid="operational-dashboard-nodes">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Node availability</h2>
            <p className="ui-card__subtitle">Operational and presence summary from trusted node inventory contracts.</p>
          </div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            <div className="ui-operational-dashboard__node-grid">
              <span className="ui-badge ui-badge--success">online: {model.nodes.onlineCount}</span>
              <span className="ui-badge ui-badge--warning">degraded: {model.nodes.degradedCount}</span>
              <span className="ui-badge ui-badge--danger">offline: {model.nodes.offlineCount}</span>
              <span className="ui-badge ui-badge--neutral">pending: {model.nodes.pendingCount}</span>
              <span className="ui-badge ui-badge--danger">revoked: {model.nodes.revokedCount}</span>
            </div>
            <div className="ui-page__actions">
              <button type="button" className="ui-button ui-button--ghost ui-button--small" onClick={onOpenNodeInventory}>
                Open node inventory
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function createDashboardQueueItemActions(input: {
  readonly queueItem: RuntimeQueueItem;
  readonly onInspectRun: (executionId: string) => void;
  readonly onCancelRun: (executionId: string) => void;
  readonly onDequeue: (queueItemId: string) => void;
}): ReadonlyArray<SurfaceActionDescriptor<RuntimeQueueItem>> {
  const { queueItem, onInspectRun, onCancelRun, onDequeue } = input;
  return Object.freeze([
    {
      id: `operational-dashboard-inspect:${queueItem.queueItemId}`,
      label: "Inspect run",
      scope: "row",
      tone: "secondary",
      requiredPermissions: Object.freeze(["runtime.run.inspect"]),
      onInvoke: () => {
        onInspectRun(queueItem.executionId);
      },
    } satisfies SurfaceActionDescriptor<RuntimeQueueItem>,
    {
      id: `operational-dashboard-cancel:${queueItem.queueItemId}`,
      label: "Cancel run",
      scope: "row",
      tone: "danger",
      requiredPermissions: Object.freeze(["runtime.run.cancel"]),
      availability: () => (
        queueItem.status === "queued" || queueItem.status === "running"
          ? Object.freeze({})
          : Object.freeze({ disabled: true, disabledReason: "Only active queue items can be cancelled." })
      ),
      onInvoke: () => {
        onCancelRun(queueItem.executionId);
      },
    } satisfies SurfaceActionDescriptor<RuntimeQueueItem>,
    {
      id: `operational-dashboard-dequeue:${queueItem.queueItemId}`,
      label: "Dequeue",
      scope: "row",
      tone: "secondary",
      requiredPermissions: Object.freeze(["runtime.queue.manage"]),
      availability: () => (
        queueItem.status === "queued"
          ? Object.freeze({})
          : Object.freeze({ disabled: true, disabledReason: "Only queued items can be dequeued." })
      ),
      onInvoke: () => {
        onDequeue(queueItem.queueItemId);
      },
    } satisfies SurfaceActionDescriptor<RuntimeQueueItem>,
  ]);
}

function statusToneToBadgeTone(
  tone: ExecutionRunProjection["statusTone"],
): "neutral" | "success" | "warning" | "danger" {
  if (tone === "success") {
    return "success";
  }
  if (tone === "warning") {
    return "warning";
  }
  if (tone === "danger") {
    return "danger";
  }
  return "neutral";
}
