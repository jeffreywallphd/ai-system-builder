import type {
  IMcpToolSecretRepository,
  McpToolSecretReferenceRecord,
  ResolvedMcpToolSecretRecord,
} from "../../../application/ports/interfaces/IMcpToolSecretRepository";
import type { McpToolCredentialFieldRequirement } from "../../../domain/mcp/McpToolTrust";

interface PersistedSecretRecord {
  readonly toolId: string;
  readonly values: Readonly<Record<string, string>>;
  readonly fields: ReadonlyArray<McpToolCredentialFieldRequirement>;
  readonly updatedAt: string;
}

const defaultStorageKey = "ai-loom-studio.mcp-tool-secrets";

export class LocalStorageMcpToolSecretRepository implements IMcpToolSecretRepository {
  constructor(
    private readonly storageKey = defaultStorageKey,
    private readonly storage = typeof window !== "undefined" ? window.localStorage : undefined,
  ) {}

  public async getSecretReference(toolId: string): Promise<McpToolSecretReferenceRecord | undefined> {
    const record = await this.getPersisted(toolId);
    if (!record) {
      return undefined;
    }
    return Object.freeze({
      toolId: record.toolId,
      fields: Object.freeze(record.fields.map((field) => Object.freeze({ ...field }))),
      updatedAt: record.updatedAt,
    });
  }

  public async resolveSecret(toolId: string): Promise<ResolvedMcpToolSecretRecord | undefined> {
    const record = await this.getPersisted(toolId);
    if (!record) {
      return undefined;
    }
    return Object.freeze({
      toolId: record.toolId,
      values: Object.freeze({ ...record.values }),
      updatedAt: record.updatedAt,
    });
  }

  public async upsertSecret(
    toolId: string,
    values: Readonly<Record<string, string>>,
    fields: ReadonlyArray<McpToolCredentialFieldRequirement>,
  ): Promise<McpToolSecretReferenceRecord> {
    const normalizedId = toolId.trim();
    const all = await this.listPersisted();
    const now = new Date().toISOString();
    const nextRecord: PersistedSecretRecord = Object.freeze({
      toolId: normalizedId,
      values: Object.freeze(Object.fromEntries(Object.entries(values).map(([key, value]) => [key.trim(), value]))),
      fields: Object.freeze(fields.map((field) => Object.freeze({ ...field }))),
      updatedAt: now,
    });
    const next = Object.freeze([...all.filter((record) => record.toolId !== normalizedId), nextRecord]);
    this.storage?.setItem(this.storageKey, JSON.stringify(next));
    return Object.freeze({ toolId: normalizedId, fields: nextRecord.fields, updatedAt: now });
  }

  public async removeSecret(toolId: string): Promise<boolean> {
    const normalizedId = toolId.trim();
    const all = await this.listPersisted();
    const next = all.filter((record) => record.toolId !== normalizedId);
    if (next.length === all.length) {
      return false;
    }
    this.storage?.setItem(this.storageKey, JSON.stringify(next));
    return true;
  }

  private async getPersisted(toolId: string): Promise<PersistedSecretRecord | undefined> {
    const normalizedId = toolId.trim();
    const all = await this.listPersisted();
    return all.find((record) => record.toolId === normalizedId);
  }

  private async listPersisted(): Promise<ReadonlyArray<PersistedSecretRecord>> {
    const raw = this.storage?.getItem(this.storageKey);
    if (!raw) {
      return Object.freeze([]);
    }
    try {
      const parsed = JSON.parse(raw) as ReadonlyArray<PersistedSecretRecord>;
      return Object.freeze(parsed.map((record) => Object.freeze({ ...record })));
    } catch {
      return Object.freeze([]);
    }
  }
}
