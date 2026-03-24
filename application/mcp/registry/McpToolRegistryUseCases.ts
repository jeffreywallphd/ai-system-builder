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
  readonly includeSideEffects?: boolean;
  readonly requiresAuth?: boolean;
  readonly sideEffects?: ReadonlyArray<McpToolSideEffectClass>;
  readonly tags?: ReadonlyArray<string>;
  readonly categories?: ReadonlyArray<string>;
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
      throw new McpToolRegistryError("unsafe-removal", `Cannot remove MCP tool '${normalizedId}' because it is in use.`, {
        toolId: normalizedId,
        references,
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

    if (filters.inputType && !schemaSupportsType(tool.definition.inputSchema, filters.inputType)) {
      return false;
    }

    if (filters.outputType && !schemaSupportsType(tool.definition.outputSchema, filters.outputType)) {
      return false;
    }

    if (filters.includeSideEffects === false && tool.definition.sideEffects !== "none") {
      return false;
    }

    if (filters.requiresAuth === true && tool.definition.auth.kind !== "required") {
      return false;
    }

    if (filters.sideEffects && filters.sideEffects.length > 0 && !filters.sideEffects.includes(tool.definition.sideEffects)) {
      return false;
    }

    if (filters.tags && filters.tags.length > 0 && !filters.tags.every((tag) => tool.definition.tags.includes(tag))) {
      return false;
    }

    if (
      filters.categories &&
      filters.categories.length > 0 &&
      !filters.categories.some((category) => tool.definition.categories.includes(category))
    ) {
      return false;
    }

    return true;
  }
}

function schemaSupportsType(schema: Readonly<Record<string, unknown>> | undefined, type: string): boolean {
  if (!schema) {
    return false;
  }
  if (schema.type === type) {
    return true;
  }

  const properties = schema.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return false;
  }

  return Object.values(properties).some((property) => {
    if (!property || typeof property !== "object" || Array.isArray(property)) {
      return false;
    }
    return (property as Record<string, unknown>).type === type;
  });
}
