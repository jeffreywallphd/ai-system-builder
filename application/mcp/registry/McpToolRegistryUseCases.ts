import { createInstalledMcpToolRecord, type InstalledMcpToolRecord, type McpToolDefinitionSource } from "../../../domain/mcp/InstalledMcpTool";
import {
  normalizeMcpToolDefinition,
  validateMcpToolDefinition,
  type McpToolDefinition,
  type McpToolSideEffectClass,
} from "../../../domain/mcp/McpToolCapability";
import type { IMcpToolDefinitionSourceLoader } from "../../ports/interfaces/IMcpToolDefinitionSourceLoader";
import type { IMcpToolDependencyScanner } from "../../ports/interfaces/IMcpToolDependencyScanner";
import type { IMcpToolRegistryRepository } from "../../ports/interfaces/IMcpToolRegistryRepository";
import { McpToolRegistryError } from "./McpToolRegistryErrors";

export interface InstallMcpToolRequest {
  readonly source?: McpToolDefinitionSource;
  readonly definition?: McpToolDefinition;
  readonly overwrite?: boolean;
}

export interface RemoveMcpToolResult {
  readonly status: "removed" | "blocked";
  readonly toolId: string;
  readonly references: ReadonlyArray<{ readonly kind: string; readonly id: string; readonly label: string; readonly detail?: string }>;
}

export interface QueryMcpCapabilitiesRequest {
  readonly inputType?: string;
  readonly outputType?: string;
  readonly inputPath?: string;
  readonly outputPath?: string;
  readonly ioMatchMode?: "exact" | "assignable";
  readonly includeSideEffects?: boolean;
  readonly maxSideEffectClass?: McpToolSideEffectClass;
  readonly requiresAuth?: boolean;
  readonly authKinds?: ReadonlyArray<"none" | "optional" | "required">;
  readonly sideEffects?: ReadonlyArray<McpToolSideEffectClass>;
  readonly tags?: ReadonlyArray<string>;
  readonly tagMatchMode?: "all" | "any";
  readonly categories?: ReadonlyArray<string>;
  readonly categoryMatchMode?: "all" | "any";
  readonly enabledOnly?: boolean;
}

export class InstallMcpToolUseCase {
  constructor(
    private readonly repository: IMcpToolRegistryRepository,
    private readonly sourceLoader?: IMcpToolDefinitionSourceLoader,
  ) {}

  public async execute(request: InstallMcpToolRequest): Promise<InstalledMcpToolRecord> {
    const definition = await this.resolveDefinition(request);
    const validation = validateMcpToolDefinition(definition);
    if (!validation.valid) {
      throw new McpToolRegistryError("invalid-definition", "MCP tool definition is invalid.", { issues: validation.issues });
    }

    const normalizedDefinition = normalizeMcpToolDefinition(definition);
    const existing = await this.repository.getInstalledTool(normalizedDefinition.id);
    if (existing && request.overwrite !== true) {
      throw new McpToolRegistryError("duplicate-install", `MCP tool '${normalizedDefinition.id}' is already installed.`);
    }

    const record = existing
      ? Object.freeze({
          ...existing,
          definition: normalizedDefinition,
          updatedAt: new Date().toISOString(),
          source: request.source ?? existing.source,
        })
      : createInstalledMcpToolRecord({
          definition: normalizedDefinition,
          source: request.source ?? { kind: "inline", location: "inline:manual" },
        });

    return this.repository.saveInstalledTool(record);
  }

  private async resolveDefinition(request: InstallMcpToolRequest): Promise<McpToolDefinition> {
    if (request.definition) {
      return request.definition;
    }
    if (!request.source || !this.sourceLoader) {
      throw new McpToolRegistryError("invalid-definition", "Tool install requires either definition or a loadable source.");
    }
    return this.sourceLoader.load(request.source);
  }
}

