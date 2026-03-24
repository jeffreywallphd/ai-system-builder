import type { IMcpToolDefinitionSourceLoader } from "../../application/ports/interfaces/IMcpToolDefinitionSourceLoader";
import type { McpToolDefinitionSource } from "../../domain/mcp/InstalledMcpTool";
import type { McpToolDefinition } from "../../domain/mcp/McpToolCapability";

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
      return (await response.json()) as McpToolDefinition;
    }

    if (source.kind === "local") {
      if (!this.textLoader) {
        throw new Error("Local MCP tool definition loading requires a text loader.");
      }
      const raw = await this.textLoader.readText(location);
      return JSON.parse(raw) as McpToolDefinition;
    }

    throw new Error("Inline MCP tool definitions must be supplied directly in the install request.");
  }
}
