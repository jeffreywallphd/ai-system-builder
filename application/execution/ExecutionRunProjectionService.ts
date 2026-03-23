import { ExecutionStatuses, type ExecutionStatus } from "../../domain/execution/ExecutionPlan";
import type { IExecutionRunProvenance, IExecutionRunRecord } from "../../domain/execution/ExecutionRun";

export interface ExecutionRunProjection {
  readonly runId: string;
  readonly planId: string;
  readonly executionKind?: string;
  readonly status: ExecutionStatus;
  readonly statusLabel: string;
  readonly statusTone: "info" | "success" | "warning" | "danger";
  readonly currentUnitId?: string;
  readonly currentUnitLabel?: string;
  readonly completedUnits: number;
  readonly totalUnits: number;
  readonly progressPercent: number;
  readonly progressLabel: string;
  readonly terminalSummary?: string;
  readonly executionPathLabel: string;
  readonly executionPathDetail?: string;
  readonly errorSummary?: string;
  readonly diagnosticsSummary?: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly durationSummary: string;
  readonly metadataSummary?: string;
}

export class ExecutionRunProjectionService {
  public project(run: IExecutionRunRecord): ExecutionRunProjection {
    const units = run.unitIds.map((unitId) => run.units[unitId]).filter(Boolean);
    const currentUnit = this.resolveCurrentUnit(run);
    const completedUnits = units.filter((unit) => unit.status === ExecutionStatuses.completed).length;
    const totalUnits = units.length;
    const progressPercent = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
    const executionPath = this.resolveExecutionPath(run, units.map((unit) => unit.provenance).filter(Boolean) as IExecutionRunProvenance[]);

    return Object.freeze({
      runId: run.runId,
      planId: run.planId,
      executionKind: typeof run.metadata?.executionKind === "string" ? run.metadata.executionKind : undefined,
      status: run.status,
      statusLabel: toTitleCase(run.status),
      statusTone: mapStatusTone(run.status),
      currentUnitId: currentUnit?.unitId,
      currentUnitLabel: currentUnit?.label ?? currentUnit?.unitId,
      completedUnits,
      totalUnits,
      progressPercent,
      progressLabel: `${completedUnits}/${totalUnits} units${run.status === ExecutionStatuses.running ? ` • ${progressPercent}%` : ""}`,
      terminalSummary: run.terminalSummary
        ? [run.terminalSummary.headline, run.terminalSummary.detail].filter(Boolean).join(" — ")
        : undefined,
      executionPathLabel: executionPath.label,
      executionPathDetail: executionPath.detail,
      errorSummary: run.finalErrorMessage,
      diagnosticsSummary: run.diagnosticsSummary
        ? [run.diagnosticsSummary.headline, run.diagnosticsSummary.detail].filter(Boolean).join(" — ")
        : undefined,
      startedAt: run.startedAt,
      updatedAt: run.updatedAt,
      completedAt: run.completedAt,
      durationSummary: describeDuration(run.startedAt, run.completedAt ?? run.updatedAt),
      metadataSummary: summarizeMetadata(run),
    });
  }

  public projectMany(runs: ReadonlyArray<IExecutionRunRecord>): ReadonlyArray<ExecutionRunProjection> {
    return Object.freeze(runs.map((run) => this.project(run)));
  }

  private resolveCurrentUnit(run: IExecutionRunRecord): IExecutionRunRecord["units"][string] | undefined {
    const runningUnit = run.unitIds
      .map((unitId) => run.units[unitId])
      .find((unit) => unit?.status === ExecutionStatuses.running);

    if (runningUnit) {
      return runningUnit;
    }

    return run.unitIds
      .map((unitId) => run.units[unitId])
      .filter(Boolean)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  private resolveExecutionPath(
    run: IExecutionRunRecord,
    provenances: ReadonlyArray<IExecutionRunProvenance>,
  ): { readonly label: string; readonly detail?: string } {
    const classifications = [...new Set(provenances.map((provenance) => provenance.classification))];
    const primary = classifications[0];
    const selectionReason = provenances.map((provenance) => provenance.selectionReason).find(Boolean);
    const detail = [
      run.metadata?.truthfulnessSummary,
      selectionReason,
      provenances.map((provenance) => provenance.detail).find(Boolean),
    ].find((value): value is string => typeof value === "string" && value.trim().length > 0);

    if (classifications.length === 0) {
      return { label: "Awaiting execution provenance", detail };
    }

    if (classifications.length > 1) {
      return { label: "Hybrid execution path", detail };
    }

    switch (primary) {
      case "delegated":
        return { label: "Delegated execution", detail };
      case "scaffolded":
        return { label: "Scaffold fallback", detail };
      case "hybrid":
        return { label: "Hybrid execution path", detail };
      case "unavailable":
        return { label: "Unavailable execution path", detail };
      case "real":
      default:
        return { label: "Real execution", detail };
    }
  }
}

function summarizeMetadata(run: IExecutionRunRecord): string | undefined {
  const values = [
    typeof run.metadata?.workflowName === "string" ? run.metadata.workflowName : undefined,
    typeof run.metadata?.datasetName === "string" ? run.metadata.datasetName : undefined,
    typeof run.metadata?.baseModelName === "string" ? run.metadata.baseModelName : undefined,
    typeof run.metadata?.versionLabel === "string" ? run.metadata.versionLabel : undefined,
  ].filter((value): value is string => Boolean(value));

  return values.length > 0 ? values.join(" • ") : undefined;
}

function mapStatusTone(status: ExecutionStatus): ExecutionRunProjection["statusTone"] {
  switch (status) {
    case ExecutionStatuses.completed:
      return "success";
    case ExecutionStatuses.failed:
      return "danger";
    case ExecutionStatuses.cancelled:
    case ExecutionStatuses.skipped:
      return "warning";
    case ExecutionStatuses.pending:
    case ExecutionStatuses.ready:
    case ExecutionStatuses.running:
    default:
      return "info";
  }
}

function describeDuration(startedAt: string, endedAt: string): string {
  const durationMs = Math.max(new Date(endedAt).getTime() - new Date(startedAt).getTime(), 0);
  if (!Number.isFinite(durationMs)) {
    return "Duration unavailable";
  }
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function toTitleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
