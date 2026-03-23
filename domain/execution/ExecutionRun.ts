import type { ExecutionStatus, ExecutionUnitKind } from "./ExecutionPlan";

export interface IExecutionRunDiagnostics {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly detail?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IExecutionRunFallbackInfo {
  readonly kind: string;
  readonly isActive: boolean;
  readonly reason?: string;
}

export interface IExecutionRunProvenance {
  readonly classification: "real" | "delegated" | "scaffolded" | "hybrid" | "unavailable";
  readonly executorId: string;
  readonly runtime?: string;
  readonly detail?: string;
  readonly selectionReason?: string;
  readonly fallback?: IExecutionRunFallbackInfo;
  readonly diagnostics?: ReadonlyArray<IExecutionRunDiagnostics>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly sourceKind?: string;
}

export interface IExecutionRunArtifact<TValue = unknown> {
  readonly kind: string;
  readonly value: TValue;
}

export interface IExecutionRunSummary {
  readonly headline: string;
  readonly detail?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IExecutionUnitRunRecord {
  readonly unitId: string;
  readonly kind: ExecutionUnitKind;
  readonly label?: string;
  readonly dependsOn: ReadonlyArray<string>;
  readonly status: ExecutionStatus;
  readonly outputMetadata?: Readonly<Record<string, unknown>>;
  readonly outputSummary?: IExecutionRunSummary;
  readonly errorMessage?: string;
  readonly provenance?: IExecutionRunProvenance;
  readonly diagnostics?: ReadonlyArray<IExecutionRunDiagnostics>;
  readonly artifacts?: ReadonlyArray<IExecutionRunArtifact>;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly updatedAt: string;
}

export interface IExecutionRunTransitionRecord {
  readonly unitId: string;
  readonly fromStatus?: ExecutionStatus;
  readonly toStatus: ExecutionStatus;
  readonly message?: string;
  readonly provenance?: IExecutionRunProvenance;
  readonly diagnostics?: ReadonlyArray<IExecutionRunDiagnostics>;
  readonly occurredAt: string;
}

export interface IExecutionRunRecord {
  readonly runId: string;
  readonly planId: string;
  readonly status: ExecutionStatus;
  readonly unitIds: ReadonlyArray<string>;
  readonly units: Readonly<Record<string, IExecutionUnitRunRecord>>;
  readonly transitions: ReadonlyArray<IExecutionRunTransitionRecord>;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly cancellationSupported: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly terminalSummary?: IExecutionRunSummary;
  readonly diagnosticsSummary?: IExecutionRunSummary;
  readonly finalErrorMessage?: string;
}
