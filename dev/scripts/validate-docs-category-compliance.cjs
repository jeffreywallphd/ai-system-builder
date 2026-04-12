const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const DOCUMENTATION_REGISTRY_PATH = "docs/context/documentation-registry.seed.json";
const ADR_REGISTRY_PATH = "docs/adr/records/adr-registry.json";
const ROUTING_SEED_PATH = "docs/context/routing/task-to-context-routing.seed.json";

const ADR_HUMAN_PATH_PATTERN = /^docs\/adr\/records\/adr-\d{3}-.+\.md$/;
const ADR_AI_PATH_PATTERN = /^docs\/adr\/records\/adr-\d{3}-.+\.ai\.md$/;
const BASELINE_ALLOWED_STATUSES = new Set(["active", "archived"]);
const ADR_ALLOWED_STATUSES = new Set(["active", "superseded", "deprecated"]);
const NON_ACTIVE_STATUSES = new Set(["superseded", "deprecated", "archived"]);
const ALLOWED_BASELINE_OUTSIDE_PATHS = new Set([
  "docs/documentation-migration-baseline.md",
  "docs/documentation-segmentation-migration-inventory.md",
]);

function isAdrHumanPath(pathValue) {
  return ADR_HUMAN_PATH_PATTERN.test(pathValue) && !pathValue.endsWith(".ai.md");
}

