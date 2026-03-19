import { Node } from "../../domain/nodes/Node";
import { NodeProperty } from "../../domain/nodes/NodeProperty";
import type { INode } from "../../domain/nodes/interfaces/INode";
import type {
  INodeProperty,
  INodePropertyConstraint,
  INodePropertyOption,
  NodePropertyType,
} from "../../domain/nodes/interfaces/INodeProperty";
import type { McpToolArgumentDescriptor, McpToolDescriptor } from "./models/McpToolDescriptor";

export const MCP_TOOL_CALL_NODE_TYPE = "mcp.tool_call";
export const MCP_TOOL_CALL_SERVER_ID_PROPERTY = "serverId";
export const MCP_TOOL_CALL_TOOL_NAME_PROPERTY = "toolName";
export const MCP_TOOL_CALL_TOOL_DESCRIPTOR_PROPERTY = "toolDescriptor";
export const MCP_TOOL_CALL_STRINGIFY_RESULT_PROPERTY = "stringifyResult";
export const MCP_TOOL_CALL_FAIL_ON_MISSING_ARGS_PROPERTY = "failOnMissingArgs";
export const MCP_TOOL_CALL_ARGUMENT_PROPERTY_PREFIX = "arg.";

export interface McpToolCallNodeOption {
  readonly label: string;
  readonly value: string;
  readonly description?: string;
}

export interface IMcpToolCallNodeConfiguration {
  readonly serverOptions?: ReadonlyArray<McpToolCallNodeOption>;
  readonly toolOptions?: ReadonlyArray<McpToolCallNodeOption>;
  readonly toolDescriptor?: McpToolDescriptor;
}

export class McpToolCallNodeConfigurationService {
  public isMcpToolCallNode(node: INode): boolean {
    return node.definition.type === MCP_TOOL_CALL_NODE_TYPE;
  }

  public configureNode(
    node: INode,
    configuration: IMcpToolCallNodeConfiguration = {}
  ): INode {
    if (!this.isMcpToolCallNode(node)) {
      return node;
    }

    const existingProperties = new Map(node.properties.map((property) => [property.id, property]));
    const existingDescriptor = this.readStoredToolDescriptor(node);
    const descriptor = configuration.toolDescriptor ?? existingDescriptor;
    const baseProperties = node.definition.properties.map((property) =>
      this.configureBaseProperty(property, existingProperties, configuration, descriptor)
    );
    const dynamicProperties = descriptor
      ? descriptor.arguments.map((argument, index) =>
          this.mapArgumentToProperty(argument, index, existingProperties.get(this.argumentPropertyId(argument.name)))
        )
      : [];

    return this.replaceProperties(node, [...baseProperties, ...dynamicProperties]);
  }

  public serializeConfiguredArguments(node: INode): Readonly<Record<string, unknown>> {
    if (!this.isMcpToolCallNode(node)) {
      return Object.freeze({});
    }

    const values: Record<string, unknown> = {};

    for (const property of node.properties) {
      if (!this.isArgumentPropertyId(property.id) || property.value === undefined) {
        continue;
      }

      values[this.argumentNameFromPropertyId(property.id)] = property.value;
    }

    return Object.freeze(values);
  }

  public readStoredToolDescriptor(node: INode): McpToolDescriptor | undefined {
    const value = node.getProperty(MCP_TOOL_CALL_TOOL_DESCRIPTOR_PROPERTY)?.value;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    const record = value as Partial<McpToolDescriptor>;
    if (typeof record.serverId !== "string" || typeof record.name !== "string") {
      return undefined;
    }

    return Object.freeze({
      ...record,
      source: (record.source ?? { kind: "mcp-server", serverId: record.serverId }) as McpToolDescriptor["source"],
      inputSchema: (record.inputSchema ?? { type: "object" }) as Readonly<Record<string, unknown>>,
      arguments: Object.freeze([...(record.arguments ?? [])]) as ReadonlyArray<McpToolArgumentDescriptor>,
      categories: Object.freeze([...(record.categories ?? [])]),
      tags: Object.freeze([...(record.tags ?? [])]),
    }) as McpToolDescriptor;
  }

