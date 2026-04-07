import type {
  IWorkflow,
  IWorkflowMetadata,
  WorkflowStatus,
} from "../../../domain/workflows/interfaces/IWorkflow";

export interface IWorkflowRecordSummary {
  /**
   * Stable workflow identifier.
   */
  readonly id: string;

  /**
   * Workflow metadata snapshot.
   */
  readonly metadata: IWorkflowMetadata;

  /**
   * Workflow lifecycle status.
   */
  readonly status: WorkflowStatus;

  /**
   * Whether the workflow is enabled.
   */
  readonly isEnabled: boolean;

  /**
   * Optional persistence/provider hint.
   */
  readonly provider?: string;

  /**
   * Optional update timestamp for sorting/deduplication.
   */
  readonly updatedAt?: Date;
}

export interface IWorkflowRepository {
  /**
   * Persists the workflow and returns the saved version.
   * Implementations may enrich audit fields or normalize payloads.
   */
  save(workflow: IWorkflow): Promise<IWorkflow>;

  /**
   * Loads a workflow by ID.
   */
  load(id: string): Promise<IWorkflow | undefined>;

  /**
   * Deletes a workflow by ID.
   * Implementations should be idempotent.
   */
  delete(id: string): Promise<void>;

  /**
   * Returns true when the workflow exists.
   */
  exists(id: string): Promise<boolean>;

  /**
   * Lists saved workflows using lightweight summaries.
   */
  list(): Promise<ReadonlyArray<IWorkflowRecordSummary>>;
}
