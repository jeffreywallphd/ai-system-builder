export interface WorkflowResponse {
  readonly id: string;

  readonly metadata: {
    readonly name: string;
    readonly description?: string;
    readonly author?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly version?: string;
  };

  readonly status: string;
  readonly isEnabled: boolean;
  readonly executionPolicy: string;

  readonly runtimeProfile?: {
    readonly preferredRuntime?: string;
    readonly allowedRuntimes?: ReadonlyArray<string>;
  };

  readonly audit?: {
    readonly createdAt?: string;
    readonly updatedAt?: string;
  };

  readonly nodes: ReadonlyArray<{
    readonly id: string;
    readonly definitionId: string;
    readonly definitionType: string;
    readonly definitionTitle: string;
    readonly category: string;
    readonly executionKind: string;
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
      readonly name: string;
      readonly type: string;
      readonly value: unknown;
      readonly isAdvanced: boolean;
      readonly isEditable: boolean;
      readonly isPersisted: boolean;
      readonly order: number;
    }>;
    readonly inputPorts: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
      readonly direction: string;
      readonly cardinality: string;
      readonly isControlPort: boolean;
      readonly order: number;
      readonly valueTypes: ReadonlyArray<string>;
    }>;
    readonly outputPorts: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
      readonly direction: string;
      readonly cardinality: string;
      readonly isControlPort: boolean;
      readonly order: number;
      readonly valueTypes: ReadonlyArray<string>;
    }>;
    readonly executionProfile?: {
      readonly runtime?: string;
      readonly tasks?: ReadonlyArray<string>;
    };
    readonly isEnabled: boolean;
    readonly isCollapsed: boolean;
    readonly isExecutable: boolean;
    readonly isModelAware: boolean;
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
    readonly kind: string;
    readonly state: string;
    readonly isEnabled: boolean;
    readonly order?: number;
    readonly metadata?: {
      readonly label?: string;
      readonly description?: string;
      readonly tags?: ReadonlyArray<string>;
    };
  }>;

  readonly graph: {
    readonly entryNodeIds: ReadonlyArray<string>;
    readonly exitNodeIds: ReadonlyArray<string>;
    readonly hasCycles: boolean;
  };

  readonly validation: {
    readonly isValid: boolean;
    readonly messages: ReadonlyArray<{
      readonly code: string;
      readonly severity: string;
      readonly scope: string;
      readonly message: string;
      readonly target?: {
        readonly workflowId?: string;
        readonly nodeId?: string;
        readonly connectionId?: string;
        readonly portId?: string;
        readonly propertyId?: string;
      };
    }>;
    readonly invalidNodeIds: ReadonlyArray<string>;
    readonly invalidConnectionIds: ReadonlyArray<string>;
  };

  readonly isExecutable: boolean;
}
