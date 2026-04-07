import type {
  INodeCatalogProvider,
  INodeCatalogSearchCriteria,
} from "../../../application/ports/interfaces/INodeCatalogProvider";
import { NodeDefinition, NodeDefinitionCapabilityProfile } from "../../../../domain/nodes/NodeDefinition";
import { NodePort, NodePortCompatibilityProfile } from "../../../../domain/nodes/NodePort";
import {
  NodeProperty,
  NodePropertyBindingProfile,
} from "../../../../domain/nodes/NodeProperty";
import type {
  INodeDefinition,
  NodeExecutionKind,
} from "../../../../domain/nodes/interfaces/INodeDefinition";
import type {
  NodePortValueType,
} from "../../../../domain/nodes/interfaces/INodePort";
import type {
  INodePropertyOption,
  NodePropertyType,
} from "../../../../domain/nodes/interfaces/INodeProperty";
import type {
  ModelModality,
  ModelTask,
  RuntimeEngine,
} from "../../../domain/models/interfaces/IModelCompatibility";

export interface IComfyObjectInfo {
  readonly input?: {
    readonly required?: Readonly<Record<string, ComfyInputSpec>>;
    readonly optional?: Readonly<Record<string, ComfyInputSpec>>;
    readonly hidden?: Readonly<Record<string, ComfyInputSpec>>;
  };
  readonly output?: ReadonlyArray<string>;
  readonly output_name?: ReadonlyArray<string>;
  readonly output_is_list?: ReadonlyArray<boolean>;
  readonly name?: string;
  readonly display_name?: string;
  readonly description?: string;
  readonly category?: string;
  readonly output_node?: boolean;
  readonly deprecated?: boolean;
  readonly experimental?: boolean;
}

export type ComfyInputSpec =
  | readonly [string, Readonly<Record<string, unknown>>?]
  | readonly [ReadonlyArray<string>, Readonly<Record<string, unknown>>?];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeArray(values?: ReadonlyArray<string>): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map(normalize).filter(Boolean))];
}

function includesAnyNormalized(
  candidates: ReadonlyArray<string> | undefined,
  filters: ReadonlyArray<string> | undefined
): boolean {
  const normalizedFilters = normalizeArray(filters);

  if (normalizedFilters.length === 0) {
    return true;
  }

  const normalizedCandidates = new Set(normalizeArray(candidates));
  return normalizedFilters.some((filter) => normalizedCandidates.has(filter));
}

function inferValueType(typeName: string): NodePortValueType {
  const normalized = normalize(typeName);

  if (normalized === "image") return "image";
  if (normalized === "audio") return "audio";
  if (normalized === "video") return "video";
  if (normalized === "string") return "text";
  if (normalized === "int" || normalized === "float") return "number";
  if (normalized === "boolean" || normalized === "bool") return "boolean";
  if (normalized === "latent") return "generic";
  if (normalized === "conditioning") return "generic";
  if (normalized === "mask") return "image";
  if (normalized === "model") return "model";
  if (normalized === "clip") return "model";
  if (normalized === "vae") return "model";
  if (normalized === "control_net" || normalized === "controlnet") return "model";
  if (normalized === "lora") return "model-reference";

  return "generic";
}

function inferModality(typeName: string): ReadonlyArray<ModelModality> {
  const normalized = normalize(typeName);

  if (normalized === "image" || normalized === "mask") return ["image"];
  if (normalized === "audio") return ["audio"];
  if (normalized === "video") return ["video"];
  if (normalized === "string") return ["text"];

  return [];
}

function inferTasks(
  nodeType: string,
  category: string,
  ioType: string
): ReadonlyArray<ModelTask> {
  const text = `${normalize(nodeType)} ${normalize(category)} ${normalize(ioType)}`;

  if (text.includes("ksampler") || text.includes("sampler")) return ["image-generation"];
  if (text.includes("clip") && text.includes("text")) return ["embedding"];
  if (text.includes("vae") && text.includes("decode")) return ["image-generation"];
  if (text.includes("vae") && text.includes("encode")) return ["image-editing"];
  if (text.includes("upscale")) return ["upscaling"];
  if (text.includes("inpaint")) return ["inpainting"];
  if (text.includes("controlnet")) return ["control"];
  if (text.includes("load")) return ["generic"];
  if (text.includes("save")) return ["generic"];

  return ["generic"];
}

