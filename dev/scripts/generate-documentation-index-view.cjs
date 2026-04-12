const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const DEFAULT_REGISTRY_PATH = "docs/context/documentation-registry.seed.json";
const DEFAULT_HUMAN_OUTPUT_PATH = "docs/context/documentation-index.md";
const DEFAULT_AI_OUTPUT_PATH = "docs/context/documentation-index.ai.md";
const CURRENT_REVIEW_DATE = "2026-04-11";

function normalizePath(pathValue) {
  return pathValue.replace(/\\/g, "/");
}

function readJson(pathValue) {
  return JSON.parse(readFileSync(pathValue, "utf8"));
}

function toContextRelativePath(repoRelativePath) {
  const normalized = normalizePath(repoRelativePath);
  if (normalized.startsWith("docs/context/")) {
    return `./${normalized.slice("docs/context/".length)}`;
  }
  if (normalized.startsWith("docs/")) {
    return `../${normalized.slice("docs/".length)}`;
  }
  return normalized;
}

function byTitleThenRecordId(left, right) {
  return left.title.localeCompare(right.title) || left.recordId.localeCompare(right.recordId);
}

function buildGroupedSection({
  heading,
  groups,
  keyOrder,
  entriesByRecordId,
  useAiPaths,
}) {
  const lines = [heading, ""];

  for (const key of keyOrder) {
    const groupRecordIds = Array.isArray(groups[key]) ? groups[key] : [];
    const records = groupRecordIds
      .map((recordId) => entriesByRecordId.get(recordId))
      .filter(Boolean)
      .sort(byTitleThenRecordId);

    lines.push(`### \`${key}\` (${records.length})`);
    if (records.length === 0) {
      lines.push("- No indexed records.");
      lines.push("");
      continue;
    }

    for (const entry of records) {
      const entryPath = useAiPaths && typeof entry.aiPath === "string" ? entry.aiPath : entry.path;
      const relativePath = toContextRelativePath(entryPath);
      lines.push(`- [${entry.title}](${relativePath}) (\`${entry.recordId}\`)`);
    }
    lines.push("");
  }

  return lines;
}

function buildTaskWorkflowSection({
  registry,
  entriesByRecordId,
  useAiPaths,
}) {
  const taskGroups = registry.discoveryIndex?.byTaskCategory || {};
  const routeHints = registry.taskRoutingIndex?.routeHintsByTaskCategory || {};
  const taskCategories = Object.keys(taskGroups).sort((left, right) => left.localeCompare(right));
  const lines = ["## Browse by Task Workflow", ""];

  if (taskCategories.length === 0) {
    lines.push("- No task-oriented discovery groups are configured.");
    lines.push("");
    return lines;
  }

  for (const taskCategory of taskCategories) {
    const groupRecordIds = Array.isArray(taskGroups[taskCategory]) ? taskGroups[taskCategory] : [];
    const records = groupRecordIds
      .map((recordId) => entriesByRecordId.get(recordId))
      .filter(Boolean)
      .sort(byTitleThenRecordId);
    const hint = routeHints[taskCategory] || {};
    const routeTaskIds = Array.isArray(hint.routeTaskIds) ? hint.routeTaskIds : [];
    const contextMapMappingIds = Array.isArray(hint.contextMapMappingIds) ? hint.contextMapMappingIds : [];

    lines.push(`### \`${taskCategory}\` (${records.length})`);
    if (routeTaskIds.length > 0) {
      lines.push(`- Routing task IDs: \`${routeTaskIds.join("`, `")}\``);
    } else {
      lines.push("- Routing task IDs: _No direct route task IDs registered; use context-map defaults._");
    }
    if (contextMapMappingIds.length > 0) {
      lines.push(`- Context-map mapping IDs: \`${contextMapMappingIds.join("`, `")}\``);
    }
    if (typeof hint.defaultSelectionMode === "string" && hint.defaultSelectionMode.length > 0) {
      lines.push(`- Selection mode / priority: \`${hint.defaultSelectionMode}\` / \`${hint.defaultPriorityTier}\``);
    }
    if (typeof hint.contextAssemblyProfileId === "string" && hint.contextAssemblyProfileId.length > 0) {
      lines.push(`- Context assembly profile: \`${hint.contextAssemblyProfileId}\``);
    }

    if (records.length === 0) {
      lines.push("- No indexed records.");
      lines.push("");
      continue;
    }

    for (const entry of records) {
      const entryPath = useAiPaths && typeof entry.aiPath === "string" ? entry.aiPath : entry.path;
      const relativePath = toContextRelativePath(entryPath);
      lines.push(`- [${entry.title}](${relativePath}) (\`${entry.recordId}\`)`);
    }
    lines.push("");
  }

  return lines;
}

