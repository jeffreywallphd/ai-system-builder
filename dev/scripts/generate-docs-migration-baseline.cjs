const { readFileSync, readdirSync, writeFileSync } = require("node:fs");
const { resolve, relative, sep } = require("node:path");

const REPO_ROOT = process.cwd();
const DOCS_ROOT = resolve(REPO_ROOT, "docs");
const OUTPUT_JSON_PATH = resolve(DOCS_ROOT, "documentation-migration-baseline.inventory.json");
const OUTPUT_MD_PATH = resolve(DOCS_ROOT, "documentation-migration-baseline.md");
const OUTPUT_AI_MD_PATH = resolve(DOCS_ROOT, "documentation-migration-baseline.ai.md");

const MARKDOWN_EXTENSIONS = [".md", ".ai.md"];
const BASELINE_FILES = new Set([
  "docs/documentation-migration-baseline.inventory.json",
  "docs/documentation-migration-baseline.md",
  "docs/documentation-migration-baseline.ai.md",
]);

const HIGH_VALUE_PATHS = new Set([
  "docs/general-prompt-guidance.md",
  "docs/architecture/README.md",
  "docs/architecture/README.ai.md",
  "docs/startup-memory-review.md",
  "docs/unified-api-contributor-guide.md",
  "docs/run-orchestration-contributor-guide.md",
  "docs/audit-governance-contributor-guide.md",
]);

function normalizePath(pathValue) {
  return pathValue.split(sep).join("/");
}

function collectFiles(rootPath) {
  const results = [];
  const stack = [rootPath];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    const entries = readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolve(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  }

  return results.sort((left, right) => left.localeCompare(right));
}

