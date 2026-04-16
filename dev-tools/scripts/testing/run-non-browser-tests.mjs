#!/usr/bin/env node

import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

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
    return {
      rootDir,
      files: [],
    };
  }

  const files = [];
  walkFiles(rootDir, files);

  return {
    rootDir,
    files: files.filter((filePath) => {
      const relativePath = toPosixPath(path.relative(repoRoot, filePath));
      return path.matchesGlob(relativePath, pattern);
    }),
  };
}

const filesByPattern = testPatterns.map((pattern) => ({
  pattern,
  ...resolvePatternFiles(pattern),
}));

const resolvedFiles = [...new Set(filesByPattern.flatMap((entry) => entry.files))].sort();

console.log(`Resolved non-browser test repo root: ${repoRoot}`);
for (const entry of filesByPattern) {
  console.log(`Pattern '${entry.pattern}' matched ${entry.files.length} file(s).`);
}
console.log(`Total resolved non-browser test files: ${resolvedFiles.length}`);

if (resolvedFiles.length === 0) {
  console.error("No non-browser test files were found for patterns:");
  console.error(`Resolved repo root: ${repoRoot}`);
  for (const entry of filesByPattern) {
    console.error(`  - Pattern: ${entry.pattern}`);
    console.error(`    Search root: ${entry.rootDir}`);
  }
  process.exit(1);
}

for (const entry of filesByPattern) {
  if (entry.files.length === 0) {
    console.warn(`No matches for pattern: ${entry.pattern}`);
  }
}

console.log(
  `Starting tsx --test with ${resolvedFiles.length} discovered non-browser test file(s).`,
);

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const launchArgs = ["tsx", "--test", ...resolvedFiles];

const testProcess = spawnSync(
  npxCommand,
  launchArgs,
  {
    cwd: repoRoot,
    stdio: "inherit",
  },
);

if (testProcess.error) {
  const commandString = `${npxCommand} ${launchArgs.join(" ")}`;
  console.error(
    `Failed to start tsx test runner command '${commandString}': ${testProcess.error.message}`,
  );
  process.exit(1);
}

process.exit(testProcess.status ?? 1);
