import { AsyncLocalStorage } from "node:async_hooks";
import type { IPlatformTransactionManager } from "@application/common/ports/PlatformTransactionPorts";
import type { SqliteCompatDatabase } from "./SqliteCompat";

interface SqliteTransactionScope {
  depth: number;
  savepointSequence: number;
}

export class SqliteTransactionCoordinator implements IPlatformTransactionManager {
  private readonly transactionScope = new AsyncLocalStorage<SqliteTransactionScope>();
  private lock: Promise<void> = Promise.resolve();

  public constructor(private readonly resolveDatabase: () => SqliteCompatDatabase) {}

  public async runInTransaction<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    const activeScope = this.transactionScope.getStore();
    if (activeScope) {
      return this.runNestedTransaction(activeScope, operation);
    }

    return this.withExclusiveAccess(async () => this.transactionScope.run({
      depth: 0,
      savepointSequence: 0,
    }, async () => this.runOuterTransaction(operation)));
  }

  private async runOuterTransaction<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    const scope = this.requireScope();
    const database = this.resolveDatabase();

    database.exec("BEGIN IMMEDIATE TRANSACTION");
    scope.depth = 1;
    try {
      const value = await operation();
      database.exec("COMMIT");
      return value;
    } catch (error) {
      this.safeRollback(database, "ROLLBACK");
      throw error;
    } finally {
      scope.depth = 0;
    }
  }

  private async runNestedTransaction<TValue>(
    scope: SqliteTransactionScope,
    operation: () => Promise<TValue>,
  ): Promise<TValue> {
    const database = this.resolveDatabase();
    const savepointName = `loom_txn_${scope.savepointSequence += 1}`;

    database.exec(`SAVEPOINT ${savepointName}`);
    scope.depth += 1;
    try {
      const value = await operation();
      database.exec(`RELEASE SAVEPOINT ${savepointName}`);
      return value;
    } catch (error) {
      this.safeRollback(database, `ROLLBACK TO SAVEPOINT ${savepointName}`);
      this.safeRollback(database, `RELEASE SAVEPOINT ${savepointName}`);
      throw error;
    } finally {
      scope.depth = Math.max(0, scope.depth - 1);
    }
  }

  private async withExclusiveAccess<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    let release: () => void = () => {};
    const previousLock = this.lock;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.lock = previousLock.then(() => nextLock);
    await previousLock;

    try {
      return await operation();
    } finally {
      release();
    }
  }

  private requireScope(): SqliteTransactionScope {
    const scope = this.transactionScope.getStore();
    if (!scope) {
      throw new Error("SQLite transaction scope was not available.");
    }
    return scope;
  }

  private safeRollback(database: SqliteCompatDatabase, sql: string): void {
    try {
      database.exec(sql);
    } catch {
      // Ignore rollback failures to preserve original failure behavior.
    }
  }
}