function inferExecutionKind(type: string, category: string): NodeExecutionKind {
  const text = `${normalize(type)} ${normalize(category)}`;

  if (text.includes("load")) return "source";
  if (text.includes("save") || text.includes("preview")) return "sink";
  if (text.includes("ksampler") || text.includes("sampler") || text.includes("generate")) {
    return "generator";
  }
  if (text.includes("switch") || text.includes("route")) return "router";
  if (text.includes("control")) return "control";
  if (text.includes("utility")) return "utility";

  return "transform";
}

function inferCategory(rawCategory?: string): string {
  const category = rawCategory?.trim() || "utility";
  const first = category.split("/")[0]?.trim();
  return first || "utility";
}

function isPortType(inputSpec: ComfyInputSpec): boolean {
  const primary = inputSpec[0];

  if (Array.isArray(primary)) {
    return false;
  }

  const normalized = normalize(primary);

  if (["int", "float", "string", "boolean", "bool"].includes(normalized)) {
    return false;
  }

  return primary === primary.toUpperCase();
}

function toPropertyType(inputSpec: ComfyInputSpec): NodePropertyType {
  const primary = inputSpec[0];

  if (Array.isArray(primary)) {
    return primary.length > 1 ? "select" : "text";
  }

  const normalized = normalize(primary);

  if (normalized === "int") return "integer";
  if (normalized === "float") return "number";
  if (normalized === "boolean" || normalized === "bool") return "boolean";
  if (normalized === "string") return "text";

  return "generic";
}

function toPropertyDefault(inputSpec: ComfyInputSpec): unknown {
  const config = inputSpec[1] ?? {};

  if ("default" in config) {
    return config.default;
  }

  const primary = inputSpec[0];
  if (Array.isArray(primary) && primary.length > 0) {
    return primary[0];
  }

  return undefined;
}

function toPropertyOptions(
  inputSpec: ComfyInputSpec
): ReadonlyArray<INodePropertyOption<unknown>> | undefined {
  const primary = inputSpec[0];

  if (!Array.isArray(primary)) {
    return undefined;
  }

  return Object.freeze(
    primary.map((value) =>
      Object.freeze({
        label: String(value),
        value,
      })
    )
  );
}

function matchesCriteria(
  definition: INodeDefinition,
  criteria?: INodeCatalogSearchCriteria
): boolean {
  if (!criteria) {
    return true;
  }

  if (criteria.query?.trim()) {
    const query = normalize(criteria.query);
    const haystack = [
      definition.id,
      definition.type,
      definition.title,
      definition.description,
      definition.category,
      definition.executionKind,
      ...definition.capabilities.tasks,
      ...definition.capabilities.runtimes,
    ]
      .filter(Boolean)
      .map((value) => normalize(String(value)));

    if (!haystack.some((value) => value.includes(query))) {
      return false;
    }
  }

  if (
    criteria.categories &&
    criteria.categories.length > 0 &&
    !includesAnyNormalized([definition.category], criteria.categories)
  ) {
    return false;
  }

  if (
    criteria.executionKinds &&
    criteria.executionKinds.length > 0 &&
    !criteria.executionKinds.includes(definition.executionKind)
  ) {
    return false;
  }

  if (
    criteria.tasks &&
    criteria.tasks.length > 0 &&
    !includesAnyNormalized(definition.capabilities.tasks, criteria.tasks)
  ) {
    return false;
  }

  if (
    criteria.runtimes &&
    criteria.runtimes.length > 0 &&
    !(
      definition.capabilities.allowsAnyRuntime ||
      includesAnyNormalized(definition.capabilities.runtimes, criteria.runtimes)
    )
  ) {
    return false;
  }

  if (criteria.basicModeOnly && !definition.isVisibleInBasicMode) {
    return false;
  }

  if (criteria.modelAwareOnly && !definition.isModelAware()) {
    return false;
  }

  if (criteria.modalities && criteria.modalities.length > 0) {
    const modalities = new Set<string>();

    for (const port of [...definition.inputPorts, ...definition.outputPorts]) {
      for (const modality of port.compatibility.modalities ?? []) {
        modalities.add(normalize(modality));
      }
    }

    const matched = criteria.modalities.some((modality) =>
      modalities.has(normalize(modality))
    );

    if (!matched) {
      return false;
    }
  }

  return true;
}

