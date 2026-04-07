import type { InstalledMcpToolRecord } from "@domain/mcp/InstalledMcpTool";

export interface IMcpToolRegistryRepository {
  listInstalledTools(): Promise<ReadonlyArray<InstalledMcpToolRecord>>;
  getInstalledTool(toolId: string): Promise<InstalledMcpToolRecord | undefined>;
  findInstalledToolByBinding(serverId: string, toolName: string): Promise<InstalledMcpToolRecord | undefined>;
  saveInstalledTool(record: InstalledMcpToolRecord): Promise<InstalledMcpToolRecord>;
  removeInstalledTool(toolId: string): Promise<boolean>;
}

