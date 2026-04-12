const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { dirname, relative, resolve } = require("node:path");

const DOCUMENTATION_REGISTRY_PATH = "docs/context/documentation-registry.seed.json";
const ROUTING_SEED_PATH = "docs/context/routing/task-to-context-routing.seed.json";
const ADR_REGISTRY_PATH = "docs/adr/records/adr-registry.json";
const ARCHITECTURE_SUPERSESSION_REGISTRY_PATH = "docs/architecture/architecture-supersession-registry.json";

const HIGH_VALUE_DOC_LINK_DIRECTORIES = [
  "docs/architecture",
  "docs/adr/records",
  "docs/context/routing",
];

const HIGH_VALUE_DOC_LINK_FILES = [
  "docs/context/documentation-index.md",
  "docs/context/documentation-index.ai.md",
  "docs/context/documentation-registry.md",
  "docs/context/documentation-registry.ai.md",
  "docs/context/governance/documentation-quality-standard.md",
  "docs/context/governance/documentation-quality-standard.ai.md",
];

function addIssue(issues, code, message) {
  issues.push({ code, message });
}

function normalizePath(pathValue) {
  return pathValue.replace(/\\/g, "/");
}

function parseArgs(argv) {
  let repoRoot = process.cwd();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      const nextArg = argv[i + 1];
      if (!nextArg) {
        throw new Error("Missing value for --root");
      }
      repoRoot = resolve(nextArg);
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument '${arg}'.`);
  }

  return { repoRoot };
}

function readJson(absolutePath, issues, errorCode, logicalPath) {
  if (!existsSync(absolutePath)) {
    addIssue(issues, errorCode, `Missing required file: ${logicalPath}.`);
    return null;
  }

  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    addIssue(issues, errorCode, `${logicalPath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function collectMarkdownFilesUnderDir(repoRoot, relativeDirPath) {
  const absoluteDirPath = resolve(repoRoot, relativeDirPath);
  if (!existsSync(absoluteDirPath)) {
    return [];
  }

  const files = [];
  const stack = [absoluteDirPath];

  while (stack.length > 0) {
    const currentAbsolutePath = stack.pop();
    const entries = readdirSync(currentAbsolutePath, { withFileTypes: true });
    for (const entry of entries) {
      const entryAbsolutePath = resolve(currentAbsolutePath, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryAbsolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!entry.name.endsWith(".md")) {
        continue;
      }

      files.push(normalizePath(relative(repoRoot, entryAbsolutePath)));
    }
  }

  files.sort();
  return files;
}

function extractMarkdownLinks(markdownContent) {
  const links = [];
  const pattern = /\[[^\]]+\]\(([^)]+)\)/g;
  let match = pattern.exec(markdownContent);
  while (match) {
    links.push(match[1].trim());
    match = pattern.exec(markdownContent);
  }
  return links;
}

function normalizeLocalLink(linkTarget) {
  if (typeof linkTarget !== "string") {
    return "";
  }

  const stripped = linkTarget
    .trim()
    .replace(/^<|>$/g, "")
    .split("#")[0]
    .split("?")[0]
    .trim();

  if (!stripped || stripped.startsWith("#")) {
    return "";
  }

  if (/^[a-z]+:/i.test(stripped)) {
    return "";
  }

  return stripped.replace(/\\/g, "/");
}

function resolveLinkTarget(repoRoot, sourceRelativePath, normalizedTarget) {
  if (normalizedTarget.startsWith("/")) {
    return resolve(repoRoot, normalizedTarget.slice(1));
  }

  if (
    normalizedTarget.startsWith("docs/")
    || normalizedTarget.startsWith("src/")
    || normalizedTarget.startsWith("dev/")
    || normalizedTarget.startsWith("electron/")
    || normalizedTarget.startsWith("user/")
  ) {
    return resolve(repoRoot, normalizedTarget);
  }

  const sourceAbsolutePath = resolve(repoRoot, sourceRelativePath);
  return resolve(dirname(sourceAbsolutePath), normalizedTarget);
}

function toRepoRelative(repoRoot, absolutePath) {
  const normalizedRoot = normalizePath(repoRoot);
  const normalizedAbsolutePath = normalizePath(absolutePath);
  const withTrailingSlash = `${normalizedRoot}/`;
  if (!normalizedAbsolutePath.startsWith(withTrailingSlash)) {
    return "";
  }
  return normalizedAbsolutePath.slice(withTrailingSlash.length);
}

