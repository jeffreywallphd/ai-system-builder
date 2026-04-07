import type { IMcpToolRegistryRepository } from "@application/ports/interfaces/IMcpToolRegistryRepository";
import type { InstalledMcpToolRecord } from "@domain/mcp/InstalledMcpTool";

const defaultStorageKey = "ai-loom-studio.mcp-installed-tools";

export class LocalStorageMcpToolRegistryRepository implements IMcpToolRegistryRepository {
  constructor(
    private readonly storageKey = defaultStorageKey,
    private readonly storage = typeof window !== "undefined" ? window.localStorage : undefined,
  ) {}

  public async listInstalledTools(): Promise<ReadonlyArray<InstalledMcpToolRecord>> {
    const raw = this.storage?.getItem(this.storageKey);
    if (!raw) {
      return Object.freeze([]);
    }

    try {
      const parsed = JSON.parse(raw) as ReadonlyArray<InstalledMcpToolRecord>;
      return Object.freeze(parsed.map((record) => deepCloneRecord(record)));
    } catch {
      return Object.freeze([]);
    }
  }

  public async getInstalledTool(toolId: string): Promise<InstalledMcpToolRecord | undefined> {
    const tools = await this.listInstalledTools();
    return tools.find((tool) => tool.toolId === toolId.trim());
  }

  public async findInstalledToolByBinding(serverId: string, toolName: string): Promise<InstalledMcpToolRecord | undefined> {
    const normalizedServerId = serverId.trim();
    const normalizedToolName = toolName.trim();
    const tools = await this.listInstalledTools();
    return tools.find(
      (tool) =>
        tool.definition.binding?.serverId === normalizedServerId && tool.definition.binding?.toolName === normalizedToolName,
    );
  }

  public async saveInstalledTool(record: InstalledMcpToolRecord): Promise<InstalledMcpToolRecord> {
    const current = await this.listInstalledTools();
    const next = Object.freeze([...current.filter((candidate) => candidate.toolId !== record.toolId), deepCloneRecord(record)]);
    this.storage?.setItem(this.storageKey, JSON.stringify(next));
    return record;
  }

  public async removeInstalledTool(toolId: string): Promise<boolean> {
    const normalizedId = toolId.trim();
    const current = await this.listInstalledTools();
    const next = current.filter((candidate) => candidate.toolId !== normalizedId);
    if (next.length === current.length) {
      return false;
    }
    this.storage?.setItem(this.storageKey, JSON.stringify(next));
    return true;
  }
}

function deepCloneRecord(record: InstalledMcpToolRecord): InstalledMcpToolRecord {
  return Object.freeze(JSON.parse(JSON.stringify(record)) as InstalledMcpToolRecord);
}

