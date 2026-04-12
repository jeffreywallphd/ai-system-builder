import type {
  INode,
  INodeConnectionReference,
  INodeExecutionProfile,
  INodePosition,
  INodeSize,
  INodeValidationResult,
} from "./interfaces/INode";
import type { INodeDefinition } from "./interfaces/INodeDefinition";
import type { INodePort } from "./interfaces/INodePort";
import type {
  INodeProperty,
  INodePropertyValidationResult,
} from "./interfaces/INodeProperty";

export class NodeValidationResult implements INodeValidationResult {
  public readonly isValid: boolean;
  public readonly messages: ReadonlyArray<string>;
  public readonly propertyResults: Readonly<
    Record<string, INodePropertyValidationResult>
  >;

  constructor(params: {
    isValid: boolean;
    messages?: ReadonlyArray<string>;
    propertyResults?: Readonly<Record<string, INodePropertyValidationResult>>;
  }) {
    this.isValid = params.isValid;
    this.messages = Object.freeze([...(params.messages ?? [])]);
    this.propertyResults = Object.freeze({ ...(params.propertyResults ?? {}) });
  }
}

export class Node implements INode {
  public readonly id: string;
  public readonly definition: INodeDefinition;
  public readonly title?: string;
  public readonly notes?: string;
  public readonly position?: INodePosition;
  public readonly size?: INodeSize;
  public readonly properties: ReadonlyArray<INodeProperty>;
  public readonly inputPorts: ReadonlyArray<INodePort>;
  public readonly outputPorts: ReadonlyArray<INodePort>;
  public readonly executionProfile?: INodeExecutionProfile;
  public readonly isEnabled: boolean;
  public readonly isCollapsed: boolean;

  constructor(params: {
    id: string;
    definition: INodeDefinition;
    title?: string;
    notes?: string;
    position?: INodePosition;
    size?: INodeSize;
    properties?: ReadonlyArray<INodeProperty>;
    inputPorts?: ReadonlyArray<INodePort>;
    outputPorts?: ReadonlyArray<INodePort>;
    executionProfile?: INodeExecutionProfile;
    isEnabled?: boolean;
    isCollapsed?: boolean;
  }) {
    this.id = params.id;
    this.definition = params.definition;
    this.title = params.title;
    this.notes = params.notes;
    this.position = params.position
      ? Object.freeze({ ...params.position })
      : undefined;
    this.size = params.size ? Object.freeze({ ...params.size }) : undefined;
    this.properties = Object.freeze([
      ...(params.properties ?? params.definition.properties),
    ]);
    this.inputPorts = Object.freeze([
      ...(params.inputPorts ?? params.definition.inputPorts),
    ]);
    this.outputPorts = Object.freeze([
      ...(params.outputPorts ?? params.definition.outputPorts),
    ]);
    this.executionProfile = params.executionProfile
      ? Object.freeze({
          ...params.executionProfile,
          tasks: params.executionProfile.tasks
            ? Object.freeze([...params.executionProfile.tasks])
            : undefined,
        })
      : undefined;
    this.isEnabled = params.isEnabled ?? true;
    this.isCollapsed = params.isCollapsed ?? false;
  }

  public getProperty<TValue = unknown>(
    propertyId: string
  ): INodeProperty<TValue> | undefined {
    return this.properties.find(
      (property) => property.id === propertyId
    ) as INodeProperty<TValue> | undefined;
  }

  public getInputPort(portId: string): INodePort | undefined {
    return this.inputPorts.find((port) => port.id === portId);
  }

  public getOutputPort(portId: string): INodePort | undefined {
    return this.outputPorts.find((port) => port.id === portId);
  }

  public withPropertyValue<TValue>(propertyId: string, value: TValue): INode {
    const updatedProperties = this.properties.map((property) =>
      property.id === propertyId
        ? property.withValue(value)
        : property
    );

    return new Node({
      id: this.id,
      definition: this.definition,
      title: this.title,
      notes: this.notes,
      position: this.position,
      size: this.size,
      properties: updatedProperties,
      inputPorts: this.inputPorts,
      outputPorts: this.outputPorts,
      executionProfile: this.executionProfile,
      isEnabled: this.isEnabled,
      isCollapsed: this.isCollapsed,
    });
  }

