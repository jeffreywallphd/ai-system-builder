import type {
  PersistedWorkflowRecord,
  PersistedWorkflowSummary,
  WorkflowPersistenceStatus,
} from "@domain/workflow-studio/WorkflowPersistenceDomain";

export interface WorkflowPersistenceListQuery {
  readonly status?: WorkflowPersistenceStatus;
  readonly ownerId?: string;
  readonly studioId?: string;
  readonly searchText?: string;
  readonly limit?: number;
}

export interface IWorkflowPersistenceRepository {
  create(record: PersistedWorkflowRecord): Promise<PersistedWorkflowRecord>;
  update(record: PersistedWorkflowRecord): Promise<PersistedWorkflowRecord>;
  getById(id: string): Promise<PersistedWorkflowRecord | undefined>;
  list(query?: WorkflowPersistenceListQuery): Promise<ReadonlyArray<PersistedWorkflowSummary>>;
  duplicate(sourceWorkflowId: string, duplicateRecord: PersistedWorkflowRecord): Promise<PersistedWorkflowRecord>;
}

