import type {
  WorkflowExecutionPolicy,
  WorkflowStatus,
} from "@domain/workflows/interfaces/IWorkflow";

export interface CreateWorkflowRequest {
  readonly id?: string;

  readonly metadata: {
    readonly name: string;
    readonly description?: string;
    readonly author?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly version?: string;
  };

  readonly status?: WorkflowStatus;
  readonly isEnabled?: boolean;
  readonly executionPolicy?: WorkflowExecutionPolicy;

  readonly runtimeProfile?: {
    readonly preferredRuntime?: string;
    readonly allowedRuntimes?: ReadonlyArray<string>;
  };

  /**
   * Optional seed structure for import/clone flows.
   * For a brand-new workflow, these will usually be omitted.
   */
  readonly nodes?: ReadonlyArray<{
    readonly id: string;
  }>;

  readonly connections?: ReadonlyArray<{
    readonly id: string;
  }>;

  readonly validateOnCreate?: boolean;
}

