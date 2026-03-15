import type { INodeDefinition } from "./INodeDefinition";
import type { INodePort } from "./INodePort";
import type { INodeProperty, INodePropertyValidationResult } from "./INodeProperty";
import type { IModelCompatibility, ModelTask, RuntimeEngine } from "../../models/interfaces/IModelCompatibility";

export interface INodePosition {
  readonly x: number;
  readonly y: number;
}

export interface INodeSize {
  readonly width: number;
  readonly height: number;
}

export interface INodeConnectionReference {
  readonly nodeId: string;
  readonly portId: string;
}

export interface INodeValidationResult {
  readonly isValid: boolean;
  readonly messages: ReadonlyArray<string>;
  readonly propertyResults: Readonly<Record<string, INodePropertyValidationResult>>;
}

export interface INodeExecutionProfile {
  /**
   * Optional runtime selection or restriction resolved at the instance level.
   */
  readonly runtime?: RuntimeEngine;

  /**
   * Optional effective task profile resolved at the instance level.
   */
  readonly tasks?: ReadonlyArray<ModelTask>;

  /**
   * Optional effective model compatibility resolved from selected properties.
   */
  readonly modelCompatibility?: IModelCompatibility;
}

export interface INode {
  /**
   * Stable instance identifier.
   */
  readonly id: string;

  /**
   * Back-reference to the definition from which this node instance was created.
   */
  readonly definition: INodeDefinition;

  /**
   * Optional user-customized title.
   */
  readonly title?: string;

  /**
   * Optional notes/comments for the node.
   */
  readonly notes?: string;

  /**
   * Visual placement metadata.
   */
  readonly position?: INodePosition;
  readonly size?: INodeSize;

  /**
   * Current property values/configuration.
   */
  readonly properties: ReadonlyArray<INodeProperty>;

  /**
   * Current input and output ports.
   * These may be dynamic based on property configuration.
   */
  readonly inputPorts: ReadonlyArray<INodePort>;
  readonly outputPorts: ReadonlyArray<INodePort>;

  /**
   * Optional instance-level execution profile.
   */
  readonly executionProfile?: INodeExecutionProfile;

  /**
   * Whether the node is enabled in the workflow.
   */
  readonly isEnabled: boolean;

  /**
   * Whether the node is collapsed in the UI.
   */
  readonly isCollapsed: boolean;

  /**
   * Returns a property by ID.
   */
  getProperty<TValue = unknown>(propertyId: string): INodeProperty<TValue> | undefined;

  /**
   * Returns an input port by ID.
   */
  getInputPort(portId: string): INodePort | undefined;

  /**
   * Returns an output port by ID.
   */
  getOutputPort(portId: string): INodePort | undefined;

  /**
   * Returns a new node with an updated property value.
   */
  withPropertyValue<TValue>(propertyId: string, value: TValue): INode;

  /**
   * Returns a new node with an updated title.
   */
  withTitle(title: string): INode;

  /**
   * Returns a new node with updated notes.
   */
  withNotes(notes: string): INode;

  /**
   * Returns a new node with updated position.
   */
  withPosition(position: INodePosition): INode;

  /**
   * Returns a new node with updated size.
   */
  withSize(size: INodeSize): INode;

  /**
   * Returns a new node with an updated enabled state.
   */
  withEnabled(isEnabled: boolean): INode;

  /**
   * Returns a new node with an updated collapsed state.
   */
  withCollapsed(isCollapsed: boolean): INode;

  /**
   * Returns a new node with an updated execution profile.
   */
  withExecutionProfile(profile: INodeExecutionProfile): INode;

  /**
   * Validates the node as currently configured.
   */
  validate(): INodeValidationResult;

  /**
   * Returns true when the node is ready to participate in execution.
   */
  isExecutable(): boolean;

  /**
   * Returns true when the node has any model-bound configuration or ports.
   */
  isModelAware(): boolean;
}
