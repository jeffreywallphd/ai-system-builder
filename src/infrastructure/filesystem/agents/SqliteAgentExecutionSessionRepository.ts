import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  AgentExecutionSessionTransitionRecord,
  IAgentExecutionSessionRepository,
} from "../../../application/ports/interfaces/IAgentExecutionSessionRepository";
import type { AgentExecutionSession, AgentExecutionSessionStatus } from "../../../domain/agents/AgentExecutionSession";

interface SessionRow {
  readonly session_json: string;
}

interface TransitionRow {
  readonly status: AgentExecutionSessionStatus;
  readonly recorded_at: string;
}

const SCHEMA_VERSION = 2;
const MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE agent_execution_session_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE agent_execution_sessions (
      session_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      plan_id TEXT,
      status TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      updated_at TEXT NOT NULL,
      session_json TEXT NOT NULL
    );
    CREATE INDEX agent_execution_sessions_agent_idx ON agent_execution_sessions(agent_id, start_time DESC);
    CREATE INDEX agent_execution_sessions_status_idx ON agent_execution_sessions(status, updated_at DESC);
    CREATE TABLE agent_execution_session_transitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      status TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES agent_execution_sessions(session_id) ON DELETE CASCADE
    );
    CREATE INDEX agent_execution_session_transitions_idx ON agent_execution_session_transitions(session_id, id ASC);
  `],
  [2, `
    ALTER TABLE agent_execution_sessions ADD COLUMN terminal_reason TEXT;
    ALTER TABLE agent_execution_sessions ADD COLUMN had_partial_progress INTEGER;
    ALTER TABLE agent_execution_sessions ADD COLUMN completed_step_count INTEGER;
    ALTER TABLE agent_execution_sessions ADD COLUMN attempted_step_count INTEGER;
    ALTER TABLE agent_execution_sessions ADD COLUMN step_outcome_count INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS agent_execution_sessions_terminal_idx
      ON agent_execution_sessions(status, terminal_reason, updated_at DESC);
  `],
]);

export class SqliteAgentExecutionSessionRepository implements IAgentExecutionSessionRepository {
  private database?: Database.Database;
  private initialized = false;

  constructor(private readonly databasePath: string) {}

  public async save(session: AgentExecutionSession): Promise<AgentExecutionSession> {
    const db = this.getDatabase();
    const previous = db.prepare("SELECT session_json FROM agent_execution_sessions WHERE session_id = ?")
      .get(session.id) as SessionRow | undefined;
    const previousStatus = previous ? this.parseSession(previous.session_json).status : undefined;
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO agent_execution_sessions (
        session_id,
        agent_id,
        plan_id,
        status,
        start_time,
      end_time,
      terminal_reason,
      had_partial_progress,
      completed_step_count,
      attempted_step_count,
      step_outcome_count,
      updated_at,
      session_json
    ) VALUES (
        @sessionId,
        @agentId,
        @planId,
        @status,
        @startTime,
      @endTime,
      @terminalReason,
      @hadPartialProgress,
      @completedStepCount,
      @attemptedStepCount,
      @stepOutcomeCount,
      @updatedAt,
      @sessionJson
    )
      ON CONFLICT(session_id) DO UPDATE SET
        agent_id = excluded.agent_id,
        plan_id = excluded.plan_id,
        status = excluded.status,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        terminal_reason = excluded.terminal_reason,
        had_partial_progress = excluded.had_partial_progress,
        completed_step_count = excluded.completed_step_count,
        attempted_step_count = excluded.attempted_step_count,
        step_outcome_count = excluded.step_outcome_count,
        updated_at = excluded.updated_at,
        session_json = excluded.session_json
    `).run({
      sessionId: session.id,
      agentId: session.agentId,
      planId: session.executionPlan?.planId ?? null,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime ?? null,
      terminalReason: session.terminalState?.reason ?? null,
      hadPartialProgress: session.terminalState ? (session.terminalState.hadPartialProgress ? 1 : 0) : null,
      completedStepCount: session.terminalState?.completedStepCount ?? null,
      attemptedStepCount: session.terminalState?.attemptedStepCount ?? null,
      stepOutcomeCount: session.stepOutcomes.length,
      updatedAt: nowIso,
      sessionJson: JSON.stringify(session),
    });

    if (!previousStatus || previousStatus !== session.status) {
      db.prepare(`
        INSERT INTO agent_execution_session_transitions (session_id, status, recorded_at)
        VALUES (?, ?, ?)
      `).run(session.id, session.status, nowIso);
    }

    return session;
  }

  public async getById(sessionId: string): Promise<AgentExecutionSession | undefined> {
    const normalized = sessionId.trim();
    if (!normalized) {
      return undefined;
    }
    const row = this.getDatabase()
      .prepare("SELECT session_json FROM agent_execution_sessions WHERE session_id = ?")
      .get(normalized) as SessionRow | undefined;
    return row ? this.parseSession(row.session_json) : undefined;
  }

  public async listByAgentId(agentId: string): Promise<ReadonlyArray<AgentExecutionSession>> {
    const normalized = agentId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }
    const rows = this.getDatabase()
      .prepare("SELECT session_json FROM agent_execution_sessions WHERE agent_id = ? ORDER BY start_time DESC")
      .all(normalized) as SessionRow[];
    return Object.freeze(rows.map((row) => this.parseSession(row.session_json)));
  }

  public async listTransitionHistory(sessionId: string): Promise<ReadonlyArray<AgentExecutionSessionTransitionRecord>> {
    const normalized = sessionId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }
    const rows = this.getDatabase()
      .prepare("SELECT status, recorded_at FROM agent_execution_session_transitions WHERE session_id = ? ORDER BY id ASC")
      .all(normalized) as TransitionRow[];
    return Object.freeze(rows.map((row) => Object.freeze({ status: row.status, recordedAt: row.recorded_at })));
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
      this.database.pragma("foreign_keys = ON");
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
        `Agent execution session schema version ${currentVersion} is newer than supported schema version ${SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }
      const migration = db.transaction(() => {
        db.exec(sql);
        db.prepare("INSERT INTO agent_execution_session_migrations (version, applied_at) VALUES (?, ?)").run(version, new Date().toISOString());
      });
      migration();
    }
  }

  private getSchemaVersion(db: Database.Database): number {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_execution_session_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const row = db.prepare("SELECT MAX(version) AS version FROM agent_execution_session_migrations").get() as { version?: number } | undefined;
    return typeof row?.version === "number" ? row.version : 0;
  }

  private parseSession(value: string): AgentExecutionSession {
    return JSON.parse(value) as AgentExecutionSession;
  }
}
