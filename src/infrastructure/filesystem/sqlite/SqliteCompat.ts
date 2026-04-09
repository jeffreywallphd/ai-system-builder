import { createRequire } from "node:module";
import path from "node:path";

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
type ModuleRequire = (id: string) => unknown;

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

export function openSqliteCompatDatabase(
  databasePath: string,
  moduleRequire: ModuleRequire = require,
): SqliteCompatDatabase {
  const betterSqlite3Resolution = resolveBetterSqlite3ForRuntime(moduleRequire);
  if (betterSqlite3Resolution.constructor) {
    return BetterSqlite3Factory(databasePath, betterSqlite3Resolution.constructor);
  }

  const nodeSqlite = openNodeSqliteDatabase(databasePath, moduleRequire);
  if (nodeSqlite) {
    return nodeSqlite;
  }

  if (isBunRuntime()) {
    return openBunSqliteDatabase(databasePath, moduleRequire);
  }

  throw new Error(
    `Unable to initialize SQLite database '${databasePath}'. Could not load 'better-sqlite3' and Bun SQLite is unavailable in Node/Electron runtime. ${betterSqlite3Resolution.diagnostics.join(" ")}`,
  );
}

function BetterSqlite3Factory(
  databasePath: string,
  DatabaseConstructor: new (path: string) => BetterSqlite3Database,
): SqliteCompatDatabase {
  return DatabaseConstructor ? new DatabaseConstructor(databasePath) : openBunSqliteDatabase(databasePath);
}

function resolveBetterSqlite3Constructor(
  moduleExport: unknown,
): (new (path: string) => BetterSqlite3Database) | undefined {
  let candidate: unknown = moduleExport;
  const visitedCandidates = new Set<unknown>();

  while (candidate && (typeof candidate === "function" || typeof candidate === "object")) {
    if (typeof candidate === "function") {
      return candidate as new (path: string) => BetterSqlite3Database;
    }

    if (visitedCandidates.has(candidate)) {
      break;
    }
    visitedCandidates.add(candidate);

    if (!("default" in candidate)) {
      break;
    }

    candidate = (candidate as { default?: unknown }).default;
  }

  return undefined;
}

function resolveBetterSqlite3ForRuntime(moduleRequire: ModuleRequire): {
  readonly constructor: (new (path: string) => BetterSqlite3Database) | undefined;
  readonly diagnostics: ReadonlyArray<string>;
} {
  const diagnostics: string[] = [];
  const moduleRequireResolution = loadBetterSqlite3Constructor(moduleRequire, "module require");
  diagnostics.push(moduleRequireResolution.diagnostic);
  if (moduleRequireResolution.constructor) {
    return { constructor: moduleRequireResolution.constructor, diagnostics };
  }

  const cwdRequire = createRequire(path.join(process.cwd(), "package.json"));
  if (cwdRequire !== moduleRequire) {
    const cwdResolution = loadBetterSqlite3Constructor(cwdRequire, "cwd package.json require");
    diagnostics.push(cwdResolution.diagnostic);
    if (cwdResolution.constructor) {
      return { constructor: cwdResolution.constructor, diagnostics };
    }
  }

  return { constructor: undefined, diagnostics };
}

function loadBetterSqlite3Constructor(
  moduleRequire: ModuleRequire,
  label: string,
): {
  readonly constructor: (new (path: string) => BetterSqlite3Database) | undefined;
  readonly diagnostic: string;
} {
  try {
    const moduleExport = moduleRequire("better-sqlite3");
    const resolvedConstructor = resolveBetterSqlite3Constructor(moduleExport);
    if (resolvedConstructor) {
      return {
        constructor: resolvedConstructor,
        diagnostic: `${label}: loaded better-sqlite3.`,
      };
    }

    return {
      constructor: undefined,
      diagnostic: `${label}: better-sqlite3 loaded but no constructor export was found.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      constructor: undefined,
      diagnostic: `${label}: ${message}`,
    };
  }
}

function openBunSqliteDatabase(databasePath: string, moduleRequire: ModuleRequire = require): SqliteCompatDatabase {
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
    const sqlite = moduleRequire("bun:sqlite") as BunSqliteModule;
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

function openNodeSqliteDatabase(
  databasePath: string,
  moduleRequire: ModuleRequire = require,
): SqliteCompatDatabase | undefined {
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

    const sqlite = moduleRequire("node:sqlite") as NodeSqliteModule;
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