  public argumentPropertyId(argumentName: string): string {
    return `${MCP_TOOL_CALL_ARGUMENT_PROPERTY_PREFIX}${argumentName.trim()}`;
  }

  public isArgumentPropertyId(propertyId: string): boolean {
    return propertyId.startsWith(MCP_TOOL_CALL_ARGUMENT_PROPERTY_PREFIX);
  }

  private argumentNameFromPropertyId(propertyId: string): string {
    return propertyId.slice(MCP_TOOL_CALL_ARGUMENT_PROPERTY_PREFIX.length);
  }

  private configureBaseProperty(
    property: INodeProperty,
    existingProperties: ReadonlyMap<string, INodeProperty>,
    configuration: IMcpToolCallNodeConfiguration,
    descriptor?: McpToolDescriptor
  ): INodeProperty {
    const currentProperty = existingProperties.get(property.id);
    const currentValue = currentProperty?.value ?? property.value;

    switch (property.id) {
      case MCP_TOOL_CALL_SERVER_ID_PROPERTY:
        return this.cloneProperty(property, {
          type: "select",
          value: currentValue,
          options: this.toOptions(configuration.serverOptions),
        });

      case MCP_TOOL_CALL_TOOL_NAME_PROPERTY:
        return this.cloneProperty(property, {
          type: "select",
          value: descriptor?.name ?? currentValue,
          options: this.toOptions(configuration.toolOptions),
        });

      case MCP_TOOL_CALL_TOOL_DESCRIPTOR_PROPERTY:
        return this.cloneProperty(property, {
          type: "json",
          value: descriptor ?? currentValue,
        });

      default:
        return currentProperty ? currentProperty : property;
    }
  }

  private mapArgumentToProperty(
    argument: McpToolArgumentDescriptor,
    index: number,
    existingProperty?: INodeProperty
  ): INodeProperty {
    const propertyId = this.argumentPropertyId(argument.name);
    const { propertyType, options, constraints } = this.mapArgumentField(argument);
    const schemaDefault = this.readRecord(argument.schema).default;
    const fallbackValue =
      existingProperty?.value !== undefined
        ? existingProperty.value
        : argument.defaultValue ?? schemaDefault;

    return new NodeProperty({
      id: propertyId,
      name: argument.title?.trim() || argument.name,
      description: argument.description?.trim() || undefined,
      type: propertyType,
      value: this.normalizePropertyValue(propertyType, fallbackValue),
      defaultValue: this.normalizePropertyValue(propertyType, argument.defaultValue ?? schemaDefault),
      isAdvanced: false,
      order: 10 + index,
      constraints,
      options,
      projection: {
        label: argument.title?.trim() || argument.name,
        description: argument.description?.trim() || undefined,
        group: "Arguments",
        order: 10 + index,
        authorVisibility: "basic",
        toolVisibility: "basic",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: propertyType,
      },
    });
  }

  private mapArgumentField(argument: McpToolArgumentDescriptor): {
    readonly propertyType: NodePropertyType;
    readonly constraints?: INodePropertyConstraint;
    readonly options?: ReadonlyArray<INodePropertyOption>;
  } {
    const schema = argument.schema ?? {};
    const type = this.resolvePropertyType(argument);
    const options = argument.enumValues?.length
      ? Object.freeze(
          argument.enumValues.map((value) => ({
            label: value === null ? "null" : String(value),
            value,
          }))
        )
      : this.resolveArrayOptions(schema);

    const constraints: INodePropertyConstraint = {
      required: argument.required || undefined,
      min: typeof schema.minimum === "number" ? schema.minimum : undefined,
      max: typeof schema.maximum === "number" ? schema.maximum : undefined,
      minLength: typeof schema.minLength === "number" ? schema.minLength : undefined,
      maxLength: typeof schema.maxLength === "number" ? schema.maxLength : undefined,
      pattern: typeof schema.pattern === "string" ? schema.pattern : undefined,
      allowedValues: options?.map((option) => option.value),
    };

    return {
      propertyType: type,
      constraints: this.hasConstraint(constraints) ? Object.freeze(constraints) : undefined,
      options,
    };
  }

