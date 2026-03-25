import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { IAgentRepository } from "../../../application/ports/interfaces/IAgentRepository";
import { createAgent, type Agent } from "../../../domain/agents/Agent";
import { AssetId } from "../../../domain/assets/AssetId";

interface AgentRow {
  readonly agent_json: string;
}

interface PersistedAgentSnapshot {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly goals: unknown;
  readonly policy: unknown;
  readonly planningStrategy: unknown;
  readonly memory: unknown;
  readonly execution: unknown;
  readonly status: unknown;
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
}

const SCHEMA_VERSION = 2;
const MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS agent_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agents (
      agent_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      agent_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agents_status_updated_idx ON agents(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS agents_updated_idx ON agents(updated_at DESC);
  `],
  [2, `
    ALTER TABLE agents ADD COLUMN strategy_id TEXT;
    ALTER TABLE agents ADD COLUMN strategy_mode TEXT;
    ALTER TABLE agents ADD COLUMN goal_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE agents ADD COLUMN allowed_tool_count INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS agents_strategy_idx ON agents(strategy_mode, updated_at DESC);
  `],
]);

export class SqliteAgentRepository implements IAgentRepository {
  private database?: Database.Database;
  private initialized = false;

  constructor(private readonly databasePath: string) {}

  public async save(agent: Agent): Promise<Agent> {
    const db = this.getDatabase();
    db.prepare(`
      INSERT INTO agents (
        agent_id,
        name,
        status,
        strategy_id,
        strategy_mode,
        goal_count,
        allowed_tool_count,
        created_at,
        updated_at,
        agent_json
      ) VALUES (
        @id,
        @name,
        @status,
        @strategyId,
        @strategyMode,
        @goalCount,
        @allowedToolCount,
        @createdAt,
        @updatedAt,
        @agentJson
      )
      ON CONFLICT(agent_id) DO UPDATE SET
        name = excluded.name,
        status = excluded.status,
        strategy_id = excluded.strategy_id,
        strategy_mode = excluded.strategy_mode,
        goal_count = excluded.goal_count,
        allowed_tool_count = excluded.allowed_tool_count,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        agent_json = excluded.agent_json
    `).run({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      strategyId: agent.planningStrategy.strategyId,
      strategyMode: agent.planningStrategy.mode,
      goalCount: agent.goals.length,
      allowedToolCount: agent.policy.toolAccess.allowedToolIds.length,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      agentJson: JSON.stringify(agent),
    });

    return agent;
  }

  public async get(id: string): Promise<Agent | undefined> {
    const normalized = id.trim();
    if (!normalized) {
      return undefined;
    }
    const row = this.getDatabase()
      .prepare("SELECT agent_json FROM agents WHERE agent_id = ?")
      .get(normalized) as AgentRow | undefined;
    return row ? this.parse(row.agent_json) : undefined;
  }

  public async list(): Promise<ReadonlyArray<Agent>> {
    const rows = this.getDatabase()
      .prepare("SELECT agent_json FROM agents ORDER BY updated_at DESC")
      .all() as AgentRow[];
    return Object.freeze(rows.map((row) => this.parse(row.agent_json)));
  }

  public async delete(id: string): Promise<boolean> {
    const normalized = id.trim();
    if (!normalized) {
      return false;
    }
    const result = this.getDatabase()
      .prepare("DELETE FROM agents WHERE agent_id = ?")
      .run(normalized);
    return result.changes > 0;
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private getDatabase(): Database.Database {
    if (!this.database) {
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
      this.database = new Database(this.databasePath);
      this.database.pragma("journal_mode = WAL");
    }
    if (!this.initialized) {
      this.initialize(this.database);
      this.initialized = true;
    }
    return this.database;
  }

  private initialize(db: Database.Database): void {
    const currentVersion = this.getSchemaVersion(db);
    if (currentVersion > SCHEMA_VERSION) {
      throw new Error(
        `Agent repository schema version ${currentVersion} is newer than supported schema version ${SCHEMA_VERSION}.`,
      );
    }
    for (const [version, migrationSql] of MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }
      db.transaction(() => {
        db.exec(migrationSql);
        db.prepare("INSERT INTO agent_repository_migrations (version, applied_at) VALUES (?, ?)")
          .run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(db: Database.Database): number {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const row = db.prepare("SELECT MAX(version) AS version FROM agent_repository_migrations")
      .get() as { version?: number } | undefined;
    return typeof row?.version === "number" ? row.version : 0;
  }

  private parse(value: string): Agent {
    const snapshot = JSON.parse(value) as PersistedAgentSnapshot;
    const createdAt = normalizeIsoTimestamp(snapshot.createdAt, "Agent createdAt");
    const updatedAt = normalizeIsoTimestamp(snapshot.updatedAt, "Agent updatedAt");
    const normalizedMemory = normalizePersistedMemory(snapshot.memory);
    const rehydrated = createAgent({
      id: assertString(snapshot.id, "Agent id"),
      name: assertString(snapshot.name, "Agent name"),
      description: typeof snapshot.description === "string" ? snapshot.description : undefined,
      goals: asReadonlyArray(snapshot.goals, "Agent goals") as Agent["goals"],
      policy: snapshot.policy as Agent["policy"],
      planningStrategy: snapshot.planningStrategy as Agent["planningStrategy"],
      memory: normalizedMemory,
      execution: snapshot.execution as Agent["execution"],
      status: snapshot.status as Agent["status"],
      now: new Date(createdAt),
    });

    return Object.freeze({
      ...rehydrated,
      createdAt,
      updatedAt,
    });
  }
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} is missing from persisted agent snapshot.`);
  }
  return value;
}

