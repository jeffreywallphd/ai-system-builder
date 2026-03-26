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
    return BetterSqlite3 ? BetterSqlite3Factory(databasePath, BetterSqlite3) : openBunSqliteDatabase(databasePath);
  } catch {
    return openBunSqliteDatabase(databasePath);
  }
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