function buildDocumentationIndexMarkdown(registry, options = {}) {
  const useAiPaths = options.useAiPaths === true;
  const isAiCompanion = options.isAiCompanion === true;
  const title = isAiCompanion ? "AI Companion: Documentation Index View" : "Documentation Index View";
  const sourceGuidePath = isAiCompanion ? "./documentation-registry.ai.md" : "./documentation-registry.md";

  const entriesByRecordId = new Map(registry.entries.map((entry) => [entry.recordId, entry]));
  const totalEntries = registry.entries.length;
  const activeEntries = Array.isArray(registry.discoveryIndex?.byStatus?.active)
    ? registry.discoveryIndex.byStatus.active.length
    : 0;
  const nonActiveEntries = totalEntries - activeEntries;

  const lines = [
    "---",
    `title: ${title}`,
    "doc_type: ai-context",
    "status: active",
    "authoritativeness: canonical",
    "owned_by: team:developer-experience",
    `last_reviewed: ${CURRENT_REVIEW_DATE}`,
    "related_code_paths:",
    `  - ${DEFAULT_REGISTRY_PATH}`,
    "  - dev/scripts/generate-documentation-index-view.cjs",
    "  - dev/tests/DocumentationIndexViewStory631Guardrails.test.ts",
    "  - dev/tests/DocumentationTaskDiscoveryPathsStory632Guardrails.test.ts",
    "  - dev/scripts/validate-docs-foundation.cjs",
    "---",
    "",
    `# ${title} (Story 6.3.1)`,
    "",
    "This index is generated from the machine-readable documentation registry so contributors can browse authoritative docs without manual folder scans.",
    "",
    "## Canonical Sources",
    "",
    `- Machine-readable registry: \`${DEFAULT_REGISTRY_PATH}\``,
    `- Registry guidance: \`${sourceGuidePath}\``,
    "- Generation command: `node dev/scripts/generate-documentation-index-view.cjs`",
    "",
    "## At a Glance",
    "",
    `- Indexed records: **${totalEntries}**`,
    `- Active records: **${activeEntries}**`,
    `- Non-active records: **${nonActiveEntries}**`,
    `- Document types covered: **${(registry.docTypeCatalog || []).length}**`,
    `- Domains covered: **${Object.keys(registry.domainRelationships || {}).length}**`,
    `- Status values covered: **${(registry.statusCatalog || []).length}**`,
    `- Task workflows covered: **${Object.keys(registry.discoveryIndex?.byTaskCategory || {}).length}**`,
    "",
  ];

  lines.push(
    ...buildGroupedSection({
      heading: "## Browse by Document Type",
      groups: registry.discoveryIndex?.byDocType || {},
      keyOrder: registry.docTypeCatalog || [],
      entriesByRecordId,
      useAiPaths,
    }),
  );

  lines.push(
    ...buildTaskWorkflowSection({
      registry,
      entriesByRecordId,
      useAiPaths,
    }),
  );

  lines.push(
    ...buildGroupedSection({
      heading: "## Browse by Domain",
      groups: registry.discoveryIndex?.byDomain || {},
      keyOrder: Object.keys(registry.domainRelationships || {}).sort((left, right) => left.localeCompare(right)),
      entriesByRecordId,
      useAiPaths,
    }),
  );

  lines.push(
    ...buildGroupedSection({
      heading: "## Browse by Status",
      groups: registry.discoveryIndex?.byStatus || {},
      keyOrder: registry.statusCatalog || [],
      entriesByRecordId,
      useAiPaths,
    }),
  );

  lines.push(
    "## Maintenance and Validation",
    "",
    "- Do not manually edit grouped record lists in this file.",
    "- Update `docs/context/documentation-registry.seed.json`, then regenerate this view.",
    "- Validation guardrails:",
    "  - `bun test dev/tests/DocumentationIndexViewStory631Guardrails.test.ts`",
    "  - `npm run docs:validate:foundation`",
    "",
  );

  return `${lines.join("\n")}\n`;
}

function generateDocumentationIndexView(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const registryPath = resolve(repoRoot, options.registryPath || DEFAULT_REGISTRY_PATH);
  const humanOutputPath = resolve(repoRoot, options.humanOutputPath || DEFAULT_HUMAN_OUTPUT_PATH);
  const aiOutputPath = resolve(repoRoot, options.aiOutputPath || DEFAULT_AI_OUTPUT_PATH);

  const registry = readJson(registryPath);
  const humanContent = buildDocumentationIndexMarkdown(registry, { isAiCompanion: false, useAiPaths: false });
  const aiContent = buildDocumentationIndexMarkdown(registry, { isAiCompanion: true, useAiPaths: true });

  if (options.checkOnly) {
    const currentHuman = readFileSync(humanOutputPath, "utf8");
    const currentAi = readFileSync(aiOutputPath, "utf8");
    return {
      matches: currentHuman === humanContent && currentAi === aiContent,
      humanMatches: currentHuman === humanContent,
      aiMatches: currentAi === aiContent,
      humanContent,
      aiContent,
    };
  }

  writeFileSync(humanOutputPath, humanContent, "utf8");
  writeFileSync(aiOutputPath, aiContent, "utf8");

  return { matches: true, humanMatches: true, aiMatches: true, humanContent, aiContent };
}

function parseArgs(argv) {
  return {
    checkOnly: argv.includes("--check"),
  };
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const result = generateDocumentationIndexView({ checkOnly: args.checkOnly });
  if (args.checkOnly) {
    if (!result.matches) {
      if (!result.humanMatches) {
        process.stderr.write(
          "documentation-index.md is out of date. Run: node dev/scripts/generate-documentation-index-view.cjs\n",
        );
      }
      if (!result.aiMatches) {
        process.stderr.write(
          "documentation-index.ai.md is out of date. Run: node dev/scripts/generate-documentation-index-view.cjs\n",
        );
      }
      process.exit(1);
    }
    process.stdout.write("Documentation index view is in sync with the registry.\n");
    process.exit(0);
  }

  process.stdout.write("Generated documentation index view from documentation registry.\n");
}

module.exports = {
  buildDocumentationIndexMarkdown,
  generateDocumentationIndexView,
  toContextRelativePath,
};