function addIssue(issues, code, message) {
  issues.push({ code, message });
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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

function readJson(repoRoot, relativePath, issues, code) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    addIssue(issues, code, `Missing required file: ${relativePath}.`);
    return null;
  }

  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    addIssue(issues, code, `${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function normalizePath(pathValue) {
  return pathValue.trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function collectRoutingDocReferences(routingSeed) {
  const references = new Set();

  for (const mapping of routingSeed?.mappings || []) {
    for (const pathValue of mapping?.relatedDocPaths || []) {
      if (isNonEmptyString(pathValue)) {
        references.add(normalizePath(pathValue));
      }
    }
  }

  for (const example of routingSeed?.routingExamples || []) {
    for (const pathValue of example?.expectedRelatedDocOrder || []) {
      if (isNonEmptyString(pathValue)) {
        references.add(normalizePath(pathValue));
      }
    }
  }

  return references;
}

function collectRoutingRecordReferences(routingSeed) {
  const references = new Set();

  for (const mapping of routingSeed?.mappings || []) {
    for (const recordId of mapping?.relatedDocRecordIds || []) {
      if (isNonEmptyString(recordId)) {
        references.add(recordId.trim());
      }
    }
  }

  for (const example of routingSeed?.routingExamples || []) {
    for (const recordId of example?.relatedDocRecordIds || []) {
      if (isNonEmptyString(recordId)) {
        references.add(recordId.trim());
      }
    }
  }

  return references;
}

function validateAdrPlacement({ issues, registryEntries, adrRegistry }) {
  const registryByPath = new Map();
  for (const entry of registryEntries) {
    if (isNonEmptyString(entry?.path)) {
      registryByPath.set(normalizePath(entry.path), entry);
    }
    if (isNonEmptyString(entry?.aiPath)) {
      registryByPath.set(normalizePath(entry.aiPath), entry);
    }
  }

  const adrHumanPaths = new Set();
  const adrAiPaths = new Set();
  for (const record of adrRegistry?.records || []) {
    if (isNonEmptyString(record?.humanDocPath)) {
      adrHumanPaths.add(normalizePath(record.humanDocPath));
    }
    if (isNonEmptyString(record?.aiDocPath)) {
      adrAiPaths.add(normalizePath(record.aiDocPath));
    }
  }

  let checkedAdrEntries = 0;
  for (const entry of registryEntries) {
    const entryId = isNonEmptyString(entry?.recordId) ? entry.recordId : "<unknown-record-id>";
    const normalizedPath = isNonEmptyString(entry?.path) ? normalizePath(entry.path) : "";
    const normalizedAiPath = isNonEmptyString(entry?.aiPath) ? normalizePath(entry.aiPath) : "";

    if (entry?.docType === "adr") {
      checkedAdrEntries += 1;

      if (!isAdrHumanPath(normalizedPath)) {
        addIssue(
          issues,
          "CATEGORY_ADR_PATH_INVALID",
          `Registry ADR '${entryId}' must use docs/adr/records/adr-###-*.md path, found '${entry.path}'.`,
        );
      }
      if (!ADR_AI_PATH_PATTERN.test(normalizedAiPath)) {
        addIssue(
          issues,
          "CATEGORY_ADR_PATH_INVALID",
          `Registry ADR '${entryId}' must use docs/adr/records/adr-###-*.ai.md aiPath, found '${entry.aiPath}'.`,
        );
      }
      if (isNonEmptyString(entry?.status) && !ADR_ALLOWED_STATUSES.has(entry.status)) {
        addIssue(
          issues,
          "CATEGORY_ADR_STATUS_INVALID",
          `Registry ADR '${entryId}' has unsupported lifecycle status '${entry.status}'.`,
        );
      }
      if (isNonEmptyString(entry?.status) && entry.status !== "active" && entry.authoritativeness !== "historical") {
        addIssue(
          issues,
          "CATEGORY_ADR_AUTHORITY_INVALID",
          `Registry ADR '${entryId}' with status '${entry.status}' must use authoritativeness 'historical'.`,
        );
      }
      if (isNonEmptyString(normalizedPath) && !adrHumanPaths.has(normalizedPath)) {
        addIssue(
          issues,
          "CATEGORY_ADR_REGISTRY_MISMATCH",
          `Registry ADR '${entryId}' path '${entry.path}' is missing from docs/adr/records/adr-registry.json humanDocPath list.`,
        );
      }
      if (isNonEmptyString(normalizedAiPath) && !adrAiPaths.has(normalizedAiPath)) {
        addIssue(
          issues,
          "CATEGORY_ADR_REGISTRY_MISMATCH",
          `Registry ADR '${entryId}' aiPath '${entry.aiPath}' is missing from docs/adr/records/adr-registry.json aiDocPath list.`,
        );
      }
    }

    if (isNonEmptyString(normalizedPath) && isAdrHumanPath(normalizedPath) && entry?.docType !== "adr") {
      addIssue(
        issues,
        "CATEGORY_ADR_PATH_DOC_TYPE_MISMATCH",
        `Registry entry '${entryId}' uses ADR path '${entry.path}' but docType is '${entry?.docType}'.`,
      );
    }

    if (isNonEmptyString(normalizedAiPath) && ADR_AI_PATH_PATTERN.test(normalizedAiPath) && entry?.docType !== "adr") {
      addIssue(
        issues,
        "CATEGORY_ADR_PATH_DOC_TYPE_MISMATCH",
        `Registry entry '${entryId}' uses ADR aiPath '${entry.aiPath}' but docType is '${entry?.docType}'.`,
      );
    }
  }

  for (const record of adrRegistry?.records || []) {
    const identifier = isNonEmptyString(record?.identifier) ? record.identifier : "<unknown-adr-identifier>";
    const humanPath = isNonEmptyString(record?.humanDocPath) ? normalizePath(record.humanDocPath) : "";
    const aiPath = isNonEmptyString(record?.aiDocPath) ? normalizePath(record.aiDocPath) : "";

    for (const [kind, pathValue] of [["humanDocPath", humanPath], ["aiDocPath", aiPath]]) {
      if (!isNonEmptyString(pathValue)) {
        continue;
      }

      const registryEntry = registryByPath.get(pathValue);
      if (!registryEntry) {
        addIssue(
          issues,
          "CATEGORY_ADR_REGISTRY_MISMATCH",
          `ADR registry record '${identifier}' ${kind} '${pathValue}' is missing from documentation registry entries.`,
        );
        continue;
      }

      if (registryEntry.docType !== "adr") {
        addIssue(
          issues,
          "CATEGORY_ADR_REGISTRY_MISMATCH",
          `ADR registry record '${identifier}' ${kind} '${pathValue}' maps to non-ADR docType '${registryEntry.docType}'.`,
        );
      }
    }
  }

  return checkedAdrEntries;
}