export class ListInstalledMcpToolsUseCase {
  constructor(private readonly repository: IMcpToolRegistryRepository) {}

  public async execute(): Promise<ReadonlyArray<InstalledMcpToolRecord>> {
    return this.repository.listInstalledTools();
  }
}

export class GetInstalledMcpToolUseCase {
  constructor(private readonly repository: IMcpToolRegistryRepository) {}

  public async execute(toolId: string): Promise<InstalledMcpToolRecord> {
    const record = await this.repository.getInstalledTool(toolId.trim());
    if (!record) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${toolId}' was not found.`);
    }
    return record;
  }
}

export class SetMcpToolStatusUseCase {
  constructor(private readonly repository: IMcpToolRegistryRepository) {}

  public async enable(toolId: string): Promise<InstalledMcpToolRecord> {
    return this.updateStatus(toolId, "enabled");
  }

  public async disable(toolId: string): Promise<InstalledMcpToolRecord> {
    return this.updateStatus(toolId, "disabled");
  }

  private async updateStatus(toolId: string, status: InstalledMcpToolRecord["status"]): Promise<InstalledMcpToolRecord> {
    const existing = await this.repository.getInstalledTool(toolId.trim());
    if (!existing) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${toolId}' was not found.`);
    }
    if (existing.status === status) {
      return existing;
    }
    return this.repository.saveInstalledTool(
      Object.freeze({
        ...existing,
        status,
        updatedAt: new Date().toISOString(),
      }),
    );
  }
}

export class RemoveMcpToolUseCase {
  constructor(
    private readonly repository: IMcpToolRegistryRepository,
    private readonly dependencyScanner: IMcpToolDependencyScanner,
  ) {}

  public async execute(toolId: string): Promise<RemoveMcpToolResult> {
    const normalizedId = toolId.trim();
    const existing = await this.repository.getInstalledTool(normalizedId);
    if (!existing) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${toolId}' was not found.`);
    }

    const references = await this.dependencyScanner.scanToolReferences(normalizedId);
    if (references.length > 0) {
      return Object.freeze({
        status: "blocked",
        toolId: normalizedId,
        references: Object.freeze(
          references.map((reference) =>
            Object.freeze({
              kind: reference.kind,
              id: reference.id,
              label: reference.label,
              detail: reference.detail,
            }),
          ),
        ),
      });
    }

    await this.repository.removeInstalledTool(normalizedId);

    return Object.freeze({ status: "removed", toolId: normalizedId, references: Object.freeze([]) });
  }
}

export class QueryMcpToolCapabilitiesUseCase {
  constructor(private readonly repository: IMcpToolRegistryRepository) {}

  public async execute(filters: QueryMcpCapabilitiesRequest = {}): Promise<ReadonlyArray<InstalledMcpToolRecord>> {
    const tools = await this.repository.listInstalledTools();

    return Object.freeze(tools.filter((tool) => this.matches(tool, filters)));
  }

  private matches(tool: InstalledMcpToolRecord, filters: QueryMcpCapabilitiesRequest): boolean {
    if (filters.enabledOnly === true && tool.status !== "enabled") {
      return false;
    }

    if (filters.inputType && !schemaSupportsType(tool.definition.inputSchema, filters.inputType, filters.inputPath, filters.ioMatchMode)) {
      return false;
    }

    if (filters.outputType && !schemaSupportsType(tool.definition.outputSchema, filters.outputType, filters.outputPath, filters.ioMatchMode)) {
      return false;
    }

    if (filters.includeSideEffects === false && tool.definition.sideEffects !== "none") {
      return false;
    }

    if (filters.requiresAuth === true && tool.definition.auth.kind !== "required") {
      return false;
    }

    if (filters.authKinds && filters.authKinds.length > 0 && !filters.authKinds.includes(tool.definition.auth.kind)) {
      return false;
    }

    if (filters.sideEffects && filters.sideEffects.length > 0 && !filters.sideEffects.includes(tool.definition.sideEffects)) {
      return false;
    }

    if (filters.maxSideEffectClass && sideEffectSeverity(tool.definition.sideEffects) > sideEffectSeverity(filters.maxSideEffectClass)) {
      return false;
    }

    if (
      filters.tags &&
      filters.tags.length > 0 &&
      !matchStringSet(tool.definition.tags, filters.tags, filters.tagMatchMode ?? "all")
    ) {
      return false;
    }

    if (
      filters.categories &&
      filters.categories.length > 0 &&
      !matchStringSet(tool.definition.categories, filters.categories, filters.categoryMatchMode ?? "any")
    ) {
      return false;
    }

    return true;
  }
}

