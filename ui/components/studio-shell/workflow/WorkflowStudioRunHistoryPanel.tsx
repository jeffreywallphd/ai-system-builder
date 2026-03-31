import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  WorkflowRunStatuses,
  WorkflowRunTriggerSources,
  type WorkflowRunStatus,
} from "../../../../domain/workflow-studio/WorkflowRunHistoryDomain";
import type {
  WorkflowRunDetailReadModel,
  WorkflowRunSummaryReadModel,
} from "../../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import { StudioShellService } from "../../../services/StudioShellService";
import {
  buildWorkflowStudioRunDetailPath,
  buildWorkflowStudioRunHistoryPath,
} from "../../../studio-shell/workflow/WorkflowStudioRunRouting";
import { ROUTE_PATHS } from "../../../routes/RouteConfig";

type WorkflowRunSortOrder = "recency" | "duration" | "status";
type WorkflowRunStatusFilter = WorkflowRunStatus | "all";

export interface WorkflowStudioRunHistoryPanelProps {
  readonly workflowId?: string;
  readonly workflowName?: string;
}

export function applyWorkflowRunFiltersAndSort(
  runs: ReadonlyArray<WorkflowRunSummaryReadModel>,
  statusFilter: WorkflowRunStatusFilter,
  sortOrder: WorkflowRunSortOrder,
): ReadonlyArray<WorkflowRunSummaryReadModel> {
  const withFilter = statusFilter === "all"
    ? [...runs]
    : runs.filter((run) => run.status === statusFilter);

  withFilter.sort((left, right) => {
    if (sortOrder === "duration") {
      const leftDuration = left.durationMs ?? -1;
      const rightDuration = right.durationMs ?? -1;
      if (leftDuration !== rightDuration) {
        return rightDuration - leftDuration;
      }
    } else if (sortOrder === "status") {
      const statusDelta = left.status.localeCompare(right.status);
      if (statusDelta !== 0) {
        return statusDelta;
      }
    }

    return Date.parse(right.startedAt) - Date.parse(left.startedAt);
  });
  return Object.freeze(withFilter);
}

