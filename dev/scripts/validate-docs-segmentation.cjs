const { existsSync, readFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");

const STATUS_SIGNAL_ANCHOR_DOCS = [
  "docs/baselines/README.md",
  "docs/baselines/README.ai.md",
  "docs/baselines/architecture/README.md",
  "docs/baselines/architecture/README.ai.md",
  "docs/documentation-migration-baseline.md",
  "docs/documentation-migration-baseline.ai.md",
  "docs/documentation-segmentation-migration-inventory.md",
  "docs/documentation-segmentation-migration-inventory.ai.md",
];

const REQUIRED_STATUS_SIGNAL_MARKERS = [
  "## Documentation Status",
  "Lifecycle status (`status`):",
  "Authority state (`authoritativeness`):",
  "Current guidance stance:",
  "Canonical active path(s):",
];

const ACTIVE_PATH_DOCS = [
  "docs/README.md",
  "docs/README.ai.md",
  "docs/architecture/README.md",
  "docs/architecture/README.ai.md",
  "docs/contributors/README.md",
  "docs/contributors/README.ai.md",
  "docs/operations/README.md",
  "docs/operations/README.ai.md",
  "docs/context/README.md",
  "docs/context/README.ai.md",
  "docs/ui/README.md",
  "docs/ui/README.ai.md",
  "docs/prompts/README.md",
  "docs/prompts/README.ai.md",
  "docs/adr/README.md",
  "docs/adr/README.ai.md",
];

const SEGMENTATION_INVENTORY_PATH = "docs/documentation-segmentation-migration-inventory.inventory.json";
const SUPERSESSION_REGISTRY_PATH = "docs/architecture/architecture-supersession-registry.json";
const SEGMENTATION_CATEGORIES = new Set([
  "mixed-purpose",
  "historical",
  "baseline-candidate",
  "transitional",
  "superseded",
]);

function normalizePath(pathValue) {
  return pathValue.replace(/\\/g, "/");
}

function addIssue(issues, code, message) {
  issues.push({ code, message });
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
    }
  }

  return { repoRoot };
}

