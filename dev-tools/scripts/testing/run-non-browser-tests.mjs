#!/usr/bin/env node

import {
  readdirSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const reportRelativePath = "artifacts/test-reports/non-browser-test-report.json";
const reportPath = path.resolve(repoRoot, reportRelativePath);

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

function toRepoRelativePaths(filePaths) {
  return filePaths.map((filePath) => toPosixPath(path.relative(repoRoot, filePath)));
}

function writeReportFile(report) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

const filesByPattern = testPatterns.map((pattern) => ({
  pattern,
  ...resolvePatternFiles(pattern),
}));

const resolvedFiles = [...new Set(filesByPattern.flatMap((entry) => entry.files))].sort();

writeReportFile({
  generatedAt: new Date().toISOString(),
  repoRoot,
  reportPath: reportRelativePath,
  discoveredFileCount: resolvedFiles.length,
  files: toRepoRelativePaths(resolvedFiles),
  patterns: filesByPattern.map((entry) => ({
    pattern: entry.pattern,
    rootDir: toPosixPath(path.relative(repoRoot, entry.rootDir)),
    matchCount: entry.files.length,
    files: toRepoRelativePaths(entry.files),
  })),
  note: "This file is post-run metadata only. Test execution is handled directly by Node's built-in test runner via package.json scripts.",
});

console.log(
  "Review test report for failure details: artifacts/test-reports/non-browser-test-report.json",
);
