#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { run } from "node:test";
import { fileURLToPath } from "node:url";

const runnerDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(runnerDir, "../../..");

const reportRelativePath = "artifacts/test-reports/non-browser-test-report.json";
const reportPath = path.resolve(repoRoot, reportRelativePath);

const globPatterns = [
  "modules/**/*.test.ts",
  "apps/server/src/tests/**/*.test.ts",
  "apps/desktop/src/preload/tests/**/*.test.ts",
];

const discoveredFiles = new Set();

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  reportPath: reportRelativePath,
  status: "failed",
  exitCode: 1,
  configuredGlobPatterns: globPatterns,
  discoveredFileCount: 0,
  discoveredFiles: [],
  summary: {
    counts: {
      cancelled: 0,
      passed: 0,
      skipped: 0,
      suites: 0,
      tests: 0,
      todo: 0,
      topLevel: 0,
    },
    durationMs: 0,
    success: false,
  },
  failures: [],
  startupError: null,
};

const writeReport = () => {
  report.discoveredFiles = [...discoveredFiles].sort();
  report.discoveredFileCount = report.discoveredFiles.length;

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
};

const recordDiscoveredFile = (event) => {
  if (event && typeof event.file === "string" && event.file.length > 0) {
    discoveredFiles.add(path.relative(repoRoot, event.file));
  }
};

const serializeError = (value) => {
  if (!value || typeof value !== "object") {
    return {
      name: "Error",
      message: String(value),
      stack: undefined,
      code: undefined,
      cause: undefined,
    };
  }

  const maybeError = value;
  const cause = maybeError.cause;

  return {
    name: typeof maybeError.name === "string" ? maybeError.name : "Error",
    message: typeof maybeError.message === "string" ? maybeError.message : String(value),
    stack: typeof maybeError.stack === "string" ? maybeError.stack : undefined,
    code: typeof maybeError.code === "string" ? maybeError.code : undefined,
    cause:
      cause && typeof cause === "object"
        ? {
            name: typeof cause.name === "string" ? cause.name : undefined,
            message: typeof cause.message === "string" ? cause.message : String(cause),
            stack: typeof cause.stack === "string" ? cause.stack : undefined,
            code: typeof cause.code === "string" ? cause.code : undefined,
          }
        : cause,
  };
};

try {
  const testsStream = run({
    cwd: repoRoot,
    globPatterns,
    isolation: "none",
  });

  await new Promise((resolve, reject) => {
    testsStream.on("test:start", recordDiscoveredFile);

    testsStream.on("test:pass", (event) => {
      recordDiscoveredFile(event);
    });

    testsStream.on("test:fail", (event) => {
      recordDiscoveredFile(event);

      report.failures.push({
        name: event.name,
        file: event.file,
        line: event.line,
        column: event.column,
        nesting: event.nesting,
        testNumber: event.testNumber,
        details: {
          durationMs: event.details?.duration_ms,
          type: event.details?.type,
          error: serializeError(event.details?.error),
        },
      });
    });

    testsStream.on("test:summary", (event) => {
      report.summary = {
        counts: {
          cancelled: event.counts.cancelled,
          passed: event.counts.passed,
          skipped: event.counts.skipped,
          suites: event.counts.suites,
          tests: event.counts.tests,
          todo: event.counts.todo,
          topLevel: event.counts.topLevel,
        },
        durationMs: event.duration_ms,
        success: event.success,
      };
    });

    testsStream.once("error", reject);
    testsStream.once("close", resolve);
  });

  const didFail = report.failures.length > 0 || report.summary.success === false;
  report.status = didFail ? "failed" : "passed";
  report.exitCode = didFail ? 1 : 0;
  process.exitCode = report.exitCode;
} catch (error) {
  report.status = "startup-failed";
  report.exitCode = 1;
  report.startupError = serializeError(error);
  process.exitCode = 1;
} finally {
  writeReport();
  console.log("Review test report for failure details: artifacts/test-reports/non-browser-test-report.json");
}