function scoreDefinition(
  definition: INodeDefinition,
  criteria?: INodeCatalogSearchCriteria
): number {
  if (!criteria?.query?.trim()) {
    return definition.isVisibleInBasicMode ? 10 : 0;
  }

  const query = normalize(criteria.query);
  const title = normalize(definition.title);
  const type = normalize(definition.type);

  let score = 0;
  if (title === query) score += 250;
  if (type === query) score += 220;
  if (title.startsWith(query)) score += 100;
  if (type.startsWith(query)) score += 90;
  if (title.includes(query)) score += 70;
  if (type.includes(query)) score += 60;
  if (definition.isVisibleInBasicMode) score += 5;

  return score;
}

export class ComfyNodeCatalogProvider implements INodeCatalogProvider {
  private readonly rawDefinitions: ReadonlyMap<string, IComfyObjectInfo>;
  private readonly mappedDefinitions: ReadonlyArray<INodeDefinition>;

  constructor(rawDefinitions: Readonly<Record<string, IComfyObjectInfo>>) {
    this.rawDefinitions = new Map(Object.entries(rawDefinitions));
    this.mappedDefinitions = Object.freeze(
      [...this.rawDefinitions.entries()].map(([type, info]) => this.mapDefinition(type, info))
    );
  }

  public async getAllDefinitions(): Promise<ReadonlyArray<INodeDefinition>> {
    return this.mappedDefinitions;
  }

  public async searchDefinitions(
    criteria?: INodeCatalogSearchCriteria
  ): Promise<ReadonlyArray<INodeDefinition>> {
    return Object.freeze(
      this.mappedDefinitions
        .filter((definition) => matchesCriteria(definition, criteria))
        .sort((left, right) => scoreDefinition(right, criteria) - scoreDefinition(left, criteria))
    );
  }

  public async getDefinitionById(id: string): Promise<INodeDefinition | undefined> {
    const normalizedId = normalize(id);

    return this.mappedDefinitions.find(
      (definition) =>
        normalize(definition.id) === normalizedId ||
        normalize(definition.type) === normalizedId
    );
  }

  public async getDefinitionByType(type: string): Promise<INodeDefinition | undefined> {
    const normalizedType = normalize(type);

    return this.mappedDefinitions.find(
      (definition) => normalize(definition.type) === normalizedType
    );
  }

  public async getCategories(): Promise<ReadonlyArray<string>> {
    const categories = new Set<string>();

    for (const definition of this.mappedDefinitions) {
      categories.add(definition.category);
    }

    return Object.freeze([...categories].sort((left, right) => left.localeCompare(right)));
  }

  private mapDefinition(type: string, info: IComfyObjectInfo): INodeDefinition {
    const category = inferCategory(info.category);

    const requiredInputs = info.input?.required ?? {};
    const optionalInputs = info.input?.optional ?? {};

    const inputPorts = [
      ...this.mapInputPorts(type, category, requiredInputs, false),
      ...this.mapInputPorts(type, category, optionalInputs, true),
    ];

    const properties = [
      ...this.mapProperties(requiredInputs, false),
      ...this.mapProperties(optionalInputs, true),
    ];

    const outputTypes = [...(info.output ?? [])];
    const outputNames = [...(info.output_name ?? [])];
    const outputIsList = [...(info.output_is_list ?? [])];

    const outputPorts = outputTypes.map((outputType, index) => {
      const portId = outputNames[index]?.trim() || `output_${index}`;

      return new NodePort({
        id: portId,
        name: portId,
        description: undefined,
        direction: "output",
        cardinality: outputIsList[index] ? "many" : "one",
        isControlPort: false,
        order: index,
        compatibility: new NodePortCompatibilityProfile({
          valueTypes: [inferValueType(outputType)],
          modalities: inferModality(outputType),
          tasks: inferTasks(type, category, outputType),
          runtimes: ["comfyui"],
          allowsAnyValueType: false,
          isOptional: false,
        }),
      });
    });

    return new NodeDefinition({
      id: type,
      type,
      title: info.display_name?.trim() || info.name?.trim() || type,
      description: info.description?.trim() || undefined,
      category,
      executionKind: inferExecutionKind(type, category),
      inputPorts,
      outputPorts,
      properties,
      capabilities: new NodeDefinitionCapabilityProfile({
        tasks: Object.freeze(
          [
            ...new Set(
              [...inputPorts, ...outputPorts].flatMap((port) => port.compatibility.tasks ?? [])
            ),
          ]
        ),
        runtimes: ["comfyui"],
        allowsAnyRuntime: false,
      }),
      isVisibleInBasicMode: !(info.experimental || info.deprecated),
      allowsMultipleInstances: true,
    });
  }

