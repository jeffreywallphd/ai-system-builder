import type { IModelCompatibility, ModelModality, ModelTask, RuntimeEngine } from "../../../domain/models/interfaces/IModelCompatibility";
import type { IModelDependency } from "../../../domain/models/interfaces/IModelDependency";

export type NodePropertyType =
  | "text"
  | "multiline-text"
  | "number"
  | "integer"
  | "boolean"
  | "select"
  | "multi-select"
  | "json"
  | "code"
  | "color"
  | "date"
  | "duration"
  | "slider"
  | "file"
  | "directory"
  | "secret"
  | "model-reference"
  | "model-list"
  | "template"
  | "key-value"
  | "generic";

export type NodePropertyValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<string>
  | ReadonlyArray<number>
  | ReadonlyArray<boolean>
  | Readonly<Record<string, unknown>>
  | unknown;

export interface INodePropertyOption<TValue = unknown> {
  readonly label: string;
  readonly value: TValue;
  readonly description?: string;
  readonly disabled?: boolean;
}

export interface INodePropertyValidationResult {
  readonly isValid: boolean;
  readonly messages: ReadonlyArray<string>;
}

export interface INodePropertyConstraint {
  readonly required?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly range?: INodePropertyValueRange;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly allowedValues?: ReadonlyArray<unknown>;
  readonly acceptedFileExtensions?: ReadonlyArray<string>;
}

export interface INodePropertyValueRange {
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly defaultValue: number;
  readonly clamp?: boolean;
}

export interface INodePropertyBindingProfile {
  /**
   * Optional modality/task/runtime constraints relevant to this property.
   * Especially useful for model selectors and runtime-specific properties.
   */
  readonly modalities?: ReadonlyArray<ModelModality>;
  readonly tasks?: ReadonlyArray<ModelTask>;
  readonly runtimes?: ReadonlyArray<RuntimeEngine>;

  /**
   * Optional model compatibility constraints when this property selects or
   * configures a model.
   */
  readonly modelCompatibility?: IModelCompatibility;

  /**
   * Optional dependency expectations when this property selects supporting assets.
   */
  readonly dependencyConstraints?: ReadonlyArray<IModelDependency>;
}


export type PropertyVisibilityLevel = "basic" | "advanced" | "hidden";

export interface INodePropertyProjectionMetadata {
  readonly label?: string;
  readonly description?: string;
  readonly group?: string;
  readonly order?: number;
  readonly authorVisibility?: PropertyVisibilityLevel;
  readonly toolVisibility?: PropertyVisibilityLevel;
  readonly exposeInAuthorForm?: boolean;
  readonly exposeInTool?: boolean;
  readonly fieldTypeHint?: string;
}

export interface INodeProperty<TValue = NodePropertyValue> {
  /**
   * Stable property identifier within a node definition.
   */
  readonly id: string;

  /**
   * Human-facing property name.
   */
  readonly name: string;

  /**
   * Optional description/help text.
   */
  readonly description?: string;

  /**
   * UI/editor value type.
   */
  readonly type: NodePropertyType;

  /**
   * Current value.
   */
  readonly value: TValue;

  /**
   * Default value for resets/new instances.
   */
  readonly defaultValue?: TValue;

  /**
   * Whether the property is user-editable.
   */
  readonly isEditable: boolean;

  /**
   * Whether the property should be persisted/exported.
   */
  readonly isPersisted: boolean;

  /**
   * Whether the property is advanced and may be hidden in simplified UI.
   */
  readonly isAdvanced: boolean;

  /**
   * Rendering order hint.
   */
  readonly order: number;

  /**
   * Validation and editor constraints.
   */
  readonly constraints?: INodePropertyConstraint;

  /**
   * Available options for select-like properties.
   */
  readonly options?: ReadonlyArray<INodePropertyOption<TValue>>;

  /**
   * Optional compatibility/binding profile for model-aware properties.
   */
  readonly bindingProfile?: INodePropertyBindingProfile;

  /**
   * Optional metadata for projecting this property into author and tool forms.
   */
  readonly projection?: INodePropertyProjectionMetadata;

  /**
   * Returns a new property with an updated value.
   * Domain objects should remain effectively immutable.
   */
  withValue(value: TValue): INodeProperty<TValue>;

  /**
   * Validates the current property value.
   */
  validate(): INodePropertyValidationResult;

  /**
   * Returns true when the property is effectively unset.
   */
  isEmpty(): boolean;

  /**
   * Returns true when the property references models or model-like assets.
   */
  isModelBound(): boolean;
}
