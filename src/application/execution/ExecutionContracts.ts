import type { ExecutionStatus } from "@domain/execution/ExecutionPlan";
import type {
  IExecutionRunArtifact,
  IExecutionRunDiagnostics,
  IExecutionRunProvenance,
  IExecutionRunRecord,
  IExecutionRunSummary,
} from "@domain/execution/ExecutionRun";

export type IExecutionDiagnostics = IExecutionRunDiagnostics;
export type IExecutionProvenance = IExecutionRunProvenance;
export type IExecutionArtifact<TValue = unknown> = IExecutionRunArtifact<TValue>;
export type IExecutionRunSnapshot = IExecutionRunRecord;

export interface IExecutionEngineEvent {
  readonly planId: string;
  readonly runId: string;
  readonly unitId: string;
  readonly status: ExecutionStatus;
  readonly message?: string;
  readonly provenance?: IExecutionProvenance;
  readonly diagnostics?: ReadonlyArray<IExecutionDiagnostics>;
  readonly outputMetadata?: Readonly<Record<string, unknown>>;
  readonly outputSummary?: IExecutionRunSummary;
  readonly artifacts?: ReadonlyArray<IExecutionArtifact>;
  readonly detail?: IExecutionArtifact;
}

