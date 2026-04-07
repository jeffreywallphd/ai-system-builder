import type { IMcpToolDefinitionSourceLoader } from "@application/ports/interfaces/IMcpToolDefinitionSourceLoader";
import type { McpToolDefinitionSource } from "@domain/mcp/InstalledMcpTool";
import type { McpToolDefinition } from "@domain/mcp/McpToolCapability";

export interface ITextLoader {
  readText(path: string): Promise<string>;
}

export class DefaultMcpToolDefinitionSourceLoader implements IMcpToolDefinitionSourceLoader {
  constructor(private readonly textLoader?: ITextLoader) {}

  public async load(source: McpToolDefinitionSource): Promise<McpToolDefinition> {
    const location = source.location.trim();
    if (!location) {
      throw new Error("MCP tool source location cannot be empty.");
    }

    if (source.kind === "remote") {
      const response = await fetch(location);
      if (!response.ok) {
        throw new Error(`Unable to load MCP tool definition from '${location}'.`);
      }
      return coerceToolDefinition(await response.json(), location);
    }

    if (source.kind === "local") {
      if (!this.textLoader) {
        throw new Error("Local MCP tool definition loading requires a text loader.");
      }
      const raw = await this.textLoader.readText(location);
      return coerceToolDefinition(JSON.parse(raw) as unknown, location);
    }

    throw new Error("Inline MCP tool definitions must be supplied directly in the install request.");
  }
}

function coerceToolDefinition(payload: unknown, sourceLocation: string): McpToolDefinition {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`MCP tool source '${sourceLocation}' did not contain an object payload.`);
  }

  const candidate = payload as Record<string, unknown>;
  const shareableFormat = candidate.format;
  if (shareableFormat === "ai-loom.mcp-tool-definitions.v1") {
    const tools = candidate.tools;
    if (!Array.isArray(tools) || tools.length === 0) {
      throw new Error(`MCP tool source '${sourceLocation}' did not include any shareable tool definitions.`);
    }
    const firstDefinition = (tools[0] as { definition?: McpToolDefinition } | undefined)?.definition;
    if (!firstDefinition || typeof firstDefinition !== "object") {
      throw new Error(`MCP tool source '${sourceLocation}' included an invalid shareable tool definition payload.`);
    }
    return firstDefinition;
  }

  return candidate as unknown as McpToolDefinition;
}

