import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  WorkflowRunDiagnosticScopes,
  WorkflowRunDiagnosticSeverities,
  WorkflowRunStatuses,
  WorkflowRunTriggerSources,
  type WorkflowRunStatus,
  type WorkflowRunDiagnosticRecord,
  type WorkflowStepRunRecord,
} from "../../../../domain/workflow-studio/WorkflowRunHistoryDomain";
import type {
  WorkflowRunDetailReadModel,
  WorkflowRunDiagnosticReadModel,
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
type WorkflowRerunMode = "as-is" | "edited";

interface WorkflowRerunEditableForm {
  readonly targetJson: string;
  readonly parametersJson: string;
  readonly executionMetadataJson: string;
  readonly propertyOverridesJson: string;
  readonly rerunReason: string;
}

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

export function orderStepRuns(stepRuns: ReadonlyArray<WorkflowStepRunRecord>): ReadonlyArray<WorkflowStepRunRecord> {
  const sorted = [...stepRuns];
  sorted.sort((left, right) => {
    const indexDelta = left.stepIndex - right.stepIndex;
    if (indexDelta !== 0) {
      return indexDelta;
    }
    return left.attempt - right.attempt;
  });
  return Object.freeze(sorted);
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

function toSeverityTone(severity: WorkflowRunDiagnosticReadModel["severity"]): "danger" | "warning" | "success" | "neutral" {
  switch (severity) {
    case WorkflowRunDiagnosticSeverities.error:
      return "danger";
    case WorkflowRunDiagnosticSeverities.warning:
      return "warning";
    case WorkflowRunDiagnosticSeverities.info:
      return "neutral";
    default:
      return "neutral";
  }
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

function parseStructuredJson(value: string, label: string): Readonly<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object.`);
    }
    return parsed as Readonly<Record<string, unknown>>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`${label} is invalid: ${detail}`);
  }
}

function parseNestedStructuredJson(
  value: string,
  label: string,
): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  const parsed = parseStructuredJson(value, label);
  const normalized: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${label} must map keys to JSON objects.`);
    }
    normalized[key] = entry as Readonly<Record<string, unknown>>;
  }
  return Object.freeze(normalized);
}

