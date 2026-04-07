import type { IModelCompatibility, ModelModality, ModelTask, RuntimeEngine } from "@domain/models/interfaces/IModelCompatibility";
import type { IModelDependency } from "@domain/models/interfaces/IModelDependency";

export type NodePortDirection = "input" | "output";

export type NodePortValueType =
  | "text"
  | "number"
  | "boolean"
  | "json"
  | "binary"
  | "image"
  | "audio"
  | "video"
  | "tensor"
  | "embedding"
  | "document"
  | "chunks"
  | "dataset"
  | "vector-store"
  | "model"
  | "model-reference"
  | "model-artifact"
  | "prompt"
  | "messages"
  | "tool-call"
  | "tool-result"
  | "workflow-state"
  | "generic";

export type NodePortCardinality = "one" | "many";

export interface INodePortCompatibilityProfile {
  /**
   * High-level value categories accepted or emitted by the port.
   */
  readonly valueTypes: ReadonlyArray<NodePortValueType>;

  /**
   * Optional input modalities associated with the data flowing through the port.
   */
  readonly modalities?: ReadonlyArray<ModelModality>;

  /**
   * Optional tasks implied by the data or model assignment for this port.
   */
  readonly tasks?: ReadonlyArray<ModelTask>;

  /**
   * Optional runtime restrictions.
   */
  readonly runtimes?: ReadonlyArray<RuntimeEngine>;

  /**
   * Optional model compatibility constraints when the port carries or binds models.
   */
  readonly modelCompatibility?: IModelCompatibility;

  /**
   * Optional dependency expectations when the port is intended to receive
   * supporting assets such as tokenizers, adapters, LoRAs, schedulers, etc.
   */
  readonly dependencyConstraints?: ReadonlyArray<IModelDependency>;

  /**
   * Whether any value type is acceptable.
   */
  readonly allowsAnyValueType: boolean;

  /**
   * Whether the port can accept null/undefined/no value.
   */
  readonly isOptional: boolean;

  supportsValueType(valueType: NodePortValueType): boolean;
  supportsModality(modality: ModelModality): boolean;
  supportsTask(task: ModelTask): boolean;
  supportsRuntime(runtime: RuntimeEngine): boolean;
  isCompatibleWith(other: INodePortCompatibilityProfile): boolean;
}

export interface INodePort {
  /**
   * Stable port identifier within a node definition.
   */
  readonly id: string;

  /**
   * Human-facing port name.
   */
  readonly name: string;

  /**
   * Optional descriptive text for UI/help/validation.
   */
  readonly description?: string;

  /**
   * Input or output.
   */
  readonly direction: NodePortDirection;

  /**
   * Whether the port accepts/emits a single value or a collection of connections.
   */
  readonly cardinality: NodePortCardinality;

  /**
   * Whether the port is intended for control flow rather than data flow.
   * This keeps room for future orchestration/agent/workflow-control nodes.
   */
  readonly isControlPort: boolean;

  /**
   * Order hint for UI rendering.
   */
  readonly order: number;

  /**
   * Logical compatibility profile for the port.
   */
  readonly compatibility: INodePortCompatibilityProfile;

  /**
   * Indicates whether this port can connect to another port.
   */
  canConnectTo(other: INodePort): boolean;

  /**
   * Returns true when this port can carry models or model references.
   */
  carriesModelData(): boolean;

  /**
   * Returns true when this port expects supporting assets/dependencies.
   */
  expectsDependencies(): boolean;
}

