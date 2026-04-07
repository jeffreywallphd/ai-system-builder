export interface ExecuteWorkflowRequest {
  readonly workflowId?: string;

  /**
   * Optional target runtime/provider selection.
   */
  readonly target?: {
    readonly runtime?: string;
    readonly provider?: string;
    readonly profile?: string;
  };

  /**
   * Execution-time node property overrides.
   * Keyed by node ID, then property ID.
   */
  readonly propertyOverrides?: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;

  /**
   * Optional initial input assets.
   */
  readonly inputAssetIds?: ReadonlyArray<string>;

  /**
   * Optional freeform execution parameters.
   */
  readonly parameters?: Readonly<Record<string, unknown>>;

  readonly validateBeforeExecute?: boolean;

  readonly validationOptions?: {
    readonly failOnDisabledNodes?: boolean;
    readonly treatWarningsAsErrors?: boolean;
    readonly requireConnectedGraph?: boolean;
    readonly detectUnreachableNodes?: boolean;
    readonly requireEntryNode?: boolean;
    readonly requireExitNode?: boolean;
    readonly runtime?: string;
    readonly validateDependencies?: boolean;
    readonly validateModelCompatibility?: boolean;
  };
}
