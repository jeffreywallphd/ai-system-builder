import path from "node:path";
import { existsSync } from "node:fs";

import {
  openLocalSqliteDatabase,
  restoreLocalSqliteDatabase,
} from "../sqlite-database";
import { resolveLocalSqliteDatabasePolicy } from "../local-sqlite-database-policy";
import { createLocalWorkspaceRepository } from "../../workspace";

async function main(): Promise<void> {
  const rootDirectory = process.argv[2];
  if (!rootDirectory) throw new Error("A temporary root directory is required.");

  const policy = resolveLocalSqliteDatabasePolicy({ dataRootDirectory: rootDirectory });
  const database = await openLocalSqliteDatabase({
    policy,
    now: () => "2026-07-16T12:00:00.000Z",
  });

  const first = await database.documents.writeDocument("tests", "one", { value: 1 });
  const second = await database.documents.writeDocument("tests", "one", { value: 2 }, { expectedRevision: first.revision });
  const structuredRoot = path.join(rootDirectory, "artifacts");
  const workspaceRepository = createLocalWorkspaceRepository({ rootDirectory: structuredRoot, documents: database.documents });
  await workspaceRepository.saveWorkspace({
    workspaceId: "workspace-sqlite",
    displayName: "SQLite workspace",
    status: "active",
    createdAt: "2026-07-16T12:00:00.000Z",
    updatedAt: "2026-07-16T12:00:00.000Z",
  });
  const persistedWorkspace = await workspaceRepository.readWorkspace("workspace-sqlite");
  try {
    await database.documents.runInTransaction(async (transaction) => {
      await transaction.writeDocument("tests", "rolled-back", { value: true });
      throw new Error("force rollback");
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "force rollback") throw error;
  }

  const health = database.checkHealth();
  const backupPath = path.join(rootDirectory, "backups", "verified.sqlite3");
  const backup = await database.createBackup(backupPath);
  database.close();

  const replacement = await openLocalSqliteDatabase({ policy });
  await replacement.documents.writeDocument("tests", "one", { value: 99 });
  replacement.close();
  const restore = await restoreLocalSqliteDatabase({ backupPath, databasePath: policy.databaseFilePath });

  const restored = await openLocalSqliteDatabase({ policy });
  const restoredDocument = await restored.documents.readDocument<{ value: number }>("tests", "one");
  const rolledBack = await restored.documents.readDocument("tests", "rolled-back");
  restored.close();

  process.stdout.write(JSON.stringify({
    health,
    backup,
    restore,
    secondRevision: second.revision,
    restoredValue: restoredDocument?.value.value,
    rolledBackPresent: Boolean(rolledBack),
    workspaceDisplayName: persistedWorkspace?.displayName,
    workspaceJsonWritten: existsSync(path.join(structuredRoot, "workspaces")),
  }));
}

void main();
