import type {
  WorkflowExecutionPolicy,
  WorkflowStatus,
} from "../../domain/workflows/interfaces/IWorkflow";

export interface SaveWorkflowRequest {
  readonly id: string;

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

  readonly audit?: {
    readonly createdAt?: string;
    readonly updatedAt?: string;
  };

  /**
   * The full workflow payload to persist.
   * The application layer can map this into domain objects.
   */
  readonly nodes: ReadonlyArray<{
    readonly id: string;
    readonly definitionId: string;
    readonly title?: string;
    readonly notes?: string;
    readonly position?: {
      readonly x: number;
      readonly y: number;
    };
    readonly size?: {
      readonly width: number;
      readonly height: number;
    };
    readonly properties: ReadonlyArray<{
      readonly id: string;
      readonly value: unknown;
    }>;
    readonly executionProfile?: {
      readonly runtime?: string;
      readonly tasks?: ReadonlyArray<string>;
    };
    readonly isEnabled?: boolean;
    readonly isCollapsed?: boolean;
  }>;

  readonly connections: ReadonlyArray<{
    readonly id: string;
    readonly source: {
      readonly nodeId: string;
      readonly portId: string;
    };
    readonly target: {
      readonly nodeId: string;
      readonly portId: string;
    };
    readonly kind?: string;
    readonly state?: string;
    readonly isEnabled?: boolean;
    readonly order?: number;
    readonly metadata?: {
      readonly label?: string;
      readonly description?: string;
      readonly tags?: ReadonlyArray<string>;
    };
  }>;
}