  public withTitle(title: string): INode {
    return new Node({
      id: this.id,
      definition: this.definition,
      title,
      notes: this.notes,
      position: this.position,
      size: this.size,
      properties: this.properties,
      inputPorts: this.inputPorts,
      outputPorts: this.outputPorts,
      executionProfile: this.executionProfile,
      isEnabled: this.isEnabled,
      isCollapsed: this.isCollapsed,
    });
  }

  public withNotes(notes: string): INode {
    return new Node({
      id: this.id,
      definition: this.definition,
      title: this.title,
      notes,
      position: this.position,
      size: this.size,
      properties: this.properties,
      inputPorts: this.inputPorts,
      outputPorts: this.outputPorts,
      executionProfile: this.executionProfile,
      isEnabled: this.isEnabled,
      isCollapsed: this.isCollapsed,
    });
  }

  public withPosition(position: INodePosition): INode {
    return new Node({
      id: this.id,
      definition: this.definition,
      title: this.title,
      notes: this.notes,
      position,
      size: this.size,
      properties: this.properties,
      inputPorts: this.inputPorts,
      outputPorts: this.outputPorts,
      executionProfile: this.executionProfile,
      isEnabled: this.isEnabled,
      isCollapsed: this.isCollapsed,
    });
  }

  public withSize(size: INodeSize): INode {
    return new Node({
      id: this.id,
      definition: this.definition,
      title: this.title,
      notes: this.notes,
      position: this.position,
      size,
      properties: this.properties,
      inputPorts: this.inputPorts,
      outputPorts: this.outputPorts,
      executionProfile: this.executionProfile,
      isEnabled: this.isEnabled,
      isCollapsed: this.isCollapsed,
    });
  }

  public withEnabled(isEnabled: boolean): INode {
    return new Node({
      id: this.id,
      definition: this.definition,
      title: this.title,
      notes: this.notes,
      position: this.position,
      size: this.size,
      properties: this.properties,
      inputPorts: this.inputPorts,
      outputPorts: this.outputPorts,
      executionProfile: this.executionProfile,
      isEnabled,
      isCollapsed: this.isCollapsed,
    });
  }

  public withCollapsed(isCollapsed: boolean): INode {
    return new Node({
      id: this.id,
      definition: this.definition,
      title: this.title,
      notes: this.notes,
      position: this.position,
      size: this.size,
      properties: this.properties,
      inputPorts: this.inputPorts,
      outputPorts: this.outputPorts,
      executionProfile: this.executionProfile,
      isEnabled: this.isEnabled,
      isCollapsed,
    });
  }

  public withExecutionProfile(profile: INodeExecutionProfile): INode {
    return new Node({
      id: this.id,
      definition: this.definition,
      title: this.title,
      notes: this.notes,
      position: this.position,
      size: this.size,
      properties: this.properties,
      inputPorts: this.inputPorts,
      outputPorts: this.outputPorts,
      executionProfile: profile,
      isEnabled: this.isEnabled,
      isCollapsed: this.isCollapsed,
    });
  }

  public validate(): INodeValidationResult {
    const propertyResults: Record<string, INodePropertyValidationResult> = {};
    const messages: string[] = [];

    for (const property of this.properties) {
      const result = property.validate();
      propertyResults[property.id] = result;

      if (!result.isValid) {
        messages.push(...result.messages);
      }
    }

    const missingRequiredInputs = this.inputPorts.filter(
      (port) =>
        !port.compatibility.isOptional &&
        port.direction === "input" &&
        port.compatibility.valueTypes.length > 0 &&
        !port.isControlPort
    );

    if (
      missingRequiredInputs.length > 0 &&
      this.definition.executionKind === "source"
    ) {
      // Source nodes may legitimately have no connected inputs even if they define inputs,
      // so we do not add messages here.
    }

    const isValid = messages.length === 0;

    return new NodeValidationResult({
      isValid,
      messages,
      propertyResults,
    });
  }

  public isExecutable(): boolean {
    if (!this.isEnabled) {
      return false;
    }

    return this.validate().isValid;
  }

  public isModelAware(): boolean {
    if (this.definition.isModelAware()) {
      return true;
    }

    return this.properties.some((property) => property.isModelBound());
  }
}