function isDocPath(pathValue) {
  return pathValue.startsWith("docs/");
}

function extractSectionBody(markdownContent, headingText) {
  const normalized = markdownContent.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const expectedHeading = `## ${headingText}`;
  let sectionStartIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() === expectedHeading) {
      sectionStartIndex = index + 1;
      break;
    }
  }

  if (sectionStartIndex === -1) {
    return "";
  }

  const sectionLines = [];
  for (let index = sectionStartIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^##\s+/.test(line) || /^#\s+/.test(line)) {
      break;
    }
    sectionLines.push(line);
  }

  return sectionLines.join("\n");
}

function collectHighValueMarkdownFiles(repoRoot) {
  const collected = new Set();

  for (const directoryPath of HIGH_VALUE_DOC_LINK_DIRECTORIES) {
    for (const markdownPath of collectMarkdownFilesUnderDir(repoRoot, directoryPath)) {
      collected.add(markdownPath);
    }
  }

  for (const filePath of HIGH_VALUE_DOC_LINK_FILES) {
    if (existsSync(resolve(repoRoot, filePath))) {
      collected.add(filePath);
    }
  }

  return [...collected].sort();
}

function validateHighValueDocumentationLinks({ issues, repoRoot }) {
  const markdownFiles = collectHighValueMarkdownFiles(repoRoot);
  const reported = new Set();

  for (const relativePath of markdownFiles) {
    const absolutePath = resolve(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const content = readFileSync(absolutePath, "utf8");
    for (const rawLink of extractMarkdownLinks(content)) {
      const normalizedTarget = normalizeLocalLink(rawLink);
      if (!normalizedTarget) {
        continue;
      }

      const resolvedTarget = resolveLinkTarget(repoRoot, relativePath, normalizedTarget);
      const targetRepoRelative = toRepoRelative(repoRoot, resolvedTarget);
      if (!isDocPath(targetRepoRelative)) {
        continue;
      }

      if (existsSync(resolvedTarget)) {
        continue;
      }

      const reportKey = `${relativePath}::${normalizedTarget}`;
      if (reported.has(reportKey)) {
        continue;
      }
      reported.add(reportKey);
      addIssue(
        issues,
        "DOC_INTERNAL_LINK_BROKEN",
        `${relativePath} references missing documentation path '${normalizedTarget}'.`,
      );
    }
  }

  return markdownFiles.length;
}

function validateArchitectureAdrCrossReferences({
  issues,
  repoRoot,
  adrHumanPaths,
  adrAiPaths,
}) {
  const architectureDocs = collectMarkdownFilesUnderDir(repoRoot, "docs/architecture");
  let checkedReferenceCount = 0;

  for (const relativePath of architectureDocs) {
    const content = readFileSync(resolve(repoRoot, relativePath), "utf8");
    const relatedAdrSection = extractSectionBody(content, "Related ADRs");
    if (!relatedAdrSection.trim()) {
      continue;
    }

    for (const rawLink of extractMarkdownLinks(relatedAdrSection)) {
      const normalizedTarget = normalizeLocalLink(rawLink);
      if (!normalizedTarget) {
        continue;
      }

      const resolvedTarget = resolveLinkTarget(repoRoot, relativePath, normalizedTarget);
      const targetRepoRelative = toRepoRelative(repoRoot, resolvedTarget);
      if (!targetRepoRelative.startsWith("docs/adr/records/adr-")) {
        continue;
      }

      checkedReferenceCount += 1;
      if (!existsSync(resolvedTarget)) {
        addIssue(
          issues,
          "ARCHITECTURE_RELATED_ADR_INVALID",
          `${relativePath} references missing ADR path '${normalizedTarget}' in '## Related ADRs'.`,
        );
        continue;
      }

      const expectedSet = relativePath.endsWith(".ai.md") ? adrAiPaths : adrHumanPaths;
      if (!expectedSet.has(targetRepoRelative)) {
        addIssue(
          issues,
          "ARCHITECTURE_RELATED_ADR_INVALID",
          `${relativePath} references ADR '${targetRepoRelative}' that is not registered in docs/adr/records/adr-registry.json.`,
        );
      }
    }
  }

  return checkedReferenceCount;
}

function normalizeDocPath(pathValue) {
  return pathValue.trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function validateRoutingToRegistryCrossReferences({
  issues,
  repoRoot,
  routingSeed,
  registryRecordIdByDocPath,
  registryRecordIds,
}) {
  const groups = [];
  for (const [index, mapping] of (routingSeed?.mappings || []).entries()) {
    groups.push({
      label: `routing.mappings[${index}] '${mapping?.taskId || "unknown-task-id"}'`,
      docPaths: Array.isArray(mapping?.relatedDocPaths) ? mapping.relatedDocPaths : [],
      recordIds: Array.isArray(mapping?.relatedDocRecordIds) ? mapping.relatedDocRecordIds : [],
    });
  }
  for (const [index, example] of (routingSeed?.routingExamples || []).entries()) {
    groups.push({
      label: `routing.routingExamples[${index}] '${example?.taskId || "unknown-task-id"}'`,
      docPaths: Array.isArray(example?.expectedRelatedDocOrder) ? example.expectedRelatedDocOrder : [],
      recordIds: Array.isArray(example?.relatedDocRecordIds) ? example.relatedDocRecordIds : [],
    });
  }

  let checkedRoutingDocReferences = 0;
  for (const group of groups) {
    const normalizedRecordIds = new Set(
      group.recordIds.filter((value) => typeof value === "string" && value.trim().length > 0),
    );

    for (const rawDocPath of group.docPaths) {
      if (typeof rawDocPath !== "string" || rawDocPath.trim().length === 0) {
        continue;
      }

      const normalizedDocPath = normalizeDocPath(rawDocPath);
      if (!isDocPath(normalizedDocPath)) {
        continue;
      }

      checkedRoutingDocReferences += 1;
      const absoluteDocPath = resolve(repoRoot, normalizedDocPath);
      if (!existsSync(absoluteDocPath)) {
        addIssue(
          issues,
          "ROUTING_DOC_REFERENCE_BROKEN",
          `${group.label} references missing doc path '${normalizedDocPath}'.`,
        );
        continue;
      }

      const indexedRecordId = registryRecordIdByDocPath.get(normalizedDocPath);
      if (indexedRecordId && !normalizedRecordIds.has(indexedRecordId)) {
        addIssue(
          issues,
          "ROUTING_RELATED_RECORD_MISSING",
          `${group.label} references indexed doc path '${normalizedDocPath}' but is missing relatedDocRecordId '${indexedRecordId}'.`,
        );
      }
    }

    for (const recordId of normalizedRecordIds) {
      if (!registryRecordIds.has(recordId)) {
        addIssue(
          issues,
          "ROUTING_RELATED_RECORD_UNKNOWN",
          `${group.label} references unknown relatedDocRecordId '${recordId}'.`,
        );
      }
    }
  }

  return checkedRoutingDocReferences;
}

function validateDocumentationIndexCrossReferences({
  issues,
  repoRoot,
  registryEntryByRecordId,
}) {
  const indexFiles = [
    "docs/context/documentation-index.md",
    "docs/context/documentation-index.ai.md",
  ];

  const linePattern = /- \[[^\]]+\]\(([^)]+)\)\s+\(`(doc-[a-z0-9]+(?:-[a-z0-9]+)*)`\)/g;
  let checkedIndexReferences = 0;

  for (const indexPath of indexFiles) {
    const absolutePath = resolve(repoRoot, indexPath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const content = readFileSync(absolutePath, "utf8");
    linePattern.lastIndex = 0;
    let match = linePattern.exec(content);
    while (match) {
      const linkTarget = normalizeLocalLink(match[1]);
      const recordId = match[2];
      checkedIndexReferences += 1;

      const registryEntry = registryEntryByRecordId.get(recordId);
      if (!registryEntry) {
        addIssue(
          issues,
          "INDEX_RECORD_REFERENCE_INVALID",
          `${indexPath} references unknown recordId '${recordId}'.`,
        );
        match = linePattern.exec(content);
        continue;
      }

      const resolvedTarget = resolveLinkTarget(repoRoot, indexPath, linkTarget);
      if (!existsSync(resolvedTarget)) {
        addIssue(
          issues,
          "INDEX_RECORD_REFERENCE_INVALID",
          `${indexPath} references missing path '${linkTarget}' for recordId '${recordId}'.`,
        );
        match = linePattern.exec(content);
        continue;
      }

      const resolvedRepoPath = toRepoRelative(repoRoot, resolvedTarget);
      const expectedPath = indexPath.endsWith(".ai.md")
        ? (registryEntry.aiPath || registryEntry.path)
        : registryEntry.path;

      if (normalizeDocPath(expectedPath || "") !== normalizeDocPath(resolvedRepoPath)) {
        addIssue(
          issues,
          "INDEX_RECORD_LINK_MISMATCH",
          `${indexPath} links '${resolvedRepoPath}' for '${recordId}', expected '${expectedPath}'.`,
        );
      }

      match = linePattern.exec(content);
    }
  }

  return checkedIndexReferences;
}

function validateSupersessionRegistryAlignment({
  issues,
  documentationRegistry,
  supersessionRegistry,
}) {
  const supersessionBySourcePath = new Map();
  for (const entry of supersessionRegistry?.supersededDocuments || []) {
    const sourcePath = typeof entry?.sourcePath === "string" ? normalizeDocPath(entry.sourcePath) : "";
    if (!sourcePath) {
      continue;
    }
    supersessionBySourcePath.set(sourcePath, entry);
  }

  let checkedSupersededRecords = 0;
  for (const entry of documentationRegistry?.entries || []) {
    if (entry?.status !== "superseded") {
      continue;
    }
    checkedSupersededRecords += 1;

    const sourcePath = normalizeDocPath(entry.path || "");
    if (!sourcePath) {
      addIssue(
        issues,
        "SUPERSESSION_REGISTRY_ALIGNMENT_INVALID",
        `Superseded registry record '${entry.recordId || "<unknown>"}' is missing path.`,
      );
      continue;
    }

    const supersessionEntry = supersessionBySourcePath.get(sourcePath);
    if (!supersessionEntry) {
      addIssue(
        issues,
        "SUPERSESSION_REGISTRY_ALIGNMENT_INVALID",
        `Superseded registry record '${entry.recordId || "<unknown>"}' path '${sourcePath}' is missing in docs/architecture/architecture-supersession-registry.json.`,
      );
      continue;
    }

    const registrySupersededBy = normalizeDocPath(entry.supersededBy || "");
    const supersessionSupersededBy = normalizeDocPath(supersessionEntry.supersededBy || "");
    if (!registrySupersededBy || !supersessionSupersededBy) {
      addIssue(
        issues,
        "SUPERSESSION_REGISTRY_ALIGNMENT_INVALID",
        `Superseded path '${sourcePath}' must set superseded target in both registries.`,
      );
      continue;
    }

    if (registrySupersededBy !== supersessionSupersededBy) {
      addIssue(
        issues,
        "SUPERSESSION_REGISTRY_ALIGNMENT_INVALID",
        `Superseded path '${sourcePath}' target mismatch: documentation-registry uses '${registrySupersededBy}', architecture supersession registry uses '${supersessionSupersededBy}'.`,
      );
    }
  }

  return checkedSupersededRecords;
}

function validateDocsCrossReferences(repoRoot) {
  const issues = [];

  const registryAbsolutePath = resolve(repoRoot, DOCUMENTATION_REGISTRY_PATH);
  const routingSeedAbsolutePath = resolve(repoRoot, ROUTING_SEED_PATH);
  const adrRegistryAbsolutePath = resolve(repoRoot, ADR_REGISTRY_PATH);
  const supersessionRegistryAbsolutePath = resolve(repoRoot, ARCHITECTURE_SUPERSESSION_REGISTRY_PATH);

  const documentationRegistry = readJson(
    registryAbsolutePath,
    issues,
    "CROSS_REFERENCE_SOURCE_INVALID",
    DOCUMENTATION_REGISTRY_PATH,
  );
  const routingSeed = readJson(
    routingSeedAbsolutePath,
    issues,
    "CROSS_REFERENCE_SOURCE_INVALID",
    ROUTING_SEED_PATH,
  );
  const adrRegistry = readJson(
    adrRegistryAbsolutePath,
    issues,
    "CROSS_REFERENCE_SOURCE_INVALID",
    ADR_REGISTRY_PATH,
  );
  const supersessionRegistry = readJson(
    supersessionRegistryAbsolutePath,
    issues,
    "CROSS_REFERENCE_SOURCE_INVALID",
    ARCHITECTURE_SUPERSESSION_REGISTRY_PATH,
  );

  if (!documentationRegistry || !routingSeed || !adrRegistry || !supersessionRegistry) {
    return {
      issues,
      checkedMarkdownFiles: 0,
      checkedArchitectureAdrReferences: 0,
      checkedRoutingDocReferences: 0,
      checkedIndexReferences: 0,
      checkedSupersededRecords: 0,
    };
  }

  const registryEntryByRecordId = new Map();
  const registryRecordIdByDocPath = new Map();
  const registryRecordIds = new Set();
  for (const entry of documentationRegistry.entries || []) {
    if (typeof entry?.recordId === "string" && entry.recordId.trim().length > 0) {
      registryEntryByRecordId.set(entry.recordId, entry);
      registryRecordIds.add(entry.recordId);
    }

    if (typeof entry?.path === "string" && entry.path.trim().length > 0) {
      registryRecordIdByDocPath.set(normalizeDocPath(entry.path), entry.recordId);
    }
    if (typeof entry?.aiPath === "string" && entry.aiPath.trim().length > 0) {
      registryRecordIdByDocPath.set(normalizeDocPath(entry.aiPath), entry.recordId);
    }
  }

  const adrHumanPaths = new Set();
  const adrAiPaths = new Set();
  for (const record of adrRegistry.records || []) {
    if (typeof record?.humanDocPath === "string" && record.humanDocPath.trim().length > 0) {
      adrHumanPaths.add(normalizeDocPath(record.humanDocPath));
    }
    if (typeof record?.aiDocPath === "string" && record.aiDocPath.trim().length > 0) {
      adrAiPaths.add(normalizeDocPath(record.aiDocPath));
    }
  }

  const checkedMarkdownFiles = validateHighValueDocumentationLinks({ issues, repoRoot });
  const checkedArchitectureAdrReferences = validateArchitectureAdrCrossReferences({
    issues,
    repoRoot,
    adrHumanPaths,
    adrAiPaths,
  });
  const checkedRoutingDocReferences = validateRoutingToRegistryCrossReferences({
    issues,
    repoRoot,
    routingSeed,
    registryRecordIdByDocPath,
    registryRecordIds,
  });
  const checkedIndexReferences = validateDocumentationIndexCrossReferences({
    issues,
    repoRoot,
    registryEntryByRecordId,
  });
  const checkedSupersededRecords = validateSupersessionRegistryAlignment({
    issues,
    documentationRegistry,
    supersessionRegistry,
  });

  return {
    issues,
    checkedMarkdownFiles,
    checkedArchitectureAdrReferences,
    checkedRoutingDocReferences,
    checkedIndexReferences,
    checkedSupersededRecords,
  };
}

function main() {
  let repoRoot;
  try {
    ({ repoRoot } = parseArgs(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`Argument error: ${error.message}\n`);
    process.exit(2);
  }

  const {
    issues,
    checkedMarkdownFiles,
    checkedArchitectureAdrReferences,
    checkedRoutingDocReferences,
    checkedIndexReferences,
    checkedSupersededRecords,
  } = validateDocsCrossReferences(repoRoot);

  if (issues.length > 0) {
    process.stderr.write("Documentation cross-reference validation failed.\n");
    for (const issue of issues) {
      process.stderr.write(`- [${issue.code}] ${issue.message}\n`);
    }
    process.stderr.write(`Total issues: ${issues.length}\n`);
    process.exit(1);
  }

  process.stdout.write([
    "Documentation cross-reference validation passed.",
    `Checked high-value markdown docs for internal documentation link validity: ${checkedMarkdownFiles}`,
    `Checked architecture Related ADR references: ${checkedArchitectureAdrReferences}`,
    `Checked routing doc references against registry record IDs: ${checkedRoutingDocReferences}`,
    `Checked documentation-index record/link alignment: ${checkedIndexReferences}`,
    `Checked superseded registry alignment with architecture supersession registry: ${checkedSupersededRecords}`,
  ].join("\n") + "\n");
}

main();
