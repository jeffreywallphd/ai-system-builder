import type { INode } from "../../domain/nodes/interfaces/INode";
import type { INodeDefinition } from "../../domain/nodes/interfaces/INodeDefinition";
import type { INodePort } from "../../domain/nodes/interfaces/INodePort";
import type { INodeProperty } from "../../domain/nodes/interfaces/INodeProperty";

export interface NodePaletteItemViewModel {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly category: string;
  readonly description?: string;
  readonly executionKind: string;
  readonly isModelAware: boolean;
  readonly isVisibleInBasicMode: boolean;
}

export interface NodePropertyFieldViewModel {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly value: unknown;
  readonly description?: string;
  readonly isEditable: boolean;
  readonly isAdvanced: boolean;
  readonly isEmpty: boolean;
  readonly options?: ReadonlyArray<{
    readonly label: string;
    readonly value: unknown;
  }>;
}

export interface NodePortViewModel {
  readonly id: string;
  readonly name: string;
  readonly direction: string;
  readonly cardinality: string;
  readonly valueTypes: ReadonlyArray<string>;
  readonly isControlPort: boolean;
  readonly isOptional: boolean;
}

export interface NodeDetailViewModel {
  readonly id: string;
  readonly title: string;
  readonly definitionTitle: string;
  readonly definitionType: string;
  readonly category: string;
  readonly executionKind: string;
  readonly notes?: string;
  readonly isEnabled: boolean;
  readonly isCollapsed: boolean;
  readonly isExecutable: boolean;
  readonly isModelAware: boolean;
  readonly position?: {
    readonly x: number;
    readonly y: number;
  };
  readonly size?: {
    readonly width: number;
    readonly height: number;
  };
  readonly properties: ReadonlyArray<NodePropertyFieldViewModel>;
  readonly inputPorts: ReadonlyArray<NodePortViewModel>;
  readonly outputPorts: ReadonlyArray<NodePortViewModel>;
}

export class NodePresenter {
  public presentPaletteItem(definition: INodeDefinition): NodePaletteItemViewModel {
    return Object.freeze({
      id: definition.id,
      type: definition.type,
      title: definition.title,
      category: definition.category,
      description: definition.description,
      executionKind: definition.executionKind,
      isModelAware: definition.isModelAware(),
      isVisibleInBasicMode: definition.isVisibleInBasicMode,
    });
  }

  public presentPalette(
    definitions: ReadonlyArray<INodeDefinition>
  ): ReadonlyArray<NodePaletteItemViewModel> {
    return Object.freeze(definitions.map((definition) => this.presentPaletteItem(definition)));
  }

  public presentNode(node: INode): NodeDetailViewModel {
    return Object.freeze({
      id: node.id,
      title: node.title?.trim() || node.definition.title,
      definitionTitle: node.definition.title,
      definitionType: node.definition.type,
      category: node.definition.category,
      executionKind: node.definition.executionKind,
      notes: node.notes,
      isEnabled: node.isEnabled,
      isCollapsed: node.isCollapsed,
      isExecutable: node.isExecutable(),
      isModelAware: node.isModelAware(),
      position: node.position
        ? Object.freeze({
            x: node.position.x,
            y: node.position.y,
          })
        : undefined,
      size: node.size
        ? Object.freeze({
            width: node.size.width,
            height: node.size.height,
          })
        : undefined,
      properties: Object.freeze(
        [...node.properties]
          .sort((left, right) => left.order - right.order)
          .map((property) => this.presentProperty(property))
      ),
      inputPorts: Object.freeze(
        [...node.inputPorts]
          .sort((left, right) => left.order - right.order)
          .map((port) => this.presentPort(port))
      ),
      outputPorts: Object.freeze(
        [...node.outputPorts]
          .sort((left, right) => left.order - right.order)
          .map((port) => this.presentPort(port))
      ),
    });
  }

  public presentProperty(property: INodeProperty): NodePropertyFieldViewModel {
    return Object.freeze({
      id: property.id,
      name: property.name,
      type: property.type,
      value: property.value,
      description: property.description,
      isEditable: property.isEditable,
      isAdvanced: property.isAdvanced,
      isEmpty: property.isEmpty(),
      options: property.options
        ? Object.freeze(
            property.options.map((option) =>
              Object.freeze({
                label: option.label,
                value: option.value,
              })
            )
          )
        : undefined,
    });
  }

  public presentPort(port: INodePort): NodePortViewModel {
    return Object.freeze({
      id: port.id,
      name: port.name,
      direction: port.direction,
      cardinality: port.cardinality,
      valueTypes: Object.freeze([...(port.compatibility.valueTypes ?? [])]),
      isControlPort: port.isControlPort,
      isOptional: port.compatibility.isOptional,
    });
  }
}