  private resolvePropertyType(argument: McpToolArgumentDescriptor): NodePropertyType {
    const schema = argument.schema ?? {};
    const normalizedType = typeof schema.type === "string" ? schema.type : argument.type;

    if (argument.enumValues?.length) {
      return "select";
    }

    if (normalizedType === "boolean") {
      return "boolean";
    }

    if (normalizedType === "integer") {
      return "integer";
    }

    if (normalizedType === "number") {
      return "number";
    }

    if (normalizedType === "array") {
      const itemSchema = this.readRecord(schema.items);
      return Array.isArray(itemSchema.enum) ? "multi-select" : "json";
    }

    if (normalizedType === "object") {
      return "json";
    }

    const format = typeof schema.format === "string" ? schema.format : argument.format;

    switch (format) {
      case "date":
      case "date-time":
        return "date";
      case "duration":
        return "duration";
      case "password":
        return "secret";
      case "color":
        return "color";
      default:
        return "text";
    }
  }

  private resolveArrayOptions(schema: Readonly<Record<string, unknown>>): ReadonlyArray<INodePropertyOption> | undefined {
    const itemSchema = this.readRecord(schema.items);
    if (!Array.isArray(itemSchema.enum)) {
      return undefined;
    }

    return Object.freeze(
      itemSchema.enum.map((value) => ({
        label: value === null ? "null" : String(value),
        value,
      }))
    );
  }

  private normalizePropertyValue(type: NodePropertyType, value: unknown): unknown {
    if (value === undefined) {
      return type === "multi-select" ? [] : value;
    }

    if (type === "multi-select") {
      return Array.isArray(value) ? value : [];
    }

    return value;
  }

  private cloneProperty(
    property: INodeProperty,
    overrides: {
      readonly value?: unknown;
      readonly type?: NodePropertyType;
      readonly options?: ReadonlyArray<INodePropertyOption>;
    }
  ): INodeProperty {
    return new NodeProperty({
      id: property.id,
      name: property.name,
      description: property.description,
      type: overrides.type ?? property.type,
      value: overrides.value !== undefined ? overrides.value : property.value,
      defaultValue: property.defaultValue,
      isEditable: property.isEditable,
      isPersisted: property.isPersisted,
      isAdvanced: property.isAdvanced,
      order: property.order,
      constraints: property.constraints,
      options: overrides.options ?? property.options,
      bindingProfile: property.bindingProfile,
      projection: property.projection,
    });
  }

  private replaceProperties(node: INode, properties: ReadonlyArray<INodeProperty>): INode {
    return new Node({
      id: node.id,
      definition: node.definition,
      title: node.title,
      notes: node.notes,
      position: node.position,
      size: node.size,
      properties,
      inputPorts: node.inputPorts,
      outputPorts: node.outputPorts,
      executionProfile: node.executionProfile,
      isEnabled: node.isEnabled,
      isCollapsed: node.isCollapsed,
    });
  }

  private toOptions(
    options?: ReadonlyArray<McpToolCallNodeOption>
  ): ReadonlyArray<INodePropertyOption<string>> | undefined {
    if (!options || options.length === 0) {
      return undefined;
    }

    return Object.freeze(
      options.map((option) => ({
        label: option.label,
        value: option.value,
        description: option.description,
      }))
    );
  }

  private readRecord(value: unknown): Readonly<Record<string, unknown>> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return Object.freeze({});
    }

    return value as Readonly<Record<string, unknown>>;
  }

  private hasConstraint(constraints: INodePropertyConstraint): boolean {
    return Object.values(constraints).some((value) => value !== undefined);
  }
}
