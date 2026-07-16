#!/usr/bin/env node

import path from "node:path";
import { access } from "node:fs/promises";

import {
  openLocalSqliteDatabase,
  resolveLocalSqliteDatabasePolicy,
  restoreLocalSqliteDatabase,
} from "../../../modules/adapters/persistence/sqlite";
import { exportStructuredData, writeStructuredDataExport } from "../../../modules/adapters/persistence/migration";

type Operation = "health" | "backup" | "restore" | "export";

interface Arguments {
  operation: Operation;
  dataRoot: string;
  destination?: string;
  backup?: string;
  confirmReplace: boolean;
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const policy = resolveLocalSqliteDatabasePolicy({ dataRootDirectory: args.dataRoot });

  if (args.operation === "restore") {
    if (!args.backup) throw new Error("restore requires --backup <sqlite-file>.");
    if (!args.confirmReplace) throw new Error("restore requires --confirm-replace after the desktop application is stopped.");
    const result = await restoreLocalSqliteDatabase({
      backupPath: path.resolve(args.backup),
      databasePath: policy.databaseFilePath,
    });
    process.stdout.write(`${JSON.stringify({ operation: "restore", status: "completed", ...result })}\n`);
    return;
  }

  await access(policy.databaseFilePath);
  const database = await openLocalSqliteDatabase({ policy });
  try {
    if (args.operation === "health") {
      const health = database.checkHealth();
      process.stdout.write(`${JSON.stringify({ operation: "health", ...health })}\n`);
      if (!health.healthy) process.exitCode = 2;
      return;
    }
    if (args.operation === "export") {
      if (!args.destination) throw new Error("export requires --destination <ndjson-file>.");
      const exported = await exportStructuredData(database.documents);
      const result = await writeStructuredDataExport(args.destination, exported);
      process.stdout.write(`${JSON.stringify({ operation: "export", status: "completed", ...result })}\n`);
      return;
    }
    if (!args.destination) throw new Error("backup requires --destination <sqlite-file>.");
    const result = await database.createBackup(path.resolve(args.destination));
    process.stdout.write(`${JSON.stringify({ operation: "backup", status: "completed", ...result })}\n`);
  } finally {
    database.close();
  }
}

function parseArguments(values: string[]): Arguments {
  const operation = values[0];
  if (operation !== "health" && operation !== "backup" && operation !== "restore" && operation !== "export") {
    throw new Error("Usage: persistence:sqlite <health|backup|restore|export> --data-root <directory> [options].");
  }
  const options = new Map<string, string>();
  let confirmReplace = false;
  for (let index = 1; index < values.length; index += 1) {
    const name = values[index];
    if (name === "--confirm-replace") {
      confirmReplace = true;
      continue;
    }
    if (!name?.startsWith("--")) throw new Error(`Unexpected SQLite maintenance argument: ${name ?? ""}.`);
    const value = values[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
    options.set(name, value);
    index += 1;
  }
  const dataRoot = options.get("--data-root");
  if (!dataRoot) throw new Error("--data-root <directory> is required.");
  return {
    operation,
    dataRoot,
    destination: options.get("--destination"),
    backup: options.get("--backup"),
    confirmReplace,
  };
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown SQLite maintenance failure.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
