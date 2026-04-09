import { createRequire } from "node:module";

export interface SqliteCompatRunResult {
  readonly changes: number;
}

export interface SqliteCompatStatement {
  run(...params: ReadonlyArray<unknown>): SqliteCompatRunResult;
  get(...params: ReadonlyArray<unknown>): unknown;
  all(...params: ReadonlyArray<unknown>): ReadonlyArray<unknown>;
}

export interface SqliteCompatDatabase {
  pragma(value: string): void;
  exec(sql: string): void;
  prepare(sql: string): SqliteCompatStatement;
  transaction<T>(operation: () => T): () => T;
  close(): void;
}

const require = createRequire(import.meta.url);

type BetterSqlite3Database = {
  pragma(value: string): void;
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: ReadonlyArray<unknown>): { changes: number };
    get(...params: ReadonlyArray<unknown>): unknown;
    all(...params: ReadonlyArray<unknown>): ReadonlyArray<unknown>;
  };
  transaction<T>(operation: () => T): () => T;
  close(): void;
};

export function openSqliteCompatDatabase(databasePath: string): SqliteCompatDatabase {
  try {
    const BetterSqlite3 = require("better-sqlite3") as new (path: string) => BetterSqlite3Database;
    if (BetterSqlite3) {
      return BetterSqlite3Factory(databasePath, BetterSqlite3);
    }
  } catch {
    // Continue through compatible fallbacks.
  }

  const nodeSqlite = openNodeSqliteDatabase(databasePath);
  if (nodeSqlite) {
    return nodeSqlite;
  }

  if (isBunRuntime()) {
    return openBunSqliteDatabase(databasePath);
  }

  throw new Error(
    `Unable to initialize SQLite database '${databasePath}'. Could not load 'better-sqlite3' and Bun SQLite is unavailable in Node/Electron runtime.`,
  );
}

function BetterSqlite3Factory(
  databasePath: string,
  DatabaseConstructor: new (path: string) => BetterSqlite3Database,
): SqliteCompatDatabase {
  return DatabaseConstructor ? new DatabaseConstructor(databasePath) : openBunSqliteDatabase(databasePath);
}

function openBunSqliteDatabase(databasePath: string): SqliteCompatDatabase {
  try {
    type BunSqliteModule = {
      readonly Database: new (path: string, options?: { readonly create?: boolean }) => {
        run(sql: string): { changes: number };
        exec(sql: string): void;
        query(sql: string): {
          run(...params: ReadonlyArray<unknown>): { changes?: number };
          get(...params: ReadonlyArray<unknown>): unknown;
          all(...params: ReadonlyArray<unknown>): ReadonlyArray<unknown>;
        };
        transaction<T>(operation: () => T): () => T;
        close(): void;
      };
    };
    const sqlite = require("bun:sqlite") as BunSqliteModule;
    const db = new sqlite.Database(databasePath, { create: true });
    return new BunSqliteCompatDatabase(db);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to initialize SQLite database '${databasePath}'. ${message}`);
  }
}

function isBunRuntime(): boolean {
  return typeof process !== "undefined" && typeof process.versions?.bun === "string";
}

function openNodeSqliteDatabase(databasePath: string): SqliteCompatDatabase | undefined {
  try {
    type NodeSqliteModule = {
      readonly DatabaseSync: new (path: string) => {
        exec(sql: string): void;
        prepare(sql: string): {
          run(...params: ReadonlyArray<unknown>): { changes?: number };
          get(...params: ReadonlyArray<unknown>): unknown;
          all(...params: ReadonlyArray<unknown>): ReadonlyArray<unknown>;
        };
        close(): void;
      };
    };

    const sqlite = require("node:sqlite") as NodeSqliteModule;
    const database = new sqlite.DatabaseSync(databasePath);
    return new NodeSqliteCompatDatabase(database);
  } catch {
    return undefined;
  }
}

class BunSqliteCompatDatabase implements SqliteCompatDatabase {
  constructor(
    private readonly database: {
      run(sql: string): { changes: number };
      exec(sql: string): void;
      query(sql: string): {
        run(...params: ReadonlyArray<unknown>): { changes?: number };
        get(...params: ReadonlyArray<unknown>): unknown;
        all(...params: ReadonlyArray<unknown>): ReadonlyArray<unknown>;
      };
      transaction<T>(operation: () => T): () => T;
      close(): void;
    },
  ) {}

  public pragma(value: string): void {
    this.database.exec(`PRAGMA ${value};`);
  }

  public exec(sql: string): void {
    this.database.exec(sql);
  }

  public prepare(sql: string): SqliteCompatStatement {
    const statement = this.database.query(sql);
    return {
      run: (...params: ReadonlyArray<unknown>) => {
        const result = params.length > 0 ? statement.run(...params) : statement.run();
        return Object.freeze({ changes: result.changes ?? 0 });
      },
      get: (...params: ReadonlyArray<unknown>) => (params.length > 0 ? statement.get(...params) : statement.get()),
      all: (...params: ReadonlyArray<unknown>) => (params.length > 0 ? statement.all(...params) : statement.all()),
    };
  }

  public transaction<T>(operation: () => T): () => T {
    return this.database.transaction(operation);
  }

  public close(): void {
    this.database.close();
  }
}

class NodeSqliteCompatDatabase implements SqliteCompatDatabase {
  constructor(
    private readonly database: {
      exec(sql: string): void;
      prepare(sql: string): {
        run(...params: ReadonlyArray<unknown>): { changes?: number };
        get(...params: ReadonlyArray<unknown>): unknown;
        all(...params: ReadonlyArray<unknown>): ReadonlyArray<unknown>;
      };
      close(): void;
    },
  ) {}

  public pragma(value: string): void {
    this.database.exec(`PRAGMA ${value};`);
  }

  public exec(sql: string): void {
    this.database.exec(sql);
  }

  public prepare(sql: string): SqliteCompatStatement {
    const statement = this.database.prepare(sql);
    return {
      run: (...params: ReadonlyArray<unknown>) => {
        const result = params.length > 0 ? statement.run(...params) : statement.run();
        return Object.freeze({ changes: result.changes ?? 0 });
      },
      get: (...params: ReadonlyArray<unknown>) => (params.length > 0 ? statement.get(...params) : statement.get()),
      all: (...params: ReadonlyArray<unknown>) => (params.length > 0 ? statement.all(...params) : statement.all()),
    };
  }

  public transaction<T>(operation: () => T): () => T {
    return () => {
      this.database.exec("BEGIN IMMEDIATE;");
      try {
        const result = operation();
        this.database.exec("COMMIT;");
        return result;
      } catch (error) {
        this.database.exec("ROLLBACK;");
        throw error;
      }
    };
  }

  public close(): void {
    this.database.close();
  }
}