function createRerunEditableForm(detail?: WorkflowRunDetailReadModel): WorkflowRerunEditableForm {
  const executionInput = (detail?.executionContext?.executionInput ?? {}) as Record<string, unknown>;
  return Object.freeze({
    targetJson: formatStructuredJson((executionInput.target ?? {})),
    parametersJson: formatStructuredJson((executionInput.parameters ?? {})),
    executionMetadataJson: formatStructuredJson((executionInput.executionMetadata ?? {})),
    propertyOverridesJson: formatStructuredJson((executionInput.propertyOverrides ?? {})),
    rerunReason: "",
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isRunRerunSupported(detail?: WorkflowRunDetailReadModel): boolean {
  if (!detail) {
    return false;
  }
  return detail.summary.status === WorkflowRunStatuses.completed
    || detail.summary.status === WorkflowRunStatuses.failed
    || detail.summary.status === WorkflowRunStatuses.cancelled;
}

export function isEditRerunSupported(detail?: WorkflowRunDetailReadModel): boolean {
  if (!isRunRerunSupported(detail)) {
    return false;
  }
  return isRecord(detail?.executionContext?.executionInput);
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

function normalizeDiagnosticScope(scope?: WorkflowRunDiagnosticReadModel["scope"]): string {
  if (scope === WorkflowRunDiagnosticScopes.step) {
    return "Step";
  }
  return "Workflow";
}

function summarizeUnknown(value: unknown): string {
  if (value === undefined || value === null) {
    return "None";
  }

  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "Empty list";
    }
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) {
      return "Empty object";
    }
    return `Fields: ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "..." : ""}`;
  }

  return String(value);
}

export function summarizeStepInputs(stepRun: WorkflowStepRunRecord): string {
  const metadata = (stepRun.metadata ?? {}) as Record<string, unknown>;
  const inputCandidates = [metadata.input, metadata.inputs, metadata.executionInput, metadata.parameters];
  const inputValue = inputCandidates.find((entry) => entry !== undefined);
  return inputValue === undefined ? "No structured input summary captured." : summarizeUnknown(inputValue);
}

export function summarizeStepOutputs(stepRun: WorkflowStepRunRecord): string {
  if (stepRun.output) {
    return `${stepRun.output.outputCount} output${stepRun.output.outputCount === 1 ? "" : "s"} captured`;
  }
  const metadata = (stepRun.metadata ?? {}) as Record<string, unknown>;
  const outputCandidates = [metadata.output, metadata.outputs, metadata.result, metadata.resultValue];
  const outputValue = outputCandidates.find((entry) => entry !== undefined);
  return outputValue === undefined ? "No structured output summary captured." : summarizeUnknown(outputValue);
}

export function formatFailureCue(run: WorkflowRunSummaryReadModel): string {
  const location = run.failureLocation;
  const summary = run.primaryDiagnostic?.summary;
  const locationLabel = location?.scope === "step"
    ? `Step ${location.stepIndex !== undefined ? location.stepIndex + 1 : "?"}${location.stepName ? ` (${location.stepName})` : ""}`
    : location?.scope === "workflow"
      ? "Workflow"
      : undefined;

  if (summary && locationLabel) {
    return `${locationLabel}: ${summary}`;
  }
  if (summary) {
    return summary;
  }
  if (run.errorMessage) {
    return run.errorMessage;
  }
  if (run.isIncomplete) {
    return "Run is incomplete and has partial failures.";
  }
  return "-";
}

function renderDiagnostics(
  diagnostics?: ReadonlyArray<WorkflowRunDiagnosticReadModel | WorkflowRunDiagnosticRecord>,
): JSX.Element {
  if (!diagnostics || diagnostics.length === 0) {
    return (
      <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">
        No structured diagnostics were recorded for this run.
      </p>
    );
  }

  return (
    <div className="ui-workflow-run-history__diagnostics" data-testid="workflow-run-diagnostics-list">
      {diagnostics.map((diagnostic, index) => (
        <div className="ui-workflow-run-history__diagnostic" key={`${diagnostic.scope}:${diagnostic.code ?? index}:${diagnostic.summary}`}>
          <div className="ui-row ui-row--between ui-row--wrap">
            <div className="ui-chips">
              <span className={`ui-badge ui-badge--${toSeverityTone(diagnostic.severity)}`}>
                {diagnostic.severity}
              </span>
              <span className="ui-badge ui-badge--neutral">{diagnostic.category}</span>
              <span className="ui-badge ui-badge--neutral">{normalizeDiagnosticScope(diagnostic.scope)}</span>
            </div>
            {diagnostic.location?.stepIndex !== undefined ? (
              <span className="ui-text-secondary ui-text-small">
                Step {diagnostic.location.stepIndex + 1}{diagnostic.location.stepName ? ` (${diagnostic.location.stepName})` : ""}
              </span>
            ) : null}
          </div>
          <p className="ui-workflow-run-history__text-block">{diagnostic.summary}</p>
          {diagnostic.remediationHint ? (
            <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">
              Suggested next step: {diagnostic.remediationHint}
            </p>
          ) : null}
          {diagnostic.technicalDetail ? (
            <pre className="ui-run-history-json">{diagnostic.technicalDetail}</pre>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function WorkflowStudioRunHistoryPanel({
  workflowId,
  workflowName,
}: WorkflowStudioRunHistoryPanelProps): JSX.Element {
  const service = useMemo(() => new StudioShellService(), []);
  const navigate = useNavigate();
  const location = useLocation();
  const routeParams = useParams<{ runId?: string }>();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedRunId = routeParams.runId?.trim();
  const isRunHistoryRoute = location.pathname.startsWith(ROUTE_PATHS.workflowStudioRuns);
  const routeWorkflowId = workflowId
    ?? searchParams.get("workflowId")?.trim()
    ?? searchParams.get("assetId")?.trim()
    ?? undefined;
  const routeWorkflowStatus = searchParams.get("workflowStatus")?.trim() === "draft"
    ? "draft"
    : "saved";
  const effectiveWorkflowId = workflowId ?? routeWorkflowId;
  const runRouteOptions = effectiveWorkflowId
    ? Object.freeze({
      workflowId: effectiveWorkflowId,
      workflowStatus: routeWorkflowStatus,
    } as const)
    : undefined;
  const workflowStudioPath = buildWorkflowStudioRunHistoryPath({
    workflowId: runRouteOptions?.workflowId,
    workflowStatus: runRouteOptions?.workflowStatus,
    basePath: ROUTE_PATHS.workflowStudio,
  });
  const runHistoryPath = buildWorkflowStudioRunHistoryPath(runRouteOptions);
  const [isLoadingRuns, setIsLoadingRuns] = useState(Boolean(effectiveWorkflowId));
  const [runLoadError, setRunLoadError] = useState<string | undefined>();
  const [runs, setRuns] = useState<ReadonlyArray<WorkflowRunSummaryReadModel>>([]);
  const [statusFilter, setStatusFilter] = useState<WorkflowRunStatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<WorkflowRunSortOrder>("recency");
  const [isLoadingDetail, setIsLoadingDetail] = useState(Boolean(selectedRunId));
  const [detailError, setDetailError] = useState<string | undefined>();
  const [selectedDetail, setSelectedDetail] = useState<WorkflowRunDetailReadModel | undefined>();
  const [isDetailMissing, setIsDetailMissing] = useState(false);
  const [isRerunPending, setIsRerunPending] = useState(false);
  const [rerunFeedback, setRerunFeedback] = useState<string | undefined>();
  const [isEditRerunOpen, setIsEditRerunOpen] = useState(false);
  const [editRerunForm, setEditRerunForm] = useState<WorkflowRerunEditableForm>(() => createRerunEditableForm());

  useEffect(() => {
    if (!effectiveWorkflowId) {
      setRuns([]);
      setRunLoadError(undefined);
      return;
    }

    let active = true;
    setIsLoadingRuns(true);
    setRunLoadError(undefined);

    void service.listWorkflowRuns({
      workflowId: effectiveWorkflowId,
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
  }, [effectiveWorkflowId, service]);

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedDetail(undefined);
      setDetailError(undefined);
      setIsDetailMissing(false);
      setRerunFeedback(undefined);
      setIsEditRerunOpen(false);
      setEditRerunForm(createRerunEditableForm(undefined));
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
      setEditRerunForm(createRerunEditableForm(response.data));
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

  const orderedStepRuns = useMemo(() => {
    return orderStepRuns(selectedDetail?.stepRuns ?? []);
  }, [selectedDetail?.stepRuns]);
  const canRerunSelected = isRunRerunSupported(selectedDetail);
  const canEditRerunSelected = isEditRerunSupported(selectedDetail);

  const reloadRuns = async (): Promise<void> => {
    if (!effectiveWorkflowId) {
      return;
    }
    setIsLoadingRuns(true);
    try {
      const response = await service.listWorkflowRuns({ workflowId: effectiveWorkflowId, limit: 200 });
      if (response.ok) {
        setRuns(response.data ?? []);
        setRunLoadError(undefined);
        return;
      }
      setRunLoadError(response.error?.message ?? "Workflow run history could not be loaded.");
    } catch (error) {
      setRunLoadError(error instanceof Error ? error.message : "Workflow run history could not be loaded.");
    } finally {
      setIsLoadingRuns(false);
    }
  };

  const startRerun = async (mode: WorkflowRerunMode): Promise<void> => {
    if (!selectedRunId) {
      return;
    }
    if (mode === "as-is" && !canRerunSelected) {
      setRerunFeedback("Rerun is available only after a run reaches a terminal status.");
      return;
    }
    if (mode === "edited" && !canEditRerunSelected) {
      setRerunFeedback("Edit and rerun is unavailable because historical execution input context is missing.");
      return;
    }

    setIsRerunPending(true);
    setRerunFeedback(undefined);
    try {
      const request = mode === "edited"
        ? Object.freeze({
          sourceRunId: selectedRunId,
          mode,
          rerunReason: editRerunForm.rerunReason.trim() || undefined,
          overrides: Object.freeze({
            target: parseStructuredJson(editRerunForm.targetJson, "Target JSON"),
            parameters: parseStructuredJson(editRerunForm.parametersJson, "Parameters JSON"),
            executionMetadata: parseStructuredJson(editRerunForm.executionMetadataJson, "Execution metadata JSON"),
            propertyOverrides: parseNestedStructuredJson(editRerunForm.propertyOverridesJson, "Property overrides JSON"),
          }),
        })
        : Object.freeze({
          sourceRunId: selectedRunId,
          mode,
        });

      const response = await service.startWorkflowRunRerun(request);
      if (!response.ok || !response.data) {
        setRerunFeedback(response.error?.message ?? "Failed to launch workflow rerun.");
        return;
      }

      await reloadRuns();
      setRerunFeedback(`Rerun started as ${response.data.runId}.`);
      setIsEditRerunOpen(false);
      navigate(buildWorkflowStudioRunDetailPath(response.data.runId, runRouteOptions));
    } catch (error) {
      setRerunFeedback(error instanceof Error ? error.message : "Failed to launch workflow rerun.");
    } finally {
      setIsRerunPending(false);
    }
  };

  if (!effectiveWorkflowId) {
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
      <div className="ui-row ui-row--between ui-row--wrap ui-workflow-run-history__header">
        <div>
          <h3 className="ui-workflow-run-history__title">{heading}</h3>
          <p className="ui-text-secondary ui-text-small ui-workflow-run-history__subtitle">
            Durable run summaries, step-by-step inspection, and structured failure diagnostics.
          </p>
          <p className="ui-text-secondary ui-text-small ui-workflow-run-history__subtitle">
            <Link className="ui-link" to={workflowStudioPath}>Workflow studio</Link> {" / "}
            <Link className="ui-link" to={runHistoryPath}>Run history</Link>
            {selectedRunId ? (
              <>
                {" / "}
                <span>{selectedRunId}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="ui-row ui-row--wrap ui-workflow-run-history__actions">
          {isRunHistoryRoute ? (
            <Link className="ui-button ui-button--ghost ui-button--sm" to={workflowStudioPath}>
              Back to workflow studio
            </Link>
          ) : (
            <Link className="ui-button ui-button--ghost ui-button--sm" to={runHistoryPath}>
              Open run history view
            </Link>
          )}
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            onClick={() => {
              void reloadRuns();
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
          <p className="ui-text-secondary">
            {statusFilter === "all"
              ? "No persisted runs are available for this workflow yet."
              : "No runs match the current filter. Try another status or clear filters."}
          </p>
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
            <span>Failure Cue</span>
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
              <span>
                {run.workflowName}
                {run.rerunMode ? (
                  <span className="ui-workflow-run-history__lineage-label">
                    {run.rerunMode === "edited" ? "Edited rerun" : "Rerun"}{run.parentRunId ? ` of ${run.parentRunId}` : ""}
                  </span>
                ) : null}
              </span>
              <span className={run.primaryDiagnostic || run.errorMessage || run.isIncomplete ? "ui-text-secondary ui-text-small" : ""}>
                {formatFailureCue(run)}
              </span>
              <span>
                <Link className="ui-button ui-button--ghost ui-button--sm" to={buildWorkflowStudioRunDetailPath(run.runId, runRouteOptions)}>
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
              <h4 className="ui-panel__title ui-workflow-run-history__panel-title">Run detail</h4>
              <p className="ui-panel__subtitle ui-workflow-run-history__panel-subtitle">{selectedRunId}</p>
            </div>
            <Link className="ui-button ui-button--ghost ui-button--sm" to={runHistoryPath}>
              Back to run list
            </Link>
          </div>
          <div className="ui-panel__body ui-stack ui-stack--sm" data-testid="workflow-run-detail-panel">
            {isLoadingDetail ? (
              <p className="ui-text-secondary" data-testid="workflow-run-detail-loading">Loading run detail...</p>
            ) : null}
            {!isLoadingDetail && detailError ? (
              <div className="ui-stack ui-stack--2xs" data-testid="workflow-run-detail-error">
                <p className="ui-text-danger">{detailError}</p>
                <div className="ui-row ui-row--wrap">
                  <Link className="ui-button ui-button--ghost ui-button--sm" to={runHistoryPath}>
                    Back to run history
                  </Link>
                </div>
              </div>
            ) : null}
            {!isLoadingDetail && isDetailMissing ? (
              <div className="ui-stack ui-stack--2xs" data-testid="workflow-run-detail-not-found">
                <p className="ui-text-secondary">
                  The requested workflow run was not found.
                </p>
                <div className="ui-row ui-row--wrap">
                  <Link className="ui-button ui-button--ghost ui-button--sm" to={runHistoryPath}>
                    Back to run history
                  </Link>
                </div>
              </div>
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
                  {selectedDetail.summary.parentRunId ? (
                    <div className="ui-meta-item">
                      <span className="ui-meta-label">Source run</span>
                      <span className="ui-meta-value">{selectedDetail.summary.parentRunId}</span>
                    </div>
                  ) : null}
                  {selectedDetail.summary.rerunMode ? (
                    <div className="ui-meta-item">
                      <span className="ui-meta-label">Rerun mode</span>
                      <span className="ui-meta-value">{selectedDetail.summary.rerunMode}</span>
                    </div>
                  ) : null}
                </div>

                <div className="ui-stack ui-stack--2xs" data-testid="workflow-run-rerun-actions">
                  <strong>Rerun</strong>
                  <div className="ui-row ui-row--wrap ui-workflow-run-history__actions">
                    <button
                      type="button"
                      className="ui-button ui-button--primary ui-button--sm"
                      disabled={isRerunPending || !canRerunSelected}
                      onClick={() => {
                        void startRerun("as-is");
                      }}
                    >
                      Rerun as-is
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      disabled={isRerunPending || !canEditRerunSelected}
                      onClick={() => setIsEditRerunOpen((current) => !current)}
                    >
                      {isEditRerunOpen ? "Hide edit rerun" : "Edit and rerun"}
                    </button>
                  </div>
                  {!canRerunSelected ? (
                    <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">
                      Rerun becomes available after a run reaches a terminal status.
                    </p>
                  ) : null}
                  {canRerunSelected && !canEditRerunSelected ? (
                    <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">
                      Edit and rerun is unavailable because structured historical execution input was not captured.
                    </p>
                  ) : null}
                  {rerunFeedback ? (
                    <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">
                      {rerunFeedback}
                    </p>
                  ) : null}
                  {isEditRerunOpen ? (
                    <div className="ui-stack ui-stack--xs ui-workflow-run-history__edit-rerun">
                      <label className="ui-field">
                        <span className="ui-field__label">Target JSON</span>
                        <textarea
                          className="ui-textarea"
                          rows={4}
                          value={editRerunForm.targetJson}
                          onChange={(event) => setEditRerunForm((current) => ({ ...current, targetJson: event.target.value }))}
                        />
                      </label>
                      <label className="ui-field">
                        <span className="ui-field__label">Parameters JSON</span>
                        <textarea
                          className="ui-textarea"
                          rows={6}
                          value={editRerunForm.parametersJson}
                          onChange={(event) => setEditRerunForm((current) => ({ ...current, parametersJson: event.target.value }))}
                        />
                      </label>
                      <label className="ui-field">
                        <span className="ui-field__label">Execution metadata JSON</span>
                        <textarea
                          className="ui-textarea"
                          rows={4}
                          value={editRerunForm.executionMetadataJson}
                          onChange={(event) => setEditRerunForm((current) => ({ ...current, executionMetadataJson: event.target.value }))}
                        />
                      </label>
                      <label className="ui-field">
                        <span className="ui-field__label">Property overrides JSON</span>
                        <textarea
                          className="ui-textarea"
                          rows={4}
                          value={editRerunForm.propertyOverridesJson}
                          onChange={(event) => setEditRerunForm((current) => ({ ...current, propertyOverridesJson: event.target.value }))}
                        />
                      </label>
                      <label className="ui-field">
                        <span className="ui-field__label">Rerun reason (optional)</span>
                        <input
                          className="ui-input"
                          value={editRerunForm.rerunReason}
                          onChange={(event) => setEditRerunForm((current) => ({ ...current, rerunReason: event.target.value }))}
                        />
                      </label>
                      <div className="ui-row ui-row--wrap ui-workflow-run-history__actions">
                        <button
                          type="button"
                          className="ui-button ui-button--primary ui-button--sm"
                          disabled={isRerunPending}
                          onClick={() => {
                            void startRerun("edited");
                          }}
                        >
                          Launch edited rerun
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Execution summary</strong>
                  <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">
                    Steps: {selectedDetail.summary.stepRunStats?.totalCount ?? 0} total,
                    {" "}{selectedDetail.summary.stepRunStats?.completedCount ?? 0} completed,
                    {" "}{selectedDetail.summary.stepRunStats?.failedCount ?? 0} failed,
                    {" "}{selectedDetail.summary.stepRunStats?.runningCount ?? 0} running.
                  </p>
                  {selectedDetail.summary.errorMessage ? (
                    <p className="ui-text-danger ui-text-small ui-workflow-run-history__text-block">
                      Final error: {selectedDetail.summary.errorMessage}
                    </p>
                  ) : null}
                  {selectedDetail.failureLocation?.scope === "step" ? (
                    <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">
                      Failure location: Step {selectedDetail.failureLocation.stepIndex !== undefined ? selectedDetail.failureLocation.stepIndex + 1 : "?"}
                      {selectedDetail.failureLocation.stepName ? ` (${selectedDetail.failureLocation.stepName})` : ""}
                    </p>
                  ) : selectedDetail.failureLocation?.scope === "workflow" ? (
                    <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">Failure location: Workflow-level</p>
                  ) : null}
                </div>

                <div className="ui-stack ui-stack--2xs" data-testid="workflow-run-detail-diagnostics">
                  <strong>Failure diagnostics</strong>
                  {renderDiagnostics(selectedDetail.diagnostics)}
                </div>

                <div className="ui-stack ui-stack--2xs" data-testid="workflow-run-detail-step-inspection">
                  <strong>Step inspection</strong>
                  {orderedStepRuns.length === 0 ? (
                    <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">
                      No step-level execution records were captured for this run.
                    </p>
                  ) : (
                    <div className="ui-workflow-run-history__step-list">
                      {orderedStepRuns.map((stepRun) => {
                        const stepLabel = stepRun.stepName || stepRun.stepId;
                        const stepStatusTone = toStatusTone(stepRun.status as WorkflowRunStatus);
                        const stepDuration = stepRun.durationMs
                          ?? (stepRun.timestamps.startedAt && stepRun.timestamps.endedAt
                            ? Math.max(0, Date.parse(stepRun.timestamps.endedAt) - Date.parse(stepRun.timestamps.startedAt))
                            : undefined);
                        return (
                          <details
                            className="ui-workflow-run-history__step-item"
                            key={stepRun.stepRunId}
                            data-testid={`workflow-run-step-${stepRun.stepRunId}`}
                          >
                            <summary className="ui-workflow-run-history__step-summary">
                              <span className="ui-workflow-run-history__step-title">
                                Step {stepRun.stepIndex + 1}: {stepLabel}
                              </span>
                              <span className="ui-chips">
                                <span className={`ui-badge ui-badge--${stepStatusTone}`}>{stepRun.status}</span>
                                <span className="ui-badge ui-badge--neutral">Attempt {stepRun.attempt}</span>
                                <span className="ui-badge ui-badge--neutral">{formatDuration(stepDuration)}</span>
                              </span>
                            </summary>
                            <div className="ui-workflow-run-history__step-body">
                              <div className="ui-meta-grid">
                                <div className="ui-meta-item">
                                  <span className="ui-meta-label">Step Id</span>
                                  <span className="ui-meta-value">{stepRun.stepId}</span>
                                </div>
                                <div className="ui-meta-item">
                                  <span className="ui-meta-label">Type</span>
                                  <span className="ui-meta-value">{stepRun.stepType ?? "-"}</span>
                                </div>
                                <div className="ui-meta-item">
                                  <span className="ui-meta-label">Action category</span>
                                  <span className="ui-meta-value">{stepRun.actionType ?? "-"}</span>
                                </div>
                                <div className="ui-meta-item">
                                  <span className="ui-meta-label">Updated</span>
                                  <span className="ui-meta-value">{formatTimestamp(stepRun.timestamps.updatedAt)}</span>
                                </div>
                                <div className="ui-meta-item">
                                  <span className="ui-meta-label">Started</span>
                                  <span className="ui-meta-value">{formatTimestamp(stepRun.timestamps.startedAt)}</span>
                                </div>
                                <div className="ui-meta-item">
                                  <span className="ui-meta-label">Ended</span>
                                  <span className="ui-meta-value">{formatTimestamp(stepRun.timestamps.endedAt)}</span>
                                </div>
                              </div>
                              <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">
                                Inputs: {summarizeStepInputs(stepRun)}
                              </p>
                              <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">
                                Outputs: {summarizeStepOutputs(stepRun)}
                              </p>
                              {stepRun.summary ? (
                                <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">Summary: {stepRun.summary}</p>
                              ) : null}
                              {stepRun.error ? (
                                <p className="ui-text-danger ui-text-small ui-workflow-run-history__text-block" data-testid={`workflow-run-step-error-${stepRun.stepRunId}`}>
                                  Error: {stepRun.error.message}
                                </p>
                              ) : null}
                              {stepRun.diagnostics && stepRun.diagnostics.length > 0 ? (
                                renderDiagnostics(stepRun.diagnostics)
                              ) : null}
                              {stepRun.metadata !== undefined ? (
                                <pre className="ui-run-history-json">
                                  {formatStructuredJson(stepRun.metadata)}
                                </pre>
                              ) : null}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Trigger context</strong>
                  {selectedDetail.executionContext?.resolvedTriggerContext !== undefined ? (
                    <pre className="ui-run-history-json" data-testid="workflow-run-detail-trigger-context">
                      {formatStructuredJson(selectedDetail.executionContext.resolvedTriggerContext)}
                    </pre>
                  ) : (
                    <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">
                      No structured trigger context was captured for this run.
                    </p>
                  )}
                </div>

                <div className="ui-stack ui-stack--2xs">
                  <strong>Top-level outputs</strong>
                  {selectedDetail.outputs ? (
                    <>
                      <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">
                        Output assets: {selectedDetail.outputs.outputAssetIds.length} (total outputs: {selectedDetail.outputs.outputCount})
                      </p>
                      {selectedDetail.outputs.outputValues !== undefined ? (
                        <pre className="ui-run-history-json" data-testid="workflow-run-detail-top-level-outputs">
                          {formatStructuredJson(selectedDetail.outputs.outputValues)}
                        </pre>
                      ) : null}
                    </>
                  ) : (
                    <p className="ui-text-secondary ui-text-small ui-workflow-run-history__text-block">
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