function countRegex(content, regex) {
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

function getCompanionPath(relativePath) {
  if (relativePath.endsWith(".ai.md")) {
    return relativePath.replace(/\.ai\.md$/, ".md");
  }

  if (relativePath.endsWith(".md")) {
    return relativePath.replace(/\.md$/, ".ai.md");
  }

  return null;
}

function hasOwnershipSignal(content) {
  const firstSection = content.split(/\r?\n/).slice(0, 120).join("\n").toLowerCase();
  const tokens = ["owner:", "owners:", "maintainer:", "maintainers:", "owned by", "steward:", "stewards:"];
  return tokens.some((token) => firstSection.includes(token));
}

function classifyRoles(relativePath) {
  const roles = new Set();
  const lowerPath = relativePath.toLowerCase();
  const basename = lowerPath.split("/").pop() || lowerPath;

  if (lowerPath.endsWith(".ai.md")) {
    roles.add("ai-context-oriented");
  }

  if (lowerPath.startsWith("docs/architecture/")) {
    roles.add("architectural");
  }

  if (
    basename.includes("contributor-guide") ||
    basename.includes("extension-guidance") ||
    basename.includes("guardrails") ||
    basename.includes("general-prompt-guidance")
  ) {
    roles.add("contributor-facing");
  }

  if (
    basename.includes("operations") ||
    basename.includes("operational") ||
    basename.includes("workflow") ||
    basename.includes("troubleshooting") ||
    basename.includes("administration") ||
    basename.includes("review") ||
    basename.includes("diagnostics")
  ) {
    roles.add("operational");
  }

  if (
    basename.includes("baseline") ||
    basename.includes("migration") ||
    basename.includes("final") ||
    basename.includes("completion") ||
    basename.includes("snapshot") ||
    basename.includes("status") ||
    basename.includes("handoff") ||
    basename.includes("story") ||
    basename.includes("epic")
  ) {
    roles.add("historical");
  }

  if (roles.size === 0) {
    roles.add("operational");
  }

  const secondaryRoles = Array.from(roles);
  const primaryRole = pickPrimaryRole(secondaryRoles);

  return {
    primaryRole,
    secondaryRoles: secondaryRoles.filter((role) => role !== primaryRole).sort(),
  };
}

function pickPrimaryRole(roles) {
  const priority = [
    "ai-context-oriented",
    "contributor-facing",
    "architectural",
    "operational",
    "historical",
  ];

  for (const role of priority) {
    if (roles.includes(role)) {
      return role;
    }
  }

  return roles[0] || "operational";
}

function topN(items, count, selector) {
  return [...items]
    .sort((left, right) => selector(right) - selector(left) || left.path.localeCompare(right.path))
    .slice(0, count);
}

function buildInventory() {
  const branchContext = getCurrentBranchName();
  const markdownFiles = collectFiles(DOCS_ROOT);
  const allRelativeFiles = markdownFiles.map((filePath) => normalizePath(relative(REPO_ROOT, filePath)));
  const relativeFileSet = new Set(allRelativeFiles);

  const documents = markdownFiles.map((filePath) => {
    const relativePath = normalizePath(relative(REPO_ROOT, filePath));
    const content = readFileSync(filePath, "utf8");
    const lineCount = content.split(/\r?\n/).length;
    const wordCount = content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length;
    const headingCount = countRegex(content, /^#{1,6}\s+/gm);
    const linkCount = countRegex(content, /\[[^\]]+\]\([^\)]+\)/g);
    const ownershipSignal = hasOwnershipSignal(content);
    const companionPath = getCompanionPath(relativePath);
    const hasCompanion = companionPath ? relativeFileSet.has(companionPath) : false;
    const pairStatus = companionPath ? (hasCompanion ? "paired" : "missing-companion") : "not-applicable";
    const { primaryRole, secondaryRoles } = classifyRoles(relativePath);

    let likelyTargetArea = "retain-current-location";
    if (relativePath.startsWith("docs/architecture/") && primaryRole !== "architectural" && primaryRole !== "ai-context-oriented") {
      likelyTargetArea = "docs/guides-or-docs/operations";
    } else if (relativePath.startsWith("docs/") && !relativePath.startsWith("docs/architecture/") && primaryRole === "architectural") {
      likelyTargetArea = "docs/architecture";
    } else if (primaryRole === "contributor-facing" && !relativePath.startsWith("docs/guides/")) {
      likelyTargetArea = "docs/guides";
    } else if (primaryRole === "operational" && relativePath.startsWith("docs/") && !relativePath.startsWith("docs/operations/")) {
      likelyTargetArea = "docs/operations";
    }

    return {
      path: relativePath,
      primaryRole,
      secondaryRoles,
      companionPath,
      pairStatus,
      hasOwnershipSignal: ownershipSignal,
      metrics: {
        lineCount,
        wordCount,
        headingCount,
        linkCount,
      },
      likelyOverloaded: wordCount >= 3000 || linkCount >= 50,
      likelyTargetArea,
    };
  });

  const docsWithoutBaseline = documents.filter((doc) => !BASELINE_FILES.has(doc.path));

  const roleCounts = {
    architectural: 0,
    operational: 0,
    "contributor-facing": 0,
    historical: 0,
    "ai-context-oriented": 0,
  };
  const roleSignalCounts = {
    architectural: 0,
    operational: 0,
    "contributor-facing": 0,
    historical: 0,
    "ai-context-oriented": 0,
  };

  for (const doc of docsWithoutBaseline) {
    roleCounts[doc.primaryRole] += 1;
    roleSignalCounts[doc.primaryRole] += 1;
    for (const role of doc.secondaryRoles) {
      roleSignalCounts[role] += 1;
    }
  }

  const directories = new Map();
  for (const doc of docsWithoutBaseline) {
    const directoryPath = doc.path.includes("/") ? doc.path.slice(0, doc.path.lastIndexOf("/")) : "docs";
    if (!directories.has(directoryPath)) {
      directories.set(directoryPath, {
        path: directoryPath,
        fileCount: 0,
        pairedCount: 0,
        missingCompanionCount: 0,
        roleCounts: {
          architectural: 0,
          operational: 0,
          "contributor-facing": 0,
          historical: 0,
          "ai-context-oriented": 0,
        },
      });
    }

    const entry = directories.get(directoryPath);
    entry.fileCount += 1;
    entry.roleCounts[doc.primaryRole] += 1;
    if (doc.pairStatus === "paired") {
      entry.pairedCount += 1;
    }
    if (doc.pairStatus === "missing-companion") {
      entry.missingCompanionCount += 1;
    }
  }

  const slugMap = new Map();
  for (const doc of docsWithoutBaseline) {
    const slug = doc.path
      .replace(/^docs\//, "")
      .replace(/\.ai\.md$/, "")
      .replace(/\.md$/, "")
      .split("/")
      .pop();

    if (!slugMap.has(slug)) {
      slugMap.set(slug, []);
    }

    slugMap.get(slug).push(doc.path);
  }

  const duplicatedSlugs = Array.from(slugMap.entries())
    .filter(([, paths]) => paths.length > 2)
    .map(([slug, paths]) => ({
      slug,
      paths: paths.sort(),
    }))
    .sort((left, right) => right.paths.length - left.paths.length || left.slug.localeCompare(right.slug));

  const missingOwnership = docsWithoutBaseline.filter((doc) => !doc.hasOwnershipSignal);
  const overloadedDocs = docsWithoutBaseline.filter((doc) => doc.likelyOverloaded);

  const missingCompanions = docsWithoutBaseline.filter((doc) => doc.pairStatus === "missing-companion");

  const topDirectoryRows = Array.from(directories.values()).sort(
    (left, right) => right.fileCount - left.fileCount || left.path.localeCompare(right.path),
  );

  const highValueDocuments = docsWithoutBaseline
    .filter((doc) => HIGH_VALUE_PATHS.has(doc.path) || doc.metrics.linkCount >= 30 || doc.path.endsWith("README.md"))
    .sort((left, right) => right.metrics.linkCount - left.metrics.linkCount || left.path.localeCompare(right.path))
    .slice(0, 20)
    .map((doc) => ({
      path: doc.path,
      primaryRole: doc.primaryRole,
      linkCount: doc.metrics.linkCount,
      wordCount: doc.metrics.wordCount,
      reason: HIGH_VALUE_PATHS.has(doc.path)
        ? "explicitly-curated-entry-point"
        : doc.metrics.linkCount >= 30
          ? "high-link-density-navigation-hub"
          : "readme-or-index",
    }));

  const summary = {
    totalMarkdownFiles: docsWithoutBaseline.length,
    totalDirectories: topDirectoryRows.length,
    roleCounts,
    roleSignalCounts,
    pairing: {
      pairedFiles: docsWithoutBaseline.filter((doc) => doc.pairStatus === "paired").length,
      missingCompanionFiles: missingCompanions.length,
    },
    ownershipSignals: {
      filesWithOwnershipSignals: docsWithoutBaseline.length - missingOwnership.length,
      filesWithoutOwnershipSignals: missingOwnership.length,
    },
    likelyOverloadedFiles: overloadedDocs.length,
  };

  const historicalSignalDocs = docsWithoutBaseline.filter(
    (doc) => doc.primaryRole === "historical" || doc.secondaryRoles.includes("historical"),
  );

  const migrationRisks = [
    {
      id: "risk-001-overloaded-entry-documents",
      severity: "high",
      title: "A small number of hub documents are overloaded navigation bottlenecks",
      evidence: topN(overloadedDocs, 5, (doc) => doc.metrics.linkCount).map((doc) => ({
        path: doc.path,
        wordCount: doc.metrics.wordCount,
        linkCount: doc.metrics.linkCount,
      })),
      impact: "Readers must parse very large documents to discover canonical docs, reducing findability and increasing onboarding cost.",
    },
    {
      id: "risk-002-ownership-metadata-gap",
      severity: "high",
      title: "Ownership and stewardship metadata is mostly absent",
      evidence: {
        filesWithoutOwnershipSignals: missingOwnership.length,
        totalFiles: docsWithoutBaseline.length,
      },
      impact: "Future migrations and maintenance cannot be routed predictably to responsible owners.",
    },
    {
      id: "risk-003-namespace-overload-at-docs-root",
      severity: "medium",
      title: "`docs/` root is overloaded with mixed contributor and operational docs",
      evidence: {
        rootFileCount: docsWithoutBaseline.filter((doc) => doc.path.split("/").length === 2).length,
        rootContributorFacingFiles: docsWithoutBaseline.filter(
          (doc) => doc.path.split("/").length === 2 && doc.primaryRole === "contributor-facing",
        ).length,
        rootOperationalFiles: docsWithoutBaseline.filter(
          (doc) => doc.path.split("/").length === 2 && doc.primaryRole === "operational",
        ).length,
      },
      impact: "Role ambiguity at the top-level folder makes navigation unpredictable and blocks scalable taxonomy expansion.",
    },
    {
      id: "risk-004-ai-human-duplication-surface",
      severity: "medium",
      title: "Large `.md` / `.ai.md` companion surface increases drift risk",
      evidence: {
        pairedFiles: docsWithoutBaseline.filter((doc) => doc.pairStatus === "paired").length,
        missingCompanionFiles: missingCompanions.length,
      },
      impact: "Dual maintenance across human and AI companion docs creates synchronization risk without explicit parity checks.",
    },
    {
      id: "risk-005-historical-and-current-doc-mixing",
      severity: "medium",
      title: "Historical baseline docs are mixed with active guidance in the same namespaces",
      evidence: {
        historicalSignalCount: historicalSignalDocs.length,
        examples: historicalSignalDocs
          .slice(0, 10)
          .map((doc) => doc.path),
      },
      impact: "Without separate archival taxonomy, readers can misinterpret historical baselines as current source-of-truth guidance.",
    },
  ];

  return {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    auditScope: "docs/**/*.(md|ai.md)",
    branchContext,
    summary,
    directories: topDirectoryRows,
    highValueDocuments,
    duplicationSignals: {
      duplicatedSlugs,
      missingCompanions: missingCompanions.map((doc) => doc.path),
    },
    migrationRisks,
    documents: docsWithoutBaseline,
  };
}

function createMarkdownReport(inventory) {
  const rootDirectory = inventory.directories.find((directory) => directory.path === "docs");
  const overloadedExamples = inventory.migrationRisks.find((risk) => risk.id === "risk-001-overloaded-entry-documents")?.evidence || [];
  const topDirectories = inventory.directories.slice(0, 6);

  const lines = [
    "# Documentation Migration Baseline (Story 1.1.1)",
    "",
    "This artifact captures the current-state documentation structure and taxonomy baseline before any migration work.",
    "",
    "## Scope",
    `- Branch context: \`${inventory.branchContext}\``,
    "- Audited path: `docs/**/*.(md|ai.md)`",
    `- Audited files: ${inventory.summary.totalMarkdownFiles}`,
    `- Audited directories: ${inventory.summary.totalDirectories}`,
    "- Machine-readable inventory: `docs/documentation-migration-baseline.inventory.json`",
    "",
    "## Current Folder Layout",
    "",
    "| Directory | Files | Primary role concentration | Missing companions |",
    "| --- | ---: | --- | ---: |",
  ];

  for (const directory of topDirectories) {
    const concentration = Object.entries(directory.roleCounts)
      .sort((left, right) => right[1] - left[1])[0][0];
    lines.push(`| \`${directory.path}\` | ${directory.fileCount} | ${concentration} | ${directory.missingCompanionCount} |`);
  }

  lines.push("", "## Role Category Breakdown (Primary Role)", "");
  lines.push("| Role | Count |", "| --- | ---: |");

  for (const [role, count] of Object.entries(inventory.summary.roleCounts)) {
    lines.push(`| ${role} | ${count} |`);
  }

  lines.push("", "## Role Category Breakdown (Any Role Signal)", "");
  lines.push("| Role | Count |", "| --- | ---: |");

  for (const [role, count] of Object.entries(inventory.summary.roleSignalCounts)) {
    lines.push(`| ${role} | ${count} |`);
  }

  lines.push(
    "",
    "## Major Observations",
    `- The \`docs/architecture/\` subtree dominates the doc set with ${inventory.directories.find((directory) => directory.path === "docs/architecture")?.fileCount || 0} files and mixes current architecture guidance with historical baselines.`,
    `- The docs root currently holds ${rootDirectory ? rootDirectory.fileCount : 0} markdown files, creating role ambiguity between contributor guides, operational runbooks, and AI companion content.`,
    `- Companion duplication is extensive: ${inventory.summary.pairing.pairedFiles} files are in \`.md\`/\`.ai.md\` pairs and ${inventory.summary.pairing.missingCompanionFiles} files do not have a companion.`,
    `- Ownership signals are missing in ${inventory.summary.ownershipSignals.filesWithoutOwnershipSignals} files, which limits migration accountability.`,
    "",
    "## Highest-Risk Structural Problems",
  );

  for (const risk of inventory.migrationRisks) {
    lines.push(`- **${risk.severity.toUpperCase()}** ${risk.title}: ${risk.impact}`);
  }

  lines.push("", "## Overloaded Document Examples");

  for (const example of overloadedExamples) {
    lines.push(`- \`${example.path}\` (${example.wordCount} words, ${example.linkCount} links)`);
  }

  lines.push(
    "",
    "## High-Value Anchor Files",
    "- `docs/general-prompt-guidance.md`",
    "- `docs/architecture/README.md`",
    "- `docs/architecture/README.ai.md`",
    "- `docs/startup-memory-review.md`",
    "- `docs/unified-api-contributor-guide.md`",
    "",
    "## Classification and Future-Move Signals",
    "- Every markdown file in the scope is classified in the inventory with a primary role and optional secondary roles.",
    "- Each file includes a `likelyTargetArea` hint to support later migration planning without moving files in this story.",
    "",
    "## Enforcement",
    "- `dev/tests/DocumentationMigrationBaselineGuardrails.test.ts` validates baseline coverage and role taxonomy integrity.",
    "- Regenerate after docs changes with: `node dev/scripts/generate-docs-migration-baseline.cjs`.",
  );

  return `${lines.join("\n")}\n`;
}

function getCurrentBranchName() {
  try {
    const headPath = resolve(REPO_ROOT, ".git", "HEAD");
    const head = readFileSync(headPath, "utf8").trim();
    const refPrefix = "ref: refs/heads/";

    if (head.startsWith(refPrefix)) {
      return head.slice(refPrefix.length);
    }

    return "detached-head";
  } catch {
    return "unknown";
  }
}

function createAiMarkdownReport() {
  return [
    "# AI Companion: Documentation Migration Baseline (Story 1.1.1)",
    "",
    "Use `docs/documentation-migration-baseline.inventory.json` as the source of truth for the current docs layout, role classification, and migration risk baseline.",
    "",
    "## What this baseline gives you",
    "- Full inventory of `docs/**/*.(md|ai.md)` files with per-file role tags.",
    "- Directory-level counts and companion-pairing signals.",
    "- Explicit risk list for overloaded docs, ownership gaps, and namespace ambiguity.",
    "- Non-destructive future-move hints (`likelyTargetArea`) for follow-on migration stories.",
    "",
    "## Role taxonomy used",
    "- `architectural`",
    "- `operational`",
    "- `contributor-facing`",
    "- `historical`",
    "- `ai-context-oriented`",
    "",
    "## Guardrail expectations",
    "- Update the inventory when docs are added, removed, or renamed.",
    "- Keep every docs markdown file represented in the inventory with an allowed primary role.",
    "- Keep this file and `docs/documentation-migration-baseline.md` aligned with inventory intent.",
    "",
    "## Regeneration command",
    "- `node dev/scripts/generate-docs-migration-baseline.cjs`",
  ].join("\n") + "\n";
}

function main() {
  const inventory = buildInventory();
  const markdownReport = createMarkdownReport(inventory);
  const aiMarkdownReport = createAiMarkdownReport();

  writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  writeFileSync(OUTPUT_MD_PATH, markdownReport, "utf8");
  writeFileSync(OUTPUT_AI_MD_PATH, aiMarkdownReport, "utf8");

  process.stdout.write([
    `Generated ${normalizePath(relative(REPO_ROOT, OUTPUT_JSON_PATH))}`,
    `Generated ${normalizePath(relative(REPO_ROOT, OUTPUT_MD_PATH))}`,
    `Generated ${normalizePath(relative(REPO_ROOT, OUTPUT_AI_MD_PATH))}`,
  ].join("\n") + "\n");
}

main();