function toStatusTone(status: WorkflowRunStatus): "success" | "danger" | "warning" | "neutral" {
  if (status === WorkflowRunStatuses.completed) {
    return "success";
  }
  if (status === WorkflowRunStatuses.failed) {
    return "danger";
  }
  if (status === WorkflowRunStatuses.running || status === WorkflowRunStatuses.queued) {
    return "warning";
  }
  return "neutral";
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) {
    return "-";
  }
  if (durationMs < 1_000) {
    return `${Math.round(durationMs)} ms`;
  }

  const totalSeconds = Math.floor(durationMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatStructuredJson(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeTriggerSourceLabel(source: WorkflowRunSummaryReadModel["triggerSource"]): string {
  switch (source) {
    case WorkflowRunTriggerSources.manual:
      return "Manual";
    case WorkflowRunTriggerSources.schedule:
      return "Schedule";
    case WorkflowRunTriggerSources.event:
      return "Event";
    case WorkflowRunTriggerSources.api:
      return "API";
    case WorkflowRunTriggerSources.system:
      return "System";
    default:
      return "Unknown";
  }
}

function normalizeStatusLabel(status: WorkflowRunStatus): string {
  switch (status) {
    case WorkflowRunStatuses.completed:
      return "Completed";
    case WorkflowRunStatuses.failed:
      return "Failed";
    case WorkflowRunStatuses.running:
      return "Running";
    case WorkflowRunStatuses.cancelled:
      return "Cancelled";
    case WorkflowRunStatuses.queued:
      return "Queued";
    default:
      return status;
  }
}

export default function WorkflowStudioRunHistoryPanel({
  workflowId,
  workflowName,
}: WorkflowStudioRunHistoryPanelProps): JSX.Element {
  const service = useMemo(() => new StudioShellService(), []);
  const location = useLocation();
  const routeParams = useParams<{ runId?: string }>();
  const selectedRunId = routeParams.runId?.trim();
  const isRunHistoryRoute = location.pathname.startsWith(ROUTE_PATHS.workflowStudioRuns);
  const [isLoadingRuns, setIsLoadingRuns] = useState(Boolean(workflowId));
  const [runLoadError, setRunLoadError] = useState<string | undefined>();
  const [runs, setRuns] = useState<ReadonlyArray<WorkflowRunSummaryReadModel>>([]);
  const [statusFilter, setStatusFilter] = useState<WorkflowRunStatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<WorkflowRunSortOrder>("recency");
  const [isLoadingDetail, setIsLoadingDetail] = useState(Boolean(selectedRunId));
  const [detailError, setDetailError] = useState<string | undefined>();
  const [selectedDetail, setSelectedDetail] = useState<WorkflowRunDetailReadModel | undefined>();
  const [isDetailMissing, setIsDetailMissing] = useState(false);

  useEffect(() => {
    if (!workflowId) {
      setRuns([]);
      setRunLoadError(undefined);
      return;
    }

    let active = true;
    setIsLoadingRuns(true);
    setRunLoadError(undefined);

    void service.listWorkflowRuns({
      workflowId,
      limit: 200,
    }).then((response) => {
      if (!active) {
        return;
      }
      if (!response.ok) {
        setRuns([]);
        setRunLoadError(response.error?.message ?? "Workflow run history could not be loaded.");
        return;
      }
      setRuns(response.data ?? []);
    }).catch((error: unknown) => {
      if (!active) {
        return;
      }
      setRuns([]);
      setRunLoadError(error instanceof Error ? error.message : "Workflow run history could not be loaded.");
    }).finally(() => {
      if (active) {
        setIsLoadingRuns(false);
      }
    });

    return () => {
      active = false;
    };
  }, [service, workflowId]);

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedDetail(undefined);
      setDetailError(undefined);
      setIsDetailMissing(false);
      return;
    }

    let active = true;
    setIsLoadingDetail(true);
    setDetailError(undefined);
    setIsDetailMissing(false);

    void service.getWorkflowRunDetail(selectedRunId).then((response) => {
      if (!active) {
        return;
      }
      if (!response.ok) {
        if (response.error?.code === "not-found") {
          setSelectedDetail(undefined);
          setIsDetailMissing(true);
          return;
        }
        setSelectedDetail(undefined);
        setDetailError(response.error?.message ?? "Workflow run detail could not be loaded.");
        return;
      }
      setSelectedDetail(response.data);
    }).catch((error: unknown) => {
      if (!active) {
        return;
      }
      setSelectedDetail(undefined);
      setDetailError(error instanceof Error ? error.message : "Workflow run detail could not be loaded.");
    }).finally(() => {
      if (active) {
        setIsLoadingDetail(false);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedRunId, service]);

  const filteredRuns = useMemo(() => {
    return applyWorkflowRunFiltersAndSort(runs, statusFilter, sortOrder);
  }, [runs, sortOrder, statusFilter]);

  if (!workflowId) {
    return (
      <div className="ui-empty-state" data-testid="workflow-run-history-unavailable">
        <p className="ui-text-secondary">
          Save this workflow draft to enable persisted run history.
        </p>
      </div>
    );
  }

  const heading = workflowName ? `Run history for ${workflowName}` : "Workflow run history";

  return (
    <div className="ui-stack ui-stack--sm" data-testid="workflow-run-history-panel">
      <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
        <div>
          <h3 style={{ margin: 0 }}>{heading}</h3>
          <p className="ui-text-secondary ui-text-small" style={{ marginTop: "var(--space-2xs)" }}>
            Durable run summaries and structured workflow-level run detail.
          </p>
        </div>
        <div className="ui-row ui-row--wrap" style={{ gap: "var(--space-xs)" }}>
          {isRunHistoryRoute ? (
            <Link className="ui-button ui-button--ghost ui-button--sm" to={ROUTE_PATHS.workflowStudio}>
              Back to workflow editor
            </Link>
          ) : (
            <Link className="ui-button ui-button--ghost ui-button--sm" to={buildWorkflowStudioRunHistoryPath()}>
              Open run history view
            </Link>
          )}
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            onClick={() => {
              setIsLoadingRuns(true);
              void service.listWorkflowRuns({ workflowId, limit: 200 }).then((response) => {
                if (response.ok) {
                  setRuns(response.data ?? []);
                  setRunLoadError(undefined);
                } else {
                  setRunLoadError(response.error?.message ?? "Workflow run history could not be loaded.");
                }
              }).catch((error: unknown) => {
                setRunLoadError(error instanceof Error ? error.message : "Workflow run history could not be loaded.");
              }).finally(() => setIsLoadingRuns(false));
            }}
          >
            Refresh runs
          </button>
        </div>
      </div>

      <div className="ui-form-grid">
        <label className="ui-field">
          <span className="ui-field__label">Status filter</span>
          <select
            className="ui-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as WorkflowRunStatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value={WorkflowRunStatuses.queued}>Queued</option>
            <option value={WorkflowRunStatuses.running}>Running</option>
            <option value={WorkflowRunStatuses.completed}>Completed</option>
            <option value={WorkflowRunStatuses.failed}>Failed</option>
            <option value={WorkflowRunStatuses.cancelled}>Cancelled</option>
          </select>
        </label>
        <label className="ui-field">
          <span className="ui-field__label">Sort by</span>
          <select
            className="ui-select"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as WorkflowRunSortOrder)}
          >
            <option value="recency">Most recent first</option>
            <option value="duration">Longest duration first</option>
            <option value="status">Status</option>
          </select>
        </label>
      </div>

      {isLoadingRuns ? (
        <div className="ui-empty-state" data-testid="workflow-run-history-loading">
          <p className="ui-text-secondary">Loading workflow runs...</p>
        </div>
      ) : null}
      {!isLoadingRuns && runLoadError ? (
        <div className="ui-empty-state" data-testid="workflow-run-history-error">
          <p className="ui-text-danger">{runLoadError}</p>
        </div>
      ) : null}
      {!isLoadingRuns && !runLoadError && filteredRuns.length === 0 ? (
        <div className="ui-empty-state" data-testid="workflow-run-history-empty">
          <p className="ui-text-secondary">No persisted runs are available for this workflow yet.</p>
        </div>
      ) : null}

      {!isLoadingRuns && !runLoadError && filteredRuns.length > 0 ? (
        <div className="ui-run-history-table" data-testid="workflow-run-history-table">
          <div className="ui-run-history-table__row ui-run-history-table__row--header">
            <span>Status</span>
            <span>Started</span>
            <span>Ended</span>
            <span>Duration</span>
            <span>Trigger</span>
            <span>Workflow</span>
            <span>Details</span>
          </div>
          {filteredRuns.map((run) => (
            <div
              key={run.runId}
              className={`ui-run-history-table__row${selectedRunId === run.runId ? " ui-run-history-table__row--active" : ""}`}
              data-testid={`workflow-run-row-${run.runId}`}
            >
              <span>
                <span className={`ui-badge ui-badge--${toStatusTone(run.status)}`}>
                  {normalizeStatusLabel(run.status)}
                </span>
              </span>
              <span>{formatTimestamp(run.startedAt)}</span>
              <span>{formatTimestamp(run.endedAt)}</span>
              <span>{formatDuration(run.durationMs)}</span>
              <span>{normalizeTriggerSourceLabel(run.triggerSource)}</span>
              <span>{run.workflowName}</span>
              <span>
                <Link className="ui-button ui-button--ghost ui-button--sm" to={buildWorkflowStudioRunDetailPath(run.runId)}>
                  View run
                </Link>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {selectedRunId ? (
        <div className="ui-panel ui-panel--accent">
          <div className="ui-panel__header">
            <div>
              <h4 className="ui-panel__title" style={{ margin: 0 }}>Run detail</h4>
              <p className="ui-panel__subtitle" style={{ marginTop: "var(--space-2xs)" }}>{selectedRunId}</p>
            </div>
            <Link className="ui-button ui-button--ghost ui-button--sm" to={buildWorkflowStudioRunHistoryPath()}>
              Back to run list
            </Link>
          </div>
          <div className="ui-panel__body ui-stack ui-stack--sm" data-testid="workflow-run-detail-panel">
            {isLoadingDetail ? (
              <p className="ui-text-secondary" data-testid="workflow-run-detail-loading">Loading run detail...</p>
            ) : null}
            {!isLoadingDetail && detailError ? (
              <p className="ui-text-danger" data-testid="workflow-run-detail-error">{detailError}</p>
            ) : null}
            {!isLoadingDetail && isDetailMissing ? (
              <p className="ui-text-secondary" data-testid="workflow-run-detail-not-found">
                The requested workflow run was not found.
              </p>
            ) : null}
            {!isLoadingDetail && !detailError && !isDetailMissing && selectedDetail ? (
              <>
                <div className="ui-meta-grid">
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Run status</span>
                    <span className="ui-meta-value">
                      <span className={`ui-badge ui-badge--${toStatusTone(selectedDetail.summary.status)}`}>
                        {normalizeStatusLabel(selectedDetail.summary.status)}
                      </span>
                    </span>
                  </div>
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Duration</span>
                    <span className="ui-meta-value">{formatDuration(selectedDetail.summary.durationMs)}</span>
                  </div>
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Started</span>
                    <span className="ui-meta-value">{formatTimestamp(selectedDetail.summary.startedAt)}</span>
                  </div>
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Ended</span>
                    <span className="ui-meta-value">{formatTimestamp(selectedDetail.summary.endedAt)}</span>
                  </div>
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Trigger source</span>
                    <span className="ui-meta-value">{normalizeTriggerSourceLabel(selectedDetail.summary.triggerSource)}</span>
                  </div>
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Execution run id</span>
                    <span className="ui-meta-value">{selectedDetail.summary.executionRunId}</span>
                  </div>
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Execution summary</strong>
                  <p className="ui-text-secondary ui-text-small" style={{ margin: 0 }}>
                    Steps: {selectedDetail.summary.stepRunStats?.totalCount ?? 0} total,
                    {" "}{selectedDetail.summary.stepRunStats?.completedCount ?? 0} completed,
                    {" "}{selectedDetail.summary.stepRunStats?.failedCount ?? 0} failed,
                    {" "}{selectedDetail.summary.stepRunStats?.runningCount ?? 0} running.
                  </p>
                  {selectedDetail.summary.errorMessage ? (
                    <p className="ui-text-danger ui-text-small" style={{ margin: 0 }}>
                      Final error: {selectedDetail.summary.errorMessage}
                    </p>
                  ) : null}
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Trigger context</strong>
                  {selectedDetail.executionContext?.resolvedTriggerContext !== undefined ? (
                    <pre className="ui-run-history-json" data-testid="workflow-run-detail-trigger-context">
                      {formatStructuredJson(selectedDetail.executionContext.resolvedTriggerContext)}
                    </pre>
                  ) : (
                    <p className="ui-text-secondary ui-text-small" style={{ margin: 0 }}>
                      No structured trigger context was captured for this run.
                    </p>
                  )}
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Top-level outputs</strong>
                  {selectedDetail.outputs ? (
                    <>
                      <p className="ui-text-secondary ui-text-small" style={{ margin: 0 }}>
                        Output assets: {selectedDetail.outputs.outputAssetIds.length} (total outputs: {selectedDetail.outputs.outputCount})
                      </p>
                      {selectedDetail.outputs.outputValues !== undefined ? (
                        <pre className="ui-run-history-json" data-testid="workflow-run-detail-top-level-outputs">
                          {formatStructuredJson(selectedDetail.outputs.outputValues)}
                        </pre>
                      ) : null}
                    </>
                  ) : (
                    <p className="ui-text-secondary ui-text-small" style={{ margin: 0 }}>
                      No top-level outputs were captured for this run.
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