function validateBaselineHistoricalExpectations({ issues, registryEntries }) {
  let checkedBaselineEntries = 0;

  for (const entry of registryEntries) {
    const entryId = isNonEmptyString(entry?.recordId) ? entry.recordId : "<unknown-record-id>";
    const normalizedPath = isNonEmptyString(entry?.path) ? normalizePath(entry.path) : "";
    const isBaselinePath = normalizedPath.startsWith("docs/baselines/");
    const isBaselineDocType = entry?.docType === "baseline";

    if (isBaselinePath || isBaselineDocType) {
      checkedBaselineEntries += 1;

      if (isBaselinePath && entry?.docType !== "baseline") {
        addIssue(
          issues,
          "CATEGORY_BASELINE_DOC_TYPE_INVALID",
          `Registry entry '${entryId}' under docs/baselines/ must use docType 'baseline'.`,
        );
      }

      if (
        isBaselineDocType
        && !isBaselinePath
        && !ALLOWED_BASELINE_OUTSIDE_PATHS.has(normalizedPath)
      ) {
        addIssue(
          issues,
          "CATEGORY_BASELINE_PATH_INVALID",
          `Baseline registry entry '${entryId}' must live in docs/baselines/ or approved baseline anchor paths. Found '${entry.path}'.`,
        );
      }

      if (entry?.authoritativeness !== "historical") {
        addIssue(
          issues,
          "CATEGORY_BASELINE_AUTHORITY_INVALID",
          `Baseline registry entry '${entryId}' must use authoritativeness 'historical'.`,
        );
      }

      if (!BASELINE_ALLOWED_STATUSES.has(entry?.status)) {
        addIssue(
          issues,
          "CATEGORY_BASELINE_STATUS_INVALID",
          `Baseline registry entry '${entryId}' must use status active|archived; found '${entry?.status}'.`,
        );
      }
    }

    if (NON_ACTIVE_STATUSES.has(entry?.status) && entry?.authoritativeness !== "historical") {
      addIssue(
        issues,
        "CATEGORY_HISTORICAL_AUTHORITY_INVALID",
        `Non-active registry entry '${entryId}' with status '${entry?.status}' must use authoritativeness 'historical'.`,
      );
    }
  }

  return checkedBaselineEntries;
}

function validateRoutingReferences({ issues, routingSeed, registryEntries }) {
  const registryByPath = new Map();
  const registryByRecordId = new Map();

  for (const entry of registryEntries) {
    if (isNonEmptyString(entry?.recordId)) {
      registryByRecordId.set(entry.recordId.trim(), entry);
    }
    if (isNonEmptyString(entry?.path)) {
      registryByPath.set(normalizePath(entry.path), entry);
    }
    if (isNonEmptyString(entry?.aiPath)) {
      registryByPath.set(normalizePath(entry.aiPath), entry);
    }
  }

  const routingDocReferences = collectRoutingDocReferences(routingSeed);
  const routingRecordReferences = collectRoutingRecordReferences(routingSeed);

  for (const referencedPath of routingDocReferences) {
    const entry = registryByPath.get(referencedPath);
    if (!entry) {
      continue;
    }

    const entryId = isNonEmptyString(entry?.recordId) ? entry.recordId : referencedPath;
    if (entry.status !== "active") {
      addIssue(
        issues,
        "CATEGORY_ROUTING_STATUS_INVALID",
        `Routing reference '${referencedPath}' points to non-active registry record '${entryId}' with status '${entry.status}'.`,
      );
    }
    if (entry.authoritativeness === "historical") {
      addIssue(
        issues,
        "CATEGORY_ROUTING_AUTHORITY_INVALID",
        `Routing reference '${referencedPath}' points to historical registry record '${entryId}'.`,
      );
    }
  }

  for (const recordId of routingRecordReferences) {
    const entry = registryByRecordId.get(recordId);
    if (!entry) {
      continue;
    }

    if (entry.status !== "active") {
      addIssue(
        issues,
        "CATEGORY_ROUTING_STATUS_INVALID",
        `Routing relatedDocRecordId '${recordId}' targets non-active status '${entry.status}'.`,
      );
    }
    if (entry.authoritativeness === "historical") {
      addIssue(
        issues,
        "CATEGORY_ROUTING_AUTHORITY_INVALID",
        `Routing relatedDocRecordId '${recordId}' targets historical authoritativeness.`,
      );
    }
  }

  return {
    checkedDocReferences: routingDocReferences.size,
    checkedRecordReferences: routingRecordReferences.size,
  };
}