  private mapInputPorts(
    type: string,
    category: string,
    inputs: Readonly<Record<string, ComfyInputSpec>>,
    isOptional: boolean
  ): ReadonlyArray<NodePort> {
    const result: NodePort[] = [];
    let order = 0;

    for (const [inputName, inputSpec] of Object.entries(inputs)) {
      if (!isPortType(inputSpec)) {
        continue;
      }

      const primary = inputSpec[0] as string;

      result.push(
        new NodePort({
          id: inputName,
          name: inputName,
          description: undefined,
          direction: "input",
          cardinality: "one",
          isControlPort: false,
          order: order++,
          compatibility: new NodePortCompatibilityProfile({
            valueTypes: [inferValueType(primary)],
            modalities: inferModality(primary),
            tasks: inferTasks(type, category, primary),
            runtimes: ["comfyui"],
            allowsAnyValueType: false,
            isOptional,
          }),
        })
      );
    }

    return Object.freeze(result);
  }

  private mapProperties(
    inputs: Readonly<Record<string, ComfyInputSpec>>,
    isOptional: boolean
  ): ReadonlyArray<NodeProperty> {
    const result: NodeProperty[] = [];
    let order = 0;

    for (const [inputName, inputSpec] of Object.entries(inputs)) {
      if (isPortType(inputSpec)) {
        continue;
      }

      const propertyType = toPropertyType(inputSpec);
      const defaultValue = toPropertyDefault(inputSpec);
      const options = toPropertyOptions(inputSpec);

      const minimum = getNumericConfig(inputSpec, "min");
      const maximum = getNumericConfig(inputSpec, "max");
      const defaultNumber = typeof defaultValue === "number" ? defaultValue : undefined;
      const range =
        (propertyType === "integer" || propertyType === "number") &&
        minimum !== undefined &&
        maximum !== undefined &&
        defaultNumber !== undefined
          ? Object.freeze({
              min: minimum,
              max: maximum,
              defaultValue: defaultNumber,
              step: propertyType === "integer" ? 1 : undefined,
            })
          : undefined;

      result.push(
        new NodeProperty({
          id: inputName,
          name: inputName,
          description: undefined,
          type: propertyType,
          value: defaultValue,
          defaultValue,
          isEditable: true,
          isPersisted: true,
          isAdvanced: isOptional,
          order: order++,
          constraints: Object.freeze({
            required: !isOptional,
            min: minimum,
            max: maximum,
            range,
            minLength: getNumericConfig(inputSpec, "min_length"),
            maxLength: getNumericConfig(inputSpec, "max_length"),
          }),
          options,
          bindingProfile:
            propertyType === "model-reference" || propertyType === "model-list"
              ? new NodePropertyBindingProfile({
                  runtimes: ["comfyui"],
                })
              : undefined,
        })
      );
    }

    return Object.freeze(result);
  }
}

function getNumericConfig(inputSpec: ComfyInputSpec, key: string): number | undefined {
  const config = inputSpec[1];

  if (!config || !(key in config)) {
    return undefined;
  }

  const value = config[key];
  return typeof value === "number" ? value : undefined;
}
