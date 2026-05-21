import type {
  ExecutionPlanRecord,
  ExecutionPlanStatus,
  ExecutionStepKind,
  ExecutionStepStatus,
} from "../../../contracts/execution-plans";

export interface ExecutionPlanListQuery {
  readonly workspaceId: string;
  readonly status?: ExecutionPlanStatus;
  readonly sourceRuntimeReadinessBindingId?: string;
  readonly sourceCompositionPlanId?: string;
  readonly stepKind?: ExecutionStepKind;
  readonly stepStatus?: ExecutionStepStatus;
  readonly adapterReferenceKind?: string;
  readonly safetyGateStatus?: string;
  readonly blocked?: boolean;
  readonly missingInputs?: boolean;
  readonly missingOutputs?: boolean;
  readonly providerSetupRequired?: boolean;
  readonly safetyReviewRequired?: boolean;
  readonly stale?: boolean;
  readonly archived?: boolean;
  readonly text?: string;
  readonly createdAfter?: string;
  readonly createdBefore?: string;
  readonly updatedAfter?: string;
  readonly updatedBefore?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface ExecutionPlanListResult {
  readonly plans: readonly ExecutionPlanRecord[];
  readonly nextCursor?: string;
}

export interface ExecutionPlanRepositoryPort {
  saveExecutionPlan(plan: ExecutionPlanRecord): Promise<ExecutionPlanRecord>;
  updateExecutionPlan(plan: ExecutionPlanRecord): Promise<ExecutionPlanRecord>;
  getExecutionPlanById(workspaceId: string, executionPlanId: string): Promise<ExecutionPlanRecord | undefined>;
  listExecutionPlans(query: ExecutionPlanListQuery): Promise<ExecutionPlanListResult>;
  archiveExecutionPlan(workspaceId: string, executionPlanId: string, archivedAt: string): Promise<ExecutionPlanRecord | undefined>;
}