function normalizeIsoTimestamp(value: unknown, label: string): string {
  const normalized = assertString(value, label);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} '${normalized}' is invalid.`);
  }
  return normalized;
}

function asReadonlyArray(value: unknown, label: string): ReadonlyArray<unknown> {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is missing from persisted agent snapshot.`);
  }
  return value;
}

function normalizePersistedMemory(value: unknown): Agent["memory"] {
  if (!value || typeof value !== "object") {
    throw new Error("Agent memory is missing from persisted agent snapshot.");
  }

  const memory = value as {
    readonly agentId?: unknown;
    readonly assets?: unknown;
    readonly retrieval?: unknown;
    readonly policy?: unknown;
    readonly revision?: unknown;
  };

  return Object.freeze({
    agentId: assertString(memory.agentId, "Agent memory agentId"),
    assets: Object.freeze(asReadonlyArray(memory.assets, "Agent memory assets").map((entry) => {
      if (!entry || typeof entry !== "object") {
        throw new Error("Persisted agent memory asset reference is malformed.");
      }
      const snapshot = entry as {
        readonly assetId?: unknown;
        readonly assetVersionId?: unknown;
        readonly memoryType?: unknown;
        readonly lineageTag?: unknown;
      };
      const rawAssetId = resolvePersistedAssetId(snapshot.assetId);
      return Object.freeze({
        assetId: AssetId.from(rawAssetId),
        assetVersionId: typeof snapshot.assetVersionId === "string" ? snapshot.assetVersionId : undefined,
        memoryType: assertString(snapshot.memoryType, "Agent memory asset memoryType") as Agent["memory"]["assets"][number]["memoryType"],
        lineageTag: typeof snapshot.lineageTag === "string" ? snapshot.lineageTag : undefined,
      });
    })),
    retrieval: memory.retrieval as Agent["memory"]["retrieval"],
    policy: memory.policy as Agent["memory"]["policy"],
    revision: memory.revision as Agent["memory"]["revision"],
  });
}

function resolvePersistedAssetId(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "value" in value) {
    const normalized = (value as { readonly value?: unknown }).value;
    if (typeof normalized === "string") {
      return normalized;
    }
  }
  throw new Error("Persisted agent memory assetId is malformed.");
}
