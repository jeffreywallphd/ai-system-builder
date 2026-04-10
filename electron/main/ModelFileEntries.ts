import fs from "node:fs";
import path from "node:path";
import { toLogicalModelPath } from "./ModelFilePathPolicy";

export function toFileEntry(modelsRootPath: string, filePath: string) {
  const stats = fs.statSync(filePath);
  return {
    path: toLogicalModelPath(modelsRootPath, filePath),
    kind: stats.isDirectory() ? "directory" as const : "file" as const,
    size: stats.isFile() ? stats.size : undefined,
    modifiedAt: stats.mtime.toISOString(),
  };
}

export function listEntries(modelsRootPath: string, rootPath: string, recursive = false): ReadonlyArray<ReturnType<typeof toFileEntry>> {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const results: ReturnType<typeof toFileEntry>[] = [];
  const walk = (currentPath: string) => {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      results.push(toFileEntry(modelsRootPath, entryPath));
      if (recursive && entry.isDirectory()) {
        walk(entryPath);
      }
    }
  };
  walk(rootPath);
  return results;
}
