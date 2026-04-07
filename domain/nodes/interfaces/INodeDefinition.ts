import type { INode } from "./INode";
import type { INodePort } from "./INodePort";
import type { INodeProperty } from "./INodeProperty";
import type { IModelCompatibility, ModelTask, RuntimeEngine } from "../../../src/domain/models/interfaces/IModelCompatibility";
import type { IModelDependency } from "../../../src/domain/models/interfaces/IModelDependency";

export type NodeExecutionKind =
  | "source"
  | "transform"
  | "generator"
  | "analyzer"
  | "selector"
  | "router"
  | "sink"
  | "control"
  | "utility"
  | "generic";

export interface INodeDefinitionCapabilityProfile {
  /**
   * Tasks the node can participate in or enable.
   */
  readonly tasks: ReadonlyArray<ModelTask>;

  /**
   * Optional runtime restrictions for this node definition.
   */
  readonly runtimes: ReadonlyArray<RuntimeEngine>;

  /**
   * Optional model compatibility constraints for nodes that directly host,
   * consume, or emit models.
   */
  readonly modelCompatibility?: IModelCompatibility;

  /**
   * Optional dependency expectations for supporting assets.
   */
  readonly dependencyConstraints?: ReadonlyArray<IModelDependency>;

  /**
   * True when the node is runtime-agnostic.
   */
  readonly allowsAnyRuntime: boolean;

  supportsTask(task: ModelTask): boolean;
  supportsRuntime(runtime: RuntimeEngine): boolean;
}

export interface INodeDefinition {
  /**
   * Stable definition identifier.
   */
  readonly id: string;

  /**
   * Internal node type key used for factories/registries/adapters.
   */
  readonly type: string;

  /**
   * Human-facing title shown in menus and inspectors.
   */
  readonly title: string;

  /**
   * Optional longer description.
   */
  readonly description?: string;

  /**
   * UI/category grouping.
   */
  readonly category: string;

  /**
   * High-level execution role.
   */
  readonly executionKind: NodeExecutionKind;

  /**
   * Input and output ports defined by this node type.
   */
  readonly inputPorts: ReadonlyArray<INodePort>;
  readonly outputPorts: ReadonlyArray<INodePort>;

  /**
   * Configurable node properties.
   */
  readonly properties: ReadonlyArray<INodeProperty>;

  /**
   * Optional capability profile for runtime/task/model filtering.
   */
  readonly capabilities: INodeDefinitionCapabilityProfile;

  /**
   * Whether this node should be shown in simplified UI.
   */
  readonly isVisibleInBasicMode: boolean;

  /**
   * Whether multiple instances are allowed in a workflow.
   */
  readonly allowsMultipleInstances: boolean;

  /**
   * Creates a node instance from this definition.
   */
  createInstance(nodeId: string): INode;

  /**
   * Returns a property definition by ID.
   */
  getProperty(propertyId: string): INodeProperty | undefined;

  /**
   * Returns an input port definition by ID.
   */
  getInputPort(portId: string): INodePort | undefined;

  /**
   * Returns an output port definition by ID.
   */
  getOutputPort(portId: string): INodePort | undefined;

  /**
   * Returns true when the definition exposes any model-bound properties or ports.
   */
  isModelAware(): boolean;
}
