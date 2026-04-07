import { ExecutionStatuses, type ExecutionStatus } from "@domain/execution/ExecutionPlan";
import type {
  IExecutionRunArtifact,
  IExecutionRunDiagnostics,
  IExecutionRunProvenance,
  IExecutionRunRecord,
  IExecutionRunSummary,
  IExecutionRunTransitionRecord,
  IExecutionUnitRunRecord,
} from "@domain/execution/ExecutionRun";
import { ExecutionRunProjectionService, type ExecutionRunProjection } from "./ExecutionRunProjectionService";

export interface ExecutionRunArtifactSummaryProjection {
  readonly count: number;
  readonly labels: ReadonlyArray<string>;
}

export interface ExecutionRunDiagnosticProjection {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly detail?: string;
  readonly source: string;
}

export interface ExecutionRunMetadataEntryProjection {
  readonly key: string;
  readonly value: string;
}

export interface ExecutionRunUnitDetailProjection {
  readonly unitId: string;
  readonly label: string;
  readonly kind: string;
  readonly status: ExecutionStatus;
  readonly statusLabel: string;
  readonly statusTone: "info" | "success" | "warning" | "danger";
  readonly dependsOn: ReadonlyArray<string>;
  readonly outputSummary?: string;
  readonly outputMetadata: ReadonlyArray<ExecutionRunMetadataEntryProjection>;
  readonly errorMessage?: string;
  readonly provenanceLabel?: string;
  readonly provenanceDetail?: string;
  readonly diagnostics: ReadonlyArray<ExecutionRunDiagnosticProjection>;
  readonly artifactSummary?: ExecutionRunArtifactSummaryProjection;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly updatedAt: string;
}

export interface ExecutionRunTransitionDetailProjection {
  readonly unitId: string;
  readonly unitLabel: string;
  readonly fromStatus?: string;
  readonly toStatus: string;
  readonly message?: string;
  readonly provenanceDetail?: string;
  readonly diagnosticsSummary?: string;
  readonly occurredAt: string;
}

export interface ExecutionRunDetailProjection {
  readonly summary: ExecutionRunProjection;
  readonly runId: string;
  readonly planId: string;
  readonly executionKind?: string;
  readonly status: ExecutionStatus;
  readonly cancellationSupported: boolean;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly durationSummary: string;
  readonly metadata: ReadonlyArray<ExecutionRunMetadataEntryProjection>;
  readonly runLevelMetadata: ReadonlyArray<ExecutionRunMetadataEntryProjection>;
  readonly terminalSummary?: string;
  readonly diagnosticsSummary?: string;
  readonly diagnostics: ReadonlyArray<ExecutionRunDiagnosticProjection>;
  readonly executionPathLabel: string;
  readonly executionPathDetail?: string;
  readonly provenanceEntries: ReadonlyArray<ExecutionRunMetadataEntryProjection>;
  readonly artifactSummary?: ExecutionRunArtifactSummaryProjection;
  readonly units: ReadonlyArray<ExecutionRunUnitDetailProjection>;
  readonly timeline: ReadonlyArray<ExecutionRunTransitionDetailProjection>;
}

export class ExecutionRunDetailProjectionService {
  constructor(private readonly summaryProjectionService: ExecutionRunProjectionService = new ExecutionRunProjectionService()) {}

  public project(run: IExecutionRunRecord): ExecutionRunDetailProjection {
    const summary = this.summaryProjectionService.project(run);
    const units = run.unitIds
      .map((unitId) => run.units[unitId])
      .filter((unit): unit is IExecutionUnitRunRecord => Boolean(unit))
      .map((unit) => this.projectUnit(unit));
    const diagnostics = collectRunDiagnostics(run);
    const artifactSummary = summarizeArtifacts(units.flatMap((unit) => run.units[unit.unitId]?.artifacts ?? []));

    return Object.freeze({
      summary,
      runId: run.runId,
      planId: run.planId,
      executionKind: typeof run.metadata?.executionKind === "string" ? run.metadata.executionKind : undefined,
      status: run.status,
      cancellationSupported: run.cancellationSupported,
      startedAt: run.startedAt,
      updatedAt: run.updatedAt,
      completedAt: run.completedAt,
      durationSummary: summary.durationSummary,
      metadata: projectMetadata(run.metadata),
      runLevelMetadata: projectMetadata({
        executionKind: run.metadata?.executionKind,
        truthfulnessSummary: run.metadata?.truthfulnessSummary,
        workflowName: run.metadata?.workflowName,
        datasetName: run.metadata?.datasetName,
        baseModelName: run.metadata?.baseModelName,
        versionLabel: run.metadata?.versionLabel,
      }),
      terminalSummary: joinSummary(run.terminalSummary),
      diagnosticsSummary: joinSummary(run.diagnosticsSummary),
      diagnostics,
      executionPathLabel: summary.executionPathLabel,
      executionPathDetail: summary.executionPathDetail,
      provenanceEntries: projectProvenanceEntries(run, units),
      artifactSummary,
      units: Object.freeze(units),
      timeline: Object.freeze(run.transitions.map((transition) => this.projectTransition(transition, run))),
    });
  }

