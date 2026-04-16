#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const reportRelativePath = "artifacts/test-reports/non-browser-test-report.json";
const reportPath = path.resolve(repoRoot, reportRelativePath);

mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(
  reportPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      reportPath: reportRelativePath,
      note: "Node's built-in test discovery handles non-browser test execution. No manual globs or file lists are passed.",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  "Review test report for failure details: artifacts/test-reports/non-browser-test-report.json",
);
