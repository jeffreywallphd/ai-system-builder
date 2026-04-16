#!/usr/bin/env node

import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const testPatterns = [
  "modules/**/*.test.ts",
  "apps/server/src/tests/**/*.test.ts",
  "apps/desktop/src/preload/tests/**/*.test.ts",
];

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function walkFiles(dirPath, acc) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
      continue;
    }
    if (entry.isFile()) {
      acc.push(fullPath);
    }
  }
}

function resolvePatternFiles(pattern) {
  const rootPrefix = pattern.includes("/**/")
    ? pattern.slice(0, pattern.indexOf("/**/"))
    : ".";
  const rootDir = path.resolve(repoRoot, rootPrefix);

  if (!existsSync(rootDir)) {
    return [];
  }

  const files = [];
  walkFiles(rootDir, files);

  return files.filter((filePath) => {
    const relativePath = toPosixPath(path.relative(repoRoot, filePath));
    return path.matchesGlob(relativePath, pattern);
  });
}

const filesByPattern = testPatterns.map((pattern) => ({
  pattern,
  files: resolvePatternFiles(pattern),
}));

const resolvedFiles = [...new Set(filesByPattern.flatMap((entry) => entry.files))].sort();

if (resolvedFiles.length === 0) {
  console.error("No non-browser test files were found for patterns:");
  for (const pattern of testPatterns) {
    console.error(`  - ${pattern}`);
  }
  process.exit(1);
}

for (const entry of filesByPattern) {
  if (entry.files.length === 0) {
    console.warn(`No matches for pattern: ${entry.pattern}`);
  }
}

let tsxCliPath;
try {
  tsxCliPath = require.resolve("tsx/dist/cli.mjs");
} catch (error) {
  console.error("Could not resolve tsx CLI at 'tsx/dist/cli.mjs'.");
  process.exit(1);
}

const testProcess = spawnSync(
  process.execPath,
  [tsxCliPath, "--test", ...resolvedFiles],
  {
    cwd: repoRoot,
    stdio: "inherit",
  },
);

if (testProcess.error) {
  console.error(`Failed to start tsx test runner: ${testProcess.error.message}`);
  process.exit(1);
}

process.exit(testProcess.status ?? 1);
