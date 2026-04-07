import type {
  IMcpToolSecretRepository,
  McpToolSecretReferenceRecord,
  McpToolSecretScope,
  McpToolSecretScopeType,
  ResolvedMcpToolSecretRecord,
} from "@application/ports/interfaces/IMcpToolSecretRepository";
import type { McpToolCredentialFieldRequirement } from "@domain/mcp/McpToolTrust";

interface PersistedSecretEnvelope {
  readonly version: 2;
  readonly toolId: string;
  readonly scopeType: McpToolSecretScopeType;
  readonly scopeId?: string;
  readonly fields: ReadonlyArray<McpToolCredentialFieldRequirement>;
  readonly updatedAt: string;
  readonly storageProvider: "desktop-keychain" | "encrypted-local";
  readonly cipherText: string;
}

interface LegacyPersistedSecretRecord {
  readonly toolId: string;
  readonly values: Readonly<Record<string, string>>;
  readonly fields: ReadonlyArray<McpToolCredentialFieldRequirement>;
  readonly updatedAt: string;
}

interface SecretPayload {
  readonly values: Readonly<Record<string, string>>;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

interface DesktopMcpSecretBridge {
  isAvailable(): boolean;
  getSecret(key: string): string | null;
  setSecret(key: string, value: string): void;
  removeSecret(key: string): void;
}

const defaultStorageKey = "ai-loom-studio.mcp-tool-secrets.v2";
const legacyStorageKey = "ai-loom-studio.mcp-tool-secrets";
const fallbackEncryptionKey = "ai-loom-studio.mcp-tool-secrets.master-key";

export class LocalStorageMcpToolSecretRepository implements IMcpToolSecretRepository {
  constructor(
    private readonly storageKey = defaultStorageKey,
    private readonly storage: StorageLike | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
    private readonly desktopSecretBridge: DesktopMcpSecretBridge | undefined = resolveDesktopSecretBridge(),
  ) {}

  public async getSecretReference(toolId: string, scope?: McpToolSecretScope): Promise<McpToolSecretReferenceRecord | undefined> {
    const record = await this.getPersisted(toolId, scope);
    if (!record) {
      return undefined;
    }
    return Object.freeze({
      toolId: record.toolId,
      scopeType: record.scopeType,
      scopeId: record.scopeId,
      fields: Object.freeze(record.fields.map((field) => Object.freeze({ ...field }))),
      updatedAt: record.updatedAt,
    });
  }

  public async resolveSecret(toolId: string, scope?: McpToolSecretScope): Promise<ResolvedMcpToolSecretRecord | undefined> {
    const record = await this.getPersisted(toolId, scope);
    if (!record) {
      return undefined;
    }
    const payload = await this.decryptPayload(record);
    return Object.freeze({
      toolId: record.toolId,
      scopeType: record.scopeType,
      scopeId: record.scopeId,
      values: Object.freeze({ ...payload.values }),
      updatedAt: record.updatedAt,
    });
  }

  public async upsertSecret(
    toolId: string,
    values: Readonly<Record<string, string>>,
    fields: ReadonlyArray<McpToolCredentialFieldRequirement>,
    scope?: McpToolSecretScope,
  ): Promise<McpToolSecretReferenceRecord> {
    const normalizedScope = normalizeScope(scope);
    const normalizedId = toolId.trim();
    const all = await this.listPersisted();
    const now = new Date().toISOString();
    const sanitizedValues = Object.freeze(Object.fromEntries(
      Object.entries(values)
        .map(([key, value]) => [key.trim(), value])
        .filter(([key]) => key.trim().length > 0),
    ));
    const cipherText = await this.encryptPayload({ values: sanitizedValues });
    const provider = this.desktopSecretBridge?.isAvailable() ? "desktop-keychain" : "encrypted-local";
    const nextRecord: PersistedSecretEnvelope = Object.freeze({
      version: 2,
      toolId: normalizedId,
      scopeType: normalizedScope.scopeType,
      scopeId: normalizedScope.scopeId,
      fields: Object.freeze(fields.map((field) => Object.freeze({ ...field }))),
      updatedAt: now,
      storageProvider: provider,
      cipherText,
    });
    const next = Object.freeze([
      ...all.filter((record) => !matchesScope(record, normalizedId, normalizedScope)),
      nextRecord,
    ]);
    this.storage?.setItem(this.storageKey, JSON.stringify(next));
    return Object.freeze({
      toolId: normalizedId,
      scopeType: normalizedScope.scopeType,
      scopeId: normalizedScope.scopeId,
      fields: nextRecord.fields,
      updatedAt: now,
    });
  }

  public async removeSecret(toolId: string, scope?: McpToolSecretScope): Promise<boolean> {
    const normalizedScope = normalizeScope(scope);
    const normalizedId = toolId.trim();
    const all = await this.listPersisted();
    const target = all.find((record) => matchesScope(record, normalizedId, normalizedScope));
    if (!target) {
      return false;
    }
    const next = all.filter((record) => record !== target);
    this.storage?.setItem(this.storageKey, JSON.stringify(next));
    if (target.storageProvider === "desktop-keychain") {
      this.desktopSecretBridge?.removeSecret(buildSecretStorageKey(target.toolId, normalizedScope));
    }
    return true;
  }

  private async getPersisted(toolId: string, scope?: McpToolSecretScope): Promise<PersistedSecretEnvelope | undefined> {
    const normalizedId = toolId.trim();
    const normalizedScope = normalizeScope(scope);
    const all = await this.listPersisted();
    return all.find((record) => matchesScope(record, normalizedId, normalizedScope));
  }

