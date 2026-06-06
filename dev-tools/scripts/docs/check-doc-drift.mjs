#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const normalizeToPosixPath = (value) => value.split(path.sep).join("/");

const isDirectoryPath = (targetPath) => {
  try {
    return statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
};

const isFilePath = (targetPath) => {
  try {
    return statSync(targetPath).isFile();
  } catch {
    return false;
  }
};

const walkMarkdownFiles = (rootRelativePath) => {
  const rootPath = path.resolve(repoRoot, rootRelativePath);
  if (!isDirectoryPath(rootPath)) {
    return [];
  }

  const files = [];
  const visit = (currentPath) => {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(absolutePath);
      }
    }
  };

  visit(rootPath);
  return files.sort((left, right) => left.localeCompare(right));
};

const monitoredMarkdownFiles = [
  ...walkMarkdownFiles("docs/architecture"),
  ...walkMarkdownFiles("docs/adr"),
  ...walkMarkdownFiles("docs/context/packs"),
];

const contextPackFiles = walkMarkdownFiles("docs/context/packs");
const readmeReminder = "> AI documentation reminder: when behavior in this area changes, update the related ADRs, architecture docs, context packs, and README files in the same change.";
const ignoredReadmeDirectories = new Set([
  ".git",
  ".local",
  ".webpack",
  "artifacts",
  "dist",
  "node_modules",
  "tmp",
]);

const findReadmeFiles = () => {
  const files = [];
  const visit = (currentPath) => {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredReadmeDirectories.has(entry.name)) {
          visit(absolutePath);
        }
        continue;
      }
      if (entry.isFile() && entry.name === "README.md") {
        files.push(absolutePath);
      }
    }
  };
  visit(repoRoot);
  return files.sort((left, right) => left.localeCompare(right));
};

const bannedTimelineRules = [
  {
    label: "phase-number label",
    pattern: /\bPhase\s+\d+\b/i,
  },
  {
    label: "prompt-number label",
    pattern: /\bPrompt\s+\d+\b/i,
  },
  {
    label: "later-prompt reference",
    pattern: /\blater prompts?\b/i,
  },
  {
    label: "implementation work-item history",
    pattern: /\bimplementation work items?\b/i,
  },
  {
    label: "implementation sequence history",
    pattern: /\bimplementation sequence\b/i,
  },
  {
    label: "implementation step history",
    pattern: /\bimplementation step\b/i,
  },
  {
    label: "review cleanup history",
    pattern: /\breview cleanup\b/i,
  },
  {
    label: "current update diary note",
    pattern: /\bcurrent update\b/i,
  },
  {
    label: "scheduled follow-up diary note",
    pattern: /\bscheduled for\b/i,
  },
];

const allowedTimelineRuleLinePatterns = [
  /\bdo not\b.*\bphase\b/i,
  /\bmust not\b.*\bphase\b/i,
  /\bnot .*phase history\b/i,
  /\bphase\/prompt\/review history\b/i,
];

const hasAllowedTimelineRuleContext = (line) =>
  allowedTimelineRuleLinePatterns.some((pattern) => pattern.test(line));

const readTextFile = (absolutePath) => readFileSync(absolutePath, "utf8");

const reportFailure = (failures, relativePath, message) => {
  failures.push(`${relativePath}: ${message}`);
};

export const findDocumentationDrift = () => {
  const failures = [];

  for (const absolutePath of monitoredMarkdownFiles) {
    const relativePath = normalizeToPosixPath(path.relative(repoRoot, absolutePath));
    const text = readTextFile(absolutePath);
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const rule of bannedTimelineRules) {
        if (rule.pattern.test(line) && !hasAllowedTimelineRuleContext(line)) {
          reportFailure(
            failures,
            relativePath,
            `line ${index + 1} uses ${rule.label}; use current domain/boundary language instead.`,
          );
        }
      }
    });
  }

  for (const absolutePath of contextPackFiles) {
    const relativePath = normalizeToPosixPath(path.relative(repoRoot, absolutePath));
    const text = readTextFile(absolutePath);
    const lineCount = text.split(/\r?\n/).length;

    if (lineCount > 200) {
      reportFailure(
        failures,
        relativePath,
        `has ${lineCount} lines; context packs must stay at or below 200 physical lines.`,
      );
    }

    const hasCanonicalSourceSection =
      /^## .*Canonical .*(Docs?|Sources?|References?|Files?).*$/im.test(text) ||
      /^## Required Docs To Inspect$/im.test(text);

    if (!hasCanonicalSourceSection) {
      reportFailure(
        failures,
        relativePath,
        "must include a canonical source/reference section so support docs stay downstream.",
      );
    }
  }

  for (const absolutePath of findReadmeFiles()) {
    const relativePath = normalizeToPosixPath(path.relative(repoRoot, absolutePath));
    const text = readTextFile(absolutePath);
    if (!text.includes(readmeReminder)) {
      reportFailure(
        failures,
        relativePath,
        "must include the AI documentation reminder near the top.",
      );
    }
  }

  const adrReadmePath = path.resolve(repoRoot, "docs/adr/README.md");
  if (isFilePath(adrReadmePath)) {
    const adrReadme = readTextFile(adrReadmePath);
    if (/^## Current ADRs\b/im.test(adrReadme)) {
      reportFailure(
        failures,
        "docs/adr/README.md",
        "must not maintain a partial hand-written 'Current ADRs' inventory; use files or a generated index.",
      );
    }
  }

  return failures;
};

export const buildDocumentationDriftMessage = (failures) => [
  "Documentation drift guardrails failed.",
  "Fix the following issues or update dev-tools/scripts/docs/check-doc-drift.mjs if a new durable rule is needed:",
  "",
  ...failures.map((failure) => `- ${failure}`),
].join("\n");

const isDirectExecution = process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  const failures = findDocumentationDrift();
  if (failures.length > 0) {
    console.error(buildDocumentationDriftMessage(failures));
    process.exitCode = 1;
  }
}