  private projectUnit(unit: IExecutionUnitRunRecord): ExecutionRunUnitDetailProjection {
    return Object.freeze({
      unitId: unit.unitId,
      label: unit.label ?? unit.unitId,
      kind: unit.kind,
      status: unit.status,
      statusLabel: toTitleCase(unit.status),
      statusTone: mapStatusTone(unit.status),
      dependsOn: Object.freeze([...unit.dependsOn]),
      outputSummary: joinSummary(unit.outputSummary),
      outputMetadata: projectMetadata(unit.outputMetadata),
      errorMessage: unit.errorMessage,
      provenanceLabel: unit.provenance ? describeProvenance(unit.provenance) : undefined,
      provenanceDetail: unit.provenance?.detail,
      diagnostics: Object.freeze((unit.diagnostics ?? []).map((diagnostic) => projectDiagnostic(diagnostic, `unit:${unit.unitId}`))),
      artifactSummary: summarizeArtifacts(unit.artifacts ?? []),
      startedAt: unit.startedAt,
      completedAt: unit.completedAt,
      updatedAt: unit.updatedAt,
    });
  }

  private projectTransition(
    transition: IExecutionRunTransitionRecord,
    run: IExecutionRunRecord,
  ): ExecutionRunTransitionDetailProjection {
    const unit = run.units[transition.unitId];
    return Object.freeze({
      unitId: transition.unitId,
      unitLabel: unit?.label ?? transition.unitId,
      fromStatus: transition.fromStatus ? toTitleCase(transition.fromStatus) : undefined,
      toStatus: toTitleCase(transition.toStatus),
      message: transition.message,
      provenanceDetail: transition.provenance?.detail,
      diagnosticsSummary: transition.diagnostics?.length
        ? transition.diagnostics.map((diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`).join(" â€¢ ")
        : undefined,
      occurredAt: transition.occurredAt,
    });
  }
}

function projectMetadata(metadata: Readonly<Record<string, unknown>> | undefined): ReadonlyArray<ExecutionRunMetadataEntryProjection> {
  if (!metadata) {
    return Object.freeze([]);
  }

  return Object.freeze(Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => Object.freeze({ key, value: formatMetadataValue(value) }))
    .sort((left, right) => left.key.localeCompare(right.key)));
}

function projectProvenanceEntries(
  run: IExecutionRunRecord,
  units: ReadonlyArray<ExecutionRunUnitDetailProjection>,
): ReadonlyArray<ExecutionRunMetadataEntryProjection> {
  const entries = new Map<string, string>();
  for (const unitId of run.unitIds) {
    const provenance = run.units[unitId]?.provenance;
    if (!provenance) {
      continue;
    }
    entries.set(`${unitId}:classification`, `${units.find((unit) => unit.unitId === unitId)?.label ?? unitId}: ${describeProvenance(provenance)}`);
    if (provenance.runtime) {
      entries.set(`${unitId}:runtime`, `${units.find((unit) => unit.unitId === unitId)?.label ?? unitId} runtime: ${provenance.runtime}`);
    }
    const path = typeof provenance.metadata?.path === "string" ? provenance.metadata.path : undefined;
    if (path) {
      entries.set(`${unitId}:path`, `${units.find((unit) => unit.unitId === unitId)?.label ?? unitId} path: ${path}`);
    }
  }

  return Object.freeze([...entries.entries()].map(([key, value]) => Object.freeze({ key, value })));
}

function collectRunDiagnostics(run: IExecutionRunRecord): ReadonlyArray<ExecutionRunDiagnosticProjection> {
  const diagnostics: ExecutionRunDiagnosticProjection[] = [];
  for (const unitId of run.unitIds) {
    for (const diagnostic of run.units[unitId]?.diagnostics ?? []) {
      diagnostics.push(projectDiagnostic(diagnostic, `unit:${unitId}`));
    }
  }
  for (const transition of run.transitions) {
    for (const diagnostic of transition.diagnostics ?? []) {
      diagnostics.push(projectDiagnostic(diagnostic, `transition:${transition.unitId}:${transition.toStatus}`));
    }
  }

  return Object.freeze(diagnostics);
}

function projectDiagnostic(
  diagnostic: IExecutionRunDiagnostics,
  source: string,
): ExecutionRunDiagnosticProjection {
  return Object.freeze({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    detail: diagnostic.detail,
    source,
  });
}

function summarizeArtifacts(artifacts: ReadonlyArray<IExecutionRunArtifact>): ExecutionRunArtifactSummaryProjection | undefined {
  if (artifacts.length === 0) {
    return undefined;
  }

  const labels = [...new Set(artifacts.map((artifact) => artifact.kind))].sort();
  return Object.freeze({ count: artifacts.length, labels: Object.freeze(labels) });
}

function joinSummary(summary: IExecutionRunSummary | undefined): string | undefined {
  return summary
    ? [summary.headline, summary.detail].filter(Boolean).join(" â€” ")
    : undefined;
}

function describeProvenance(provenance: IExecutionRunProvenance): string {
  switch (provenance.classification) {
    case "delegated":
      return "Delegated execution";
    case "scaffolded":
      return "Scaffold fallback";
    case "hybrid":
      return "Hybrid execution";
    case "unavailable":
      return "Unavailable path";
    case "real":
    default:
      return "Real execution";
  }
}

function mapStatusTone(status: ExecutionStatus): ExecutionRunUnitDetailProjection["statusTone"] {
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

function formatMetadataValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => formatMetadataValue(entry)).join(", ");
  }
  return JSON.stringify(value);
}

function toTitleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