function schemaSupportsType(
  schema: Readonly<Record<string, unknown>> | undefined,
  type: string,
  path?: string,
  matchMode: "exact" | "assignable" = "assignable",
): boolean {
  if (!schema) {
    return false;
  }
  const targetSchema = resolveSchemaPath(schema, path);
  return schemaNodeSupportsType(targetSchema, type, matchMode);
}

function schemaNodeSupportsType(
  schema: Readonly<Record<string, unknown>> | undefined,
  expectedType: string,
  matchMode: "exact" | "assignable",
): boolean {
  if (!schema) {
    return false;
  }

  if (schemaTypeMatches(schema, expectedType, matchMode)) {
    return true;
  }

  const properties = asSchemaRecord(schema.properties);
  if (properties && Object.values(properties).some((property) => schemaNodeSupportsType(asSchemaRecord(property), expectedType, matchMode))) {
    return true;
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.some((entry) => schemaNodeSupportsType(asSchemaRecord(entry), expectedType, matchMode))) {
    return true;
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.some((entry) => schemaNodeSupportsType(asSchemaRecord(entry), expectedType, matchMode))) {
    return true;
  }

  const items = asSchemaRecord(schema.items);
  if (items && schemaNodeSupportsType(items, expectedType, matchMode)) {
    return true;
  }

  return false;
}

function resolveSchemaPath(schema: Readonly<Record<string, unknown>>, path?: string): Readonly<Record<string, unknown>> | undefined {
  if (!path?.trim()) {
    return schema;
  }

  const segments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  let current: Readonly<Record<string, unknown>> | undefined = schema;
  for (const segment of segments) {
    if (segment === "*") {
      current = asSchemaRecord(current?.items);
      continue;
    }
    current = asSchemaRecord(asSchemaRecord(current?.properties)?.[segment]);
    if (!current) {
      return undefined;
    }
  }

  return current;
}

function schemaTypeMatches(
  schema: Readonly<Record<string, unknown>>,
  expectedType: string,
  matchMode: "exact" | "assignable",
): boolean {
  const schemaType = typeof schema.type === "string" ? schema.type : undefined;
  if (!schemaType) {
    return false;
  }
  if (matchMode === "exact") {
    return schemaType === expectedType;
  }
  return schemaType === expectedType || isAssignableSchemaType(schemaType, expectedType);
}

function isAssignableSchemaType(schemaType: string, expectedType: string): boolean {
  if (expectedType === "number" && schemaType === "integer") {
    return true;
  }
  if (expectedType === "array" && schemaType === "object") {
    return false;
  }
  return false;
}

function asSchemaRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

function matchStringSet(
  haystack: ReadonlyArray<string>,
  needles: ReadonlyArray<string>,
  mode: "all" | "any",
): boolean {
  if (mode === "any") {
    return needles.some((needle) => haystack.includes(needle));
  }
  return needles.every((needle) => haystack.includes(needle));
}

function sideEffectSeverity(sideEffects: McpToolSideEffectClass): number {
  switch (sideEffects) {
    case "none":
      return 0;
    case "read":
      return 1;
    case "write":
      return 2;
    case "network":
      return 3;
    case "system":
      return 4;
    default:
      return 99;
  }
}