function validateDocsCategoryCompliance(repoRoot) {
  const issues = [];

  const documentationRegistry = readJson(
    repoRoot,
    DOCUMENTATION_REGISTRY_PATH,
    issues,
    "CATEGORY_SOURCE_INVALID",
  );
  const adrRegistry = readJson(
    repoRoot,
    ADR_REGISTRY_PATH,
    issues,
    "CATEGORY_SOURCE_INVALID",
  );
  const routingSeed = readJson(
    repoRoot,
    ROUTING_SEED_PATH,
    issues,
    "CATEGORY_SOURCE_INVALID",
  );

  if (!documentationRegistry || !adrRegistry || !routingSeed) {
    return {
      issues,
      checkedAdrEntries: 0,
      checkedBaselineEntries: 0,
      checkedRoutingDocReferences: 0,
      checkedRoutingRecordReferences: 0,
    };
  }

  const registryEntries = Array.isArray(documentationRegistry.entries)
    ? documentationRegistry.entries
    : [];

  if (registryEntries.length === 0) {
    addIssue(
      issues,
      "CATEGORY_SOURCE_INVALID",
      `${DOCUMENTATION_REGISTRY_PATH} must include a non-empty entries array.`,
    );
  }

  if (!Array.isArray(adrRegistry.records) || adrRegistry.records.length === 0) {
    addIssue(
      issues,
      "CATEGORY_SOURCE_INVALID",
      `${ADR_REGISTRY_PATH} must include a non-empty records array.`,
    );
  }

  if (!Array.isArray(routingSeed.mappings) || !Array.isArray(routingSeed.routingExamples)) {
    addIssue(
      issues,
      "CATEGORY_SOURCE_INVALID",
      `${ROUTING_SEED_PATH} must include mappings and routingExamples arrays.`,
    );
  }

  const checkedAdrEntries = validateAdrPlacement({
    issues,
    registryEntries,
    adrRegistry,
  });

  const checkedBaselineEntries = validateBaselineHistoricalExpectations({
    issues,
    registryEntries,
  });

  const routingValidation = validateRoutingReferences({
    issues,
    routingSeed,
    registryEntries,
  });

  return {
    issues,
    checkedAdrEntries,
    checkedBaselineEntries,
    checkedRoutingDocReferences: routingValidation.checkedDocReferences,
    checkedRoutingRecordReferences: routingValidation.checkedRecordReferences,
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
    checkedAdrEntries,
    checkedBaselineEntries,
    checkedRoutingDocReferences,
    checkedRoutingRecordReferences,
  } = validateDocsCategoryCompliance(repoRoot);

  if (issues.length > 0) {
    process.stderr.write("Documentation category-compliance validation failed.\n");
    for (const issue of issues) {
      process.stderr.write(`- [${issue.code}] ${issue.message}\n`);
    }
    process.stderr.write(`Total issues: ${issues.length}\n`);
    process.exit(1);
  }

  process.stdout.write([
    "Documentation category-compliance validation passed.",
    `Checked ADR registry/category placement invariants: ${checkedAdrEntries}`,
    `Checked baseline and historical lifecycle/category invariants: ${checkedBaselineEntries}`,
    `Checked routing relatedDocPaths against active/non-historical expectations: ${checkedRoutingDocReferences}`,
    `Checked routing relatedDocRecordIds against active/non-historical expectations: ${checkedRoutingRecordReferences}`,
  ].join("\n") + "\n");
}

main();
