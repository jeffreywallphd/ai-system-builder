import type {
  INodeDefinition,
  INodeDefinitionCapabilityProfile,
  NodeExecutionKind,
} from "./interfaces/INodeDefinition";
import type { INode } from "./interfaces/INode";
import type { INodePort } from "./interfaces/INodePort";
import type { INodeProperty } from "./interfaces/INodeProperty";
import type {
  IModelCompatibility,
  ModelTask,
  RuntimeEngine,
} from "../models/interfaces/IModelCompatibility";
import type { IModelDependency } from "../models/interfaces/IModelDependency";
import { Node } from "./Node";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeArray(values?: ReadonlyArray<string>): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map(normalize).filter(Boolean))];
}

export class NodeDefinitionCapabilityProfile
  implements INodeDefinitionCapabilityProfile
{
  public readonly tasks: ReadonlyArray<ModelTask>;
  public readonly runtimes: ReadonlyArray<RuntimeEngine>;
  public readonly modelCompatibility?: IModelCompatibility;
  public readonly dependencyConstraints?: ReadonlyArray<IModelDependency>;
  public readonly allowsAnyRuntime: boolean;

  constructor(params: {
    tasks?: ReadonlyArray<ModelTask>;
    runtimes?: ReadonlyArray<RuntimeEngine>;
    modelCompatibility?: IModelCompatibility;
    dependencyConstraints?: ReadonlyArray<IModelDependency>;
    allowsAnyRuntime?: boolean;
  } = {}) {
    this.tasks = Object.freeze([...(params.tasks ?? [])]);
    this.runtimes = Object.freeze([...(params.runtimes ?? [])]);
    this.modelCompatibility = params.modelCompatibility;
    this.dependencyConstraints = params.dependencyConstraints
      ? Object.freeze([...params.dependencyConstraints])
      : undefined;
    this.allowsAnyRuntime = params.allowsAnyRuntime ?? false;
  }

  public supportsTask(task: ModelTask): boolean {
    if (this.tasks.length === 0) {
      return true;
    }

    return normalizeArray(this.tasks).includes(normalize(task));
  }

  public supportsRuntime(runtime: RuntimeEngine): boolean {
    if (this.allowsAnyRuntime || this.runtimes.length === 0) {
      return true;
    }

    return normalizeArray(this.runtimes).includes(normalize(runtime));
  }
}

export class NodeDefinition implements INodeDefinition {
  public readonly id: string;
  public readonly type: string;
  public readonly title: string;
  public readonly description?: string;
  public readonly category: string;
  public readonly executionKind: NodeExecutionKind;
  public readonly inputPorts: ReadonlyArray<INodePort>;
  public readonly outputPorts: ReadonlyArray<INodePort>;
  public readonly properties: ReadonlyArray<INodeProperty>;
  public readonly capabilities: INodeDefinitionCapabilityProfile;
  public readonly isVisibleInBasicMode: boolean;
  public readonly allowsMultipleInstances: boolean;

  constructor(params: {
    id: string;
    type: string;
    title: string;
    description?: string;
    category: string;
    executionKind?: NodeExecutionKind;
    inputPorts?: ReadonlyArray<INodePort>;
    outputPorts?: ReadonlyArray<INodePort>;
    properties?: ReadonlyArray<INodeProperty>;
    capabilities?: INodeDefinitionCapabilityProfile;
    isVisibleInBasicMode?: boolean;
    allowsMultipleInstances?: boolean;
  }) {
    this.id = params.id;
    this.type = params.type;
    this.title = params.title;
    this.description = params.description;
    this.category = params.category;
    this.executionKind = params.executionKind ?? "generic";
    this.inputPorts = Object.freeze([...(params.inputPorts ?? [])]);
    this.outputPorts = Object.freeze([...(params.outputPorts ?? [])]);
    this.properties = Object.freeze([...(params.properties ?? [])]);
    this.capabilities =
      params.capabilities ?? new NodeDefinitionCapabilityProfile();
    this.isVisibleInBasicMode = params.isVisibleInBasicMode ?? true;
    this.allowsMultipleInstances = params.allowsMultipleInstances ?? true;
  }

  public createInstance(nodeId: string): INode {
    const clonedProperties = this.properties.map((property) =>
      property.withValue(
        property.defaultValue !== undefined ? property.defaultValue : property.value
      )
    );

    return new Node({
      id: nodeId,
      definition: this,
      properties: clonedProperties,
      inputPorts: this.inputPorts,
      outputPorts: this.outputPorts,
      isEnabled: true,
      isCollapsed: false,
    });
  }

  public getProperty(propertyId: string): INodeProperty | undefined {
    return this.properties.find((property) => property.id === propertyId);
  }

  public getInputPort(portId: string): INodePort | undefined {
    return this.inputPorts.find((port) => port.id === portId);
  }

  public getOutputPort(portId: string): INodePort | undefined {
    return this.outputPorts.find((port) => port.id === portId);
  }

  public isModelAware(): boolean {
    const hasModelProperty = this.properties.some((property) =>
      property.isModelBound()
    );

    if (hasModelProperty) {
      return true;
    }

    const hasModelPort = [...this.inputPorts, ...this.outputPorts].some(
      (port) => port.carriesModelData() || port.expectsDependencies()
    );

    if (hasModelPort) {
      return true;
    }

    return !!this.capabilities.modelCompatibility;
  }
}
