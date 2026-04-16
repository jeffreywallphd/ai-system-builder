#!/usr/bin/env node

import {
  readdirSync,
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const reportRelativePath = "artifacts/test-reports/non-browser-test-report.json";
const reportPath = path.resolve(repoRoot, reportRelativePath);
const TEST_BATCH_SIZE = 10;
const isVerbose =
  process.argv.includes("--verbose")
  || process.env.NON_BROWSER_TEST_VERBOSE === "1"
  || process.env.NON_BROWSER_TEST_VERBOSE === "true";

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

function parseTapSummary(output) {
  const toCount = (pattern) => {
    const match = output.match(pattern);
    return match ? Number.parseInt(match[1], 10) : null;
  };

  return {
    tests: toCount(/# tests\s+(\d+)/),
    suites: toCount(/# suites\s+(\d+)/),
    pass: toCount(/# pass\s+(\d+)/),
    fail: toCount(/# fail\s+(\d+)/),
    cancelled: toCount(/# cancelled\s+(\d+)/),
    skipped: toCount(/# skipped\s+(\d+)/),
    todo: toCount(/# todo\s+(\d+)/),
    durationMs: toCount(/# duration_ms\s+(\d+(?:\.\d+)?)/),
  };
}

function writeReportFile(report) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function chunkFiles(filePaths, size) {
  const chunks = [];
  for (let index = 0; index < filePaths.length; index += size) {
    chunks.push(filePaths.slice(index, index + size));
  }
  return chunks;
}

function finalizeRun({
  status,
  exitCode,
  filesByPattern,
  resolvedFiles,
  batchStats,
  batchResults = [],
  stdout = "",
  stderr = "",
  startupError = null,
}) {
  const summary = parseTapSummary(`${stdout}\n${stderr}`);
  const totalBatches = batchStats?.total ?? 0;
  const passedBatches = batchStats?.passed ?? 0;
  const failedBatches = batchStats?.failed ?? 0;
  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    reportPath: reportRelativePath,
    verbose: isVerbose,
    status,
    exitCode,
    discoveredFileCount: resolvedFiles.length,
    batchSize: TEST_BATCH_SIZE,
    batchCount: totalBatches,
    passedBatchCount: passedBatches,
    failedBatchCount: failedBatches,
    batches: batchResults.map((batch) => ({
      batchNumber: batch.batchNumber,
      totalBatches: batch.totalBatches,
      fileCount: batch.fileCount,
      files: batch.files,
      status: batch.status,
      exitCode: batch.exitCode,
      startupError: batch.startupError,
      summary: batch.summary,
    })),
    files: toRepoRelativePaths(resolvedFiles),
    patterns: filesByPattern.map((entry) => ({
      pattern: entry.pattern,
      rootDir: toPosixPath(path.relative(repoRoot, entry.rootDir)),
      matchCount: entry.files.length,
      files: toRepoRelativePaths(entry.files),
    })),
    summary,
    failureDetails: status === "failed"
      ? {
          startupError,
          stdout,
          stderr,
        }
      : null,
  };

  writeReportFile(report);

  if (status === "passed") {
    const passedCount = summary.pass ?? 0;
    console.log(
      `Non-browser tests passed. ${passedCount} passing test(s) across ${resolvedFiles.length} file(s).`,
    );
    console.log(
      `Batch summary: ${passedBatches}/${totalBatches} batches passed, ${failedBatches} failed.`,
    );
  } else {
    const failedCount = summary.fail ?? "unknown";
    console.error(
      `Non-browser tests failed. ${failedCount} failing test(s) across ${resolvedFiles.length} file(s). Exit code: ${exitCode}.`,
    );
    console.error(
      `Batch summary: ${passedBatches}/${totalBatches} batches passed, ${failedBatches} failed.`,
    );
  }

  console.log(
    "Review test report for failure details: artifacts/test-reports/non-browser-test-report.json",
  );

  process.exit(exitCode);
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
  const detailLines = [
    "No non-browser test files were found for patterns:",
    `Resolved repo root: ${repoRoot}`,
    ...filesByPattern.flatMap((entry) => [
      `  - Pattern: ${entry.pattern}`,
      `    Search root: ${entry.rootDir}`,
    ]),
  ];

  for (const line of detailLines) {
    console.error(line);
  }

  finalizeRun({
    status: "failed",
    exitCode: 1,
    filesByPattern,
    resolvedFiles,
    batchStats: { total: 0, passed: 0, failed: 0 },
    batchResults: [],
    startupError: detailLines.join("\n"),
  });
}

console.log(
  `Starting tsx --test with ${resolvedFiles.length} discovered non-browser test file(s).`,
);

const tsxPackageJsonPath = path.resolve(repoRoot, "node_modules", "tsx", "package.json");
if (!existsSync(tsxPackageJsonPath)) {
  const startupError = `Could not locate tsx package metadata at '${tsxPackageJsonPath}'. Install dependencies before running non-browser tests.`;
  console.error(startupError);
  finalizeRun({
    status: "failed",
    exitCode: 1,
    filesByPattern,
    resolvedFiles,
    batchStats: { total: 0, passed: 0, failed: 0 },
    batchResults: [],
    startupError,
  });
}

const tsxPackageJson = JSON.parse(readFileSync(tsxPackageJsonPath, "utf8"));

let tsxBinEntry = tsxPackageJson.bin;
if (tsxBinEntry && typeof tsxBinEntry === "object") {
  tsxBinEntry = tsxBinEntry.tsx ?? Object.values(tsxBinEntry)[0];
}

if (typeof tsxBinEntry !== "string" || tsxBinEntry.length === 0) {
  console.error(`Invalid tsx bin entry in package metadata at '${tsxPackageJsonPath}'.`);
  process.exit(1);
}

const tsxPackageRoot = path.dirname(tsxPackageJsonPath);
const tsxBinPath = path.resolve(tsxPackageRoot, tsxBinEntry);
if (!existsSync(tsxBinPath)) {
  const startupError = `Could not locate tsx executable script at '${tsxBinPath}' resolved from '${tsxPackageJsonPath}'.`;
  console.error(startupError);
  finalizeRun({
    status: "failed",
    exitCode: 1,
    filesByPattern,
    resolvedFiles,
    batchStats: { total: 0, passed: 0, failed: 0 },
    batchResults: [],
    startupError,
  });
}

const nodeLaunchArgs = process.execArgv.includes("--preserve-symlinks-main")
  ? ["--preserve-symlinks-main"]
  : [];
const launchExecutable = process.execPath;
const fileBatches = chunkFiles(resolvedFiles, TEST_BATCH_SIZE);
const aggregatedStdout = [];
const aggregatedStderr = [];
const batchResults = [];
let hasBatchFailures = false;

for (const [batchIndex, batchFiles] of fileBatches.entries()) {
  const batchNumber = batchIndex + 1;
  const batchLabel = `batch ${batchNumber}/${fileBatches.length}`;
  console.log(`Running ${batchLabel} (${batchFiles.length} files)...`);

  const launchArgs = [...nodeLaunchArgs, tsxBinPath, "--test", ...batchFiles];
  const testProcess = spawnSync(
    launchExecutable,
    launchArgs,
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const stdout = testProcess.stdout ?? "";
  const stderr = testProcess.stderr ?? "";
  const startupError = testProcess.error
    ? `Failed to start tsx test runner executable '${launchExecutable}' with script '${tsxBinPath}' for ${batchLabel}: ${testProcess.error.message}`
    : null;
  const exitCode = testProcess.status ?? (startupError ? 1 : 0);
  const status = startupError || exitCode !== 0 ? "failed" : "passed";

  aggregatedStdout.push(
    `--- ${batchLabel} stdout ---`,
    stdout.length > 0 ? stdout : "(no stdout)",
  );
  aggregatedStderr.push(
    `--- ${batchLabel} stderr ---`,
    stderr.length > 0 ? stderr : "(no stderr)",
  );

  batchResults.push({
    batchNumber,
    totalBatches: fileBatches.length,
    fileCount: batchFiles.length,
    files: toRepoRelativePaths(batchFiles),
    status,
    exitCode,
    startupError,
    summary: parseTapSummary(`${stdout}\n${stderr}`),
    stdout,
    stderr,
  });

  if (isVerbose || status === "failed") {
    if (stdout.length > 0) {
      process.stdout.write(stdout);
    }
    if (stderr.length > 0) {
      process.stderr.write(stderr);
    }
  }

  if (status === "failed") {
    hasBatchFailures = true;
  }
}

const failedBatchDetails = batchResults
  .filter((batch) => batch.status === "failed")
  .map((batch) => ({
    batchNumber: batch.batchNumber,
    exitCode: batch.exitCode,
    startupError: batch.startupError,
  }));

finalizeRun({
  status: hasBatchFailures ? "failed" : "passed",
  exitCode: hasBatchFailures ? 1 : 0,
  filesByPattern,
  resolvedFiles,
  batchStats: {
    total: fileBatches.length,
    passed: fileBatches.length - failedBatchDetails.length,
    failed: failedBatchDetails.length,
  },
  batchResults,
  stdout: aggregatedStdout.join("\n"),
  stderr: aggregatedStderr.join("\n"),
  startupError: failedBatchDetails.length > 0
    ? JSON.stringify(failedBatchDetails, null, 2)
    : null,
});