function readJson(pathValue) {
  return JSON.parse(readFileSync(pathValue, "utf8"));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseFrontmatter(markdownContent) {
  const normalized = markdownContent.replace(/\r\n/g, "\n");

  if (!normalized.startsWith("---\n")) {
    throw new Error("missing opening frontmatter delimiter");
  }

  const closingDelimiterIndex = normalized.indexOf("\n---\n", 4);
  if (closingDelimiterIndex === -1) {
    throw new Error("missing closing frontmatter delimiter");
  }

  const frontmatterText = normalized.slice(4, closingDelimiterIndex);
  const parsed = {};
  let currentArrayKey = null;

  for (const line of frontmatterText.split("\n")) {
    if (line.trim().length === 0) {
      currentArrayKey = null;
      continue;
    }

    const keyValueMatch = line.match(/^([a-z_]+):\s*(.*)$/);
    if (keyValueMatch) {
      const key = keyValueMatch[1];
      const value = keyValueMatch[2];
      if (value.length === 0) {
        parsed[key] = [];
        currentArrayKey = key;
      } else {
        parsed[key] = value;
        currentArrayKey = null;
      }
      continue;
    }

    const arrayMatch = line.match(/^\s*-\s+(.+)$/);
    if (arrayMatch && currentArrayKey) {
      const currentValue = parsed[currentArrayKey];
      if (!Array.isArray(currentValue)) {
        throw new Error(`frontmatter key ${currentArrayKey} is not an array`);
      }
      currentValue.push(arrayMatch[1]);
      continue;
    }

    throw new Error(`unsupported frontmatter line: ${line}`);
  }

  return parsed;
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

function validateStatusSignals({ issues, repoRoot }) {
  for (const relativePath of STATUS_SIGNAL_ANCHOR_DOCS) {
    const absolutePath = resolve(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
      addIssue(
        issues,
        "STATUS_SIGNAL_DOC_MISSING",
        `Missing required status-signal anchor doc: ${relativePath}`,
      );
      continue;
    }

    const content = readFileSync(absolutePath, "utf8");
    for (const marker of REQUIRED_STATUS_SIGNAL_MARKERS) {
      if (!content.includes(marker)) {
        addIssue(
          issues,
          "STATUS_SIGNAL_MARKER_MISSING",
          `${relativePath} is missing required status marker '${marker}'.`,
        );
      }
    }
  }
}

function validateSegmentationInventory({ issues, repoRoot }) {
  const inventoryPath = resolve(repoRoot, SEGMENTATION_INVENTORY_PATH);
  if (!existsSync(inventoryPath)) {
    addIssue(
      issues,
      "SEGMENTATION_INVENTORY_MISSING",
      `Missing segmentation inventory: ${SEGMENTATION_INVENTORY_PATH}`,
    );
    return;
  }

  let inventory;
  try {
    inventory = readJson(inventoryPath);
  } catch (error) {
    addIssue(
      issues,
      "SEGMENTATION_INVENTORY_INVALID",
      `${SEGMENTATION_INVENTORY_PATH} is not valid JSON: ${error.message}`,
    );
    return;
  }

  if (inventory.schemaVersion !== "1.0.0") {
    addIssue(
      issues,
      "SEGMENTATION_INVENTORY_INVALID",
      `${SEGMENTATION_INVENTORY_PATH} must declare schemaVersion 1.0.0.`,
    );
  }

  if (!Array.isArray(inventory.candidates) || inventory.candidates.length === 0) {
    addIssue(
      issues,
      "SEGMENTATION_INVENTORY_INVALID",
      `${SEGMENTATION_INVENTORY_PATH} must include non-empty candidates.`,
    );
    return;
  }

  for (const candidate of inventory.candidates) {
    const candidateId = isNonEmptyString(candidate?.id) ? candidate.id : "<unknown-id>";
    const candidatePath = candidate?.path;
    if (!isNonEmptyString(candidatePath)) {
      addIssue(
        issues,
        "SEGMENTATION_INVENTORY_INVALID",
        `Candidate '${candidateId}' is missing path.`,
      );
      continue;
    }

    if (!SEGMENTATION_CATEGORIES.has(candidate.category)) {
      addIssue(
        issues,
        "SEGMENTATION_INVENTORY_INVALID",
        `Candidate '${candidateId}' has unsupported category '${candidate.category}'.`,
      );
    }

    const sourceAbsolutePath = resolve(repoRoot, candidatePath);
    if (!existsSync(sourceAbsolutePath)) {
      addIssue(
        issues,
        "SEGMENTATION_SOURCE_MISSING",
        `Candidate '${candidateId}' source path is missing: ${candidatePath}`,
      );
      continue;
    }

    if (candidate.companionPath !== null && candidate.companionPath !== undefined) {
      if (!isNonEmptyString(candidate.companionPath)) {
        addIssue(
          issues,
          "SEGMENTATION_INVENTORY_INVALID",
          `Candidate '${candidateId}' has invalid companionPath.`,
        );
      } else if (!existsSync(resolve(repoRoot, candidate.companionPath))) {
        addIssue(
          issues,
          "SEGMENTATION_COMPANION_MISSING",
          `Candidate '${candidateId}' companion path is missing: ${candidate.companionPath}`,
        );
      }
    }

    const action = candidate.recommendedAction || {};
    if (!isNonEmptyString(action.type)) {
      addIssue(
        issues,
        "SEGMENTATION_INVENTORY_INVALID",
        `Candidate '${candidateId}' is missing recommendedAction.type.`,
      );
    }

    const categoryRequiresBaselineDestination = candidate.category !== "superseded";
    if (categoryRequiresBaselineDestination) {
      if (!isNonEmptyString(action.targetHistoricalPath) || !action.targetHistoricalPath.startsWith("docs/baselines/")) {
        addIssue(
          issues,
          "BASELINE_DESTINATION_INVALID",
          `Candidate '${candidateId}' must target docs/baselines/ for historical placement.`,
        );
      }
    }

    let frontmatter;
    try {
      frontmatter = parseFrontmatter(readFileSync(sourceAbsolutePath, "utf8"));
    } catch (error) {
      addIssue(
        issues,
        "SEGMENTATION_FRONTMATTER_INVALID",
        `${candidatePath}: ${error.message}`,
      );
      continue;
    }

    if (frontmatter.status === "superseded") {
      if (!isNonEmptyString(frontmatter.superseded_by)) {
        addIssue(
          issues,
          "SEGMENTATION_SUPERSESSION_LINK_MISSING",
          `${candidatePath} is superseded but missing superseded_by.`,
        );
      } else if (!existsSync(resolve(repoRoot, frontmatter.superseded_by))) {
        addIssue(
          issues,
          "SEGMENTATION_SUPERSESSION_LINK_INVALID",
          `${candidatePath} superseded_by target is missing: ${frontmatter.superseded_by}`,
        );
      }
    }
  }
}

function validateSupersessionRegistry({ issues, repoRoot }) {
  const registryPath = resolve(repoRoot, SUPERSESSION_REGISTRY_PATH);
  if (!existsSync(registryPath)) {
    addIssue(
      issues,
      "SUPERSESSION_REGISTRY_MISSING",
      `Missing supersession registry: ${SUPERSESSION_REGISTRY_PATH}`,
    );
    return { supersededPaths: new Set() };
  }

  let registry;
  try {
    registry = readJson(registryPath);
  } catch (error) {
    addIssue(
      issues,
      "SUPERSESSION_REGISTRY_INVALID",
      `${SUPERSESSION_REGISTRY_PATH} is not valid JSON: ${error.message}`,
    );
    return { supersededPaths: new Set() };
  }

  if (registry.schemaVersion !== "1.0.0") {
    addIssue(
      issues,
      "SUPERSESSION_REGISTRY_INVALID",
      `${SUPERSESSION_REGISTRY_PATH} must declare schemaVersion 1.0.0.`,
    );
  }

  if (!Array.isArray(registry.supersededDocuments) || registry.supersededDocuments.length === 0) {
    addIssue(
      issues,
      "SUPERSESSION_REGISTRY_INVALID",
      `${SUPERSESSION_REGISTRY_PATH} must include non-empty supersededDocuments.`,
    );
    return { supersededPaths: new Set() };
  }

  const supersededPaths = new Set();
  for (const entry of registry.supersededDocuments) {
    const sourcePath = entry?.sourcePath;
    if (!isNonEmptyString(sourcePath)) {
      addIssue(
        issues,
        "SUPERSESSION_REGISTRY_INVALID",
        `${SUPERSESSION_REGISTRY_PATH} has superseded entry missing sourcePath.`,
      );
      continue;
    }
    supersededPaths.add(normalizePath(sourcePath));

    const sourceAbsolutePath = resolve(repoRoot, sourcePath);
    if (!existsSync(sourceAbsolutePath)) {
      addIssue(
        issues,
        "SUPERSESSION_SOURCE_MISSING",
        `Superseded source path is missing: ${sourcePath}`,
      );
      continue;
    }

    const supersededByPath = entry?.supersededBy;
    if (!isNonEmptyString(supersededByPath)) {
      addIssue(
        issues,
        "SUPERSESSION_REGISTRY_INVALID",
        `Superseded entry '${sourcePath}' is missing supersededBy.`,
      );
      continue;
    }

    const supersededByAbsolutePath = resolve(repoRoot, supersededByPath);
    if (!existsSync(supersededByAbsolutePath)) {
      addIssue(
        issues,
        "SUPERSESSION_DESTINATION_INVALID",
        `Superseded destination is missing: ${supersededByPath} (from ${sourcePath})`,
      );
    }

    let frontmatter;
    let sourceContent;
    try {
      sourceContent = readFileSync(sourceAbsolutePath, "utf8");
      frontmatter = parseFrontmatter(sourceContent);
    } catch (error) {
      addIssue(
        issues,
        "SUPERSESSION_FRONTMATTER_INVALID",
        `${sourcePath}: ${error.message}`,
      );
      continue;
    }

    if (frontmatter.status !== "superseded") {
      addIssue(
        issues,
        "SUPERSESSION_STATUS_INVALID",
        `${sourcePath} must set status: superseded.`,
      );
    }

    if (frontmatter.authoritativeness !== "historical") {
      addIssue(
        issues,
        "SUPERSESSION_AUTHORITY_INVALID",
        `${sourcePath} must set authoritativeness: historical.`,
      );
    }

    if (frontmatter.superseded_by !== supersededByPath) {
      addIssue(
        issues,
        "SUPERSESSION_METADATA_MISMATCH",
        `${sourcePath} superseded_by must match registry supersededBy '${supersededByPath}'.`,
      );
    }

    for (const marker of ["## Supersession Notice", "## Redirect"]) {
      if (!sourceContent.includes(marker)) {
        addIssue(
          issues,
          "SUPERSESSION_SECTION_MISSING",
          `${sourcePath} is missing required section '${marker}'.`,
        );
      }
    }
  }

  return { supersededPaths };
}

function validateActivePathLinks({ issues, repoRoot, supersededPaths }) {
  for (const relativePath of ACTIVE_PATH_DOCS) {
    const absolutePath = resolve(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
      addIssue(
        issues,
        "ACTIVE_PATH_DOC_MISSING",
        `Missing active-path router doc: ${relativePath}`,
      );
      continue;
    }

    const content = readFileSync(absolutePath, "utf8");
    const links = extractMarkdownLinks(content);
    const reported = new Set();

    for (const linkTarget of links) {
      const normalizedTarget = normalizeLocalLink(linkTarget);
      if (!normalizedTarget) {
        continue;
      }
      const resolvedPath = resolveLinkTarget(repoRoot, relativePath, normalizedTarget);
      const repoRelativePath = normalizePath(resolvedPath).slice(normalizePath(repoRoot).length + 1);

      if (supersededPaths.has(repoRelativePath)) {
        const key = `${relativePath}::${repoRelativePath}`;
        if (reported.has(key)) {
          continue;
        }
        reported.add(key);
        addIssue(
          issues,
          "ACTIVE_PATH_REFERENCE_INVALID",
          `${relativePath} links to superseded path '${repoRelativePath}'. Link to canonical replacement instead.`,
        );
      }
    }
  }
}

function validateDocsSegmentation(repoRoot) {
  const issues = [];

  validateStatusSignals({ issues, repoRoot });
  validateSegmentationInventory({ issues, repoRoot });
  const { supersededPaths } = validateSupersessionRegistry({ issues, repoRoot });
  validateActivePathLinks({ issues, repoRoot, supersededPaths });

  return { issues, supersededPathCount: supersededPaths.size };
}

function main() {
  let repoRoot;
  try {
    ({ repoRoot } = parseArgs(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`Argument error: ${error.message}\n`);
    process.exit(2);
  }

  const { issues, supersededPathCount } = validateDocsSegmentation(repoRoot);

  if (issues.length > 0) {
    process.stderr.write("Docs segmentation validation failed.\n");
    for (const issue of issues) {
      process.stderr.write(`- [${issue.code}] ${issue.message}\n`);
    }
    process.stderr.write(`Total issues: ${issues.length}\n`);
    process.exit(1);
  }

  process.stdout.write([
    "Docs segmentation validation passed.",
    `Checked status-signal anchor docs: ${STATUS_SIGNAL_ANCHOR_DOCS.length}`,
    "Checked segmentation inventory category and baseline-destination invariants.",
    `Checked supersession registry entries: ${supersededPathCount}`,
    `Checked active router docs for invalid superseded links: ${ACTIVE_PATH_DOCS.length}`,
  ].join("\n") + "\n");
}

main();
