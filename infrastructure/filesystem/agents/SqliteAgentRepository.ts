import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { IAgentRepository } from "../../../application/ports/interfaces/IAgentRepository";
import type { Agent } from "../../../domain/agents/Agent";

interface AgentRow {
  readonly agent_json: string;
}

const SCHEMA_VERSION = 1;
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
        created_at,
        updated_at,
        agent_json
      ) VALUES (
        @id,
        @name,
        @status,
        @createdAt,
        @updatedAt,
        @agentJson
      )
      ON CONFLICT(agent_id) DO UPDATE SET
        name = excluded.name,
        status = excluded.status,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        agent_json = excluded.agent_json
    `).run({
      id: agent.id,
      name: agent.name,
      status: agent.status,
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
    return JSON.parse(value) as Agent;
  }
}
