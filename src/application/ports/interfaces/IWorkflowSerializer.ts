import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";

export type WorkflowSerializationFormat =
  | "json"
  | "yaml"
  | "engine-json"
  | "engine-yaml"
  | "custom";

export interface IWorkflowSerializationTarget {
  /**
   * Output format.
   */
  readonly format: WorkflowSerializationFormat;

  /**
   * Optional target runtime/provider to shape the serialized form.
   * Examples:
   * - comfyui
   * - generic
   * - custom
   */
  readonly runtime?: string;

  /**
   * Optional version label for the target format/schema.
   */
  readonly version?: string;

  /**
   * Optional arbitrary serializer options.
   */
  readonly options?: Readonly<Record<string, unknown>>;
}

export interface IWorkflowSerializationRequest {
  readonly workflow: IWorkflow;
  readonly target: IWorkflowSerializationTarget;
}

export interface IWorkflowSerializationResult {
  /**
   * Serialized workflow payload.
   * This is string-based so it can represent JSON, YAML, or other text formats.
   */
  readonly content: string;

  /**
   * Resolved output format.
   */
  readonly format: WorkflowSerializationFormat;

  /**
   * Optional content type/MIME hint.
   */
  readonly contentType?: string;
}

export interface IWorkflowDeserializationRequest {
  readonly content: string;
  readonly source: {
    readonly format: WorkflowSerializationFormat;
    readonly runtime?: string;
    readonly version?: string;
    readonly options?: Readonly<Record<string, unknown>>;
  };
}

export interface IWorkflowSerializer {
  /**
   * Serializes a domain workflow to a textual payload.
   */
  serialize(
    request: IWorkflowSerializationRequest
  ): Promise<IWorkflowSerializationResult>;

  /**
   * Deserializes a textual payload into a domain workflow.
   */
  deserialize(
    request: IWorkflowDeserializationRequest
  ): Promise<IWorkflow>;

  /**
   * Returns true when this serializer can handle the requested target.
   */
  canSerialize(target: IWorkflowSerializationTarget): boolean;

  /**
   * Returns true when this serializer can handle the incoming source format.
   */
  canDeserialize(source: IWorkflowDeserializationRequest["source"]): boolean;
}