  private async listPersisted(): Promise<ReadonlyArray<PersistedSecretEnvelope>> {
    await this.migrateLegacySecretsIfNeeded();
    const raw = this.storage?.getItem(this.storageKey);
    if (!raw) {
      return Object.freeze([]);
    }
    try {
      const parsed = JSON.parse(raw) as ReadonlyArray<PersistedSecretEnvelope>;
      return Object.freeze(parsed.map((record) => Object.freeze({ ...record })));
    } catch {
      return Object.freeze([]);
    }
  }

  private async migrateLegacySecretsIfNeeded(): Promise<void> {
    const existing = this.storage?.getItem(this.storageKey);
    if (existing) {
      return;
    }
    const legacyRaw = this.storage?.getItem(legacyStorageKey);
    if (!legacyRaw) {
      return;
    }
    try {
      const legacyRecords = JSON.parse(legacyRaw) as ReadonlyArray<LegacyPersistedSecretRecord>;
      const migrated: PersistedSecretEnvelope[] = [];
      for (const legacy of legacyRecords) {
        const scope = normalizeScope();
        migrated.push(Object.freeze({
          version: 2,
          toolId: legacy.toolId.trim(),
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          fields: Object.freeze((legacy.fields ?? []).map((field) => Object.freeze({ ...field }))),
          updatedAt: legacy.updatedAt ?? new Date().toISOString(),
          storageProvider: this.desktopSecretBridge?.isAvailable() ? "desktop-keychain" : "encrypted-local",
          cipherText: await this.encryptPayload({ values: legacy.values ?? {} }, legacy.toolId.trim(), scope),
        }));
      }
      this.storage?.setItem(this.storageKey, JSON.stringify(Object.freeze(migrated)));
      this.storage?.removeItem?.(legacyStorageKey);
    } catch {
      // keep best-effort migration semantics to avoid fatal startup failures.
    }
  }

  private async encryptPayload(payload: SecretPayload, toolId = "", scope = normalizeScope()): Promise<string> {
    const serialized = JSON.stringify(payload);
    if (this.desktopSecretBridge?.isAvailable()) {
      const storageKey = buildSecretStorageKey(toolId, scope);
      this.desktopSecretBridge.setSecret(storageKey, serialized);
      return `desktop-keychain:${storageKey}`;
    }
    const key = resolveFallbackEncryptionKey(this.storage);
    const encoded = xorEncode(serialized, key);
    return `encrypted-local:${encoded}`;
  }

  private async decryptPayload(record: PersistedSecretEnvelope): Promise<SecretPayload> {
    if (record.storageProvider === "desktop-keychain") {
      const storageKey = record.cipherText.startsWith("desktop-keychain:")
        ? record.cipherText.slice("desktop-keychain:".length)
        : buildSecretStorageKey(record.toolId, { scopeType: record.scopeType, scopeId: record.scopeId });
      const raw = this.desktopSecretBridge?.getSecret(storageKey);
      if (!raw) {
        throw new Error("MCP credential resolution failed for secure desktop storage.");
      }
      return JSON.parse(raw) as SecretPayload;
    }

    const encrypted = record.cipherText.replace(/^encrypted-local:/, "");
    const key = resolveFallbackEncryptionKey(this.storage);
    const serialized = xorDecode(encrypted, key);
    return JSON.parse(serialized) as SecretPayload;
  }
}

function resolveFallbackEncryptionKey(storage: StorageLike | undefined): string {
  const existing = storage?.getItem(fallbackEncryptionKey);
  if (existing) {
    return existing;
  }
  const generated = generatePseudoRandomKey();
  storage?.setItem(fallbackEncryptionKey, generated);
  return generated;
}

function generatePseudoRandomKey(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "";
  for (let index = 0; index < 64; index += 1) {
    const random = Math.floor(Math.random() * alphabet.length);
    key += alphabet[random];
  }
  return key;
}

function xorEncode(input: string, key: string): string {
  const inputBytes = Array.from(input).map((character) => character.charCodeAt(0));
  const keyBytes = Array.from(key).map((character) => character.charCodeAt(0));
  const output = inputBytes.map((value, index) => value ^ keyBytes[index % keyBytes.length]);
  return btoa(String.fromCharCode(...output));
}

function xorDecode(input: string, key: string): string {
  const encoded = atob(input);
  const inputBytes = Array.from(encoded).map((character) => character.charCodeAt(0));
  const keyBytes = Array.from(key).map((character) => character.charCodeAt(0));
  const output = inputBytes.map((value, index) => value ^ keyBytes[index % keyBytes.length]);
  return String.fromCharCode(...output);
}

function normalizeScope(scope?: McpToolSecretScope): McpToolSecretScope {
  if (!scope || scope.scopeType === "global") {
    return Object.freeze({ scopeType: "global" });
  }
  return Object.freeze({ scopeType: scope.scopeType, scopeId: scope.scopeId?.trim() });
}

function matchesScope(record: PersistedSecretEnvelope, toolId: string, scope: McpToolSecretScope): boolean {
  return record.toolId === toolId
    && record.scopeType === scope.scopeType
    && (record.scopeId ?? undefined) === (scope.scopeId ?? undefined);
}

function buildSecretStorageKey(toolId: string, scope: McpToolSecretScope): string {
  const normalizedScope = normalizeScope(scope);
  const scopeId = normalizedScope.scopeId ? `:${normalizedScope.scopeId}` : "";
  return `mcp-secret:${normalizedScope.scopeType}${scopeId}:${toolId}`;
}

function resolveDesktopSecretBridge(): DesktopMcpSecretBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.aiLoomDesktop?.secrets;
}

