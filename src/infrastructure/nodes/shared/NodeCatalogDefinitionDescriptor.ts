import { NodeDefinition, NodeDefinitionCapabilityProfile } from "../../../../domain/nodes/NodeDefinition";
import type {
  INodeDefinition,
  NodeExecutionKind,
} from "../../../../domain/nodes/interfaces/INodeDefinition";
import type { INodePort } from "../../../../domain/nodes/interfaces/INodePort";
import type { INodeProperty } from "../../../../domain/nodes/interfaces/INodeProperty";

export interface INodeCatalogProjectionMetadata {
  readonly group?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly keywords?: ReadonlyArray<string>;
  readonly supportsAuthoringView?: boolean;
  readonly supportsToolView?: boolean;
}

export interface INodeCatalogDefinitionDescriptor {
  readonly title: string;
  readonly description?: string;
  readonly category?: string;
  readonly executionKind?: NodeExecutionKind;
  readonly inputPorts?: ReadonlyArray<INodePort>;
  readonly outputPorts?: ReadonlyArray<INodePort>;
  readonly properties?: ReadonlyArray<INodeProperty>;
  readonly capabilities?: INodeDefinition["capabilities"];
  readonly isVisibleInBasicMode?: boolean;
  readonly allowsMultipleInstances?: boolean;
  readonly technicalName?: string;
  readonly technicalDescription?: string;
  readonly projection?: INodeCatalogProjectionMetadata;
}

export function toNodeCatalogDefinitionDescriptor(
  descriptor: INodeCatalogDefinitionDescriptor
): INodeCatalogDefinitionDescriptor {
  return Object.freeze({
    ...descriptor,
    inputPorts: descriptor.inputPorts
      ? Object.freeze([...descriptor.inputPorts])
      : undefined,
    outputPorts: descriptor.outputPorts
      ? Object.freeze([...descriptor.outputPorts])
      : undefined,
    properties: descriptor.properties
      ? Object.freeze([...descriptor.properties])
      : undefined,
    projection: descriptor.projection
      ? Object.freeze({
          ...descriptor.projection,
          tags: descriptor.projection.tags
            ? Object.freeze([...descriptor.projection.tags])
            : undefined,
          keywords: descriptor.projection.keywords
            ? Object.freeze([...descriptor.projection.keywords])
            : undefined,
        })
      : undefined,
  });
}

export function createNodeDefinitionFromCatalogDescriptor(params: {
  nodeTypeId: string;
  catalog: INodeCatalogDefinitionDescriptor;
  fallbackCategory?: string;
}): INodeDefinition {
  const category = params.catalog.category ?? params.fallbackCategory ?? "Uncategorized";

  return new NodeDefinition({
    id: params.nodeTypeId,
    type: params.nodeTypeId,
    title: params.catalog.title,
    description: params.catalog.description,
    category,
    executionKind: params.catalog.executionKind ?? "generic",
    inputPorts: params.catalog.inputPorts ?? [],
    outputPorts: params.catalog.outputPorts ?? [],
    properties: params.catalog.properties ?? [],
    capabilities:
      params.catalog.capabilities ??
      new NodeDefinitionCapabilityProfile({
        tasks: ["generic"],
        runtimes: ["generic"],
        allowsAnyRuntime: true,
      }),
    isVisibleInBasicMode: params.catalog.isVisibleInBasicMode,
    allowsMultipleInstances: params.catalog.allowsMultipleInstances,
  });
}

export function createFallbackNodeCatalogDefinitionDescriptor(params: {
  title: string;
  providerId: string;
  description?: string;
  category?: string;
}): INodeCatalogDefinitionDescriptor {
  return toNodeCatalogDefinitionDescriptor({
    title: params.title,
    description:
      params.description ?? `Registered runtime node from ${params.providerId}.`,
    category: params.category ?? toCategoryLabel(params.providerId),
    inputPorts: [],
    outputPorts: [],
    properties: [],
  });
}

export function toCategoryLabel(providerId: string): string {
  return providerId
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
