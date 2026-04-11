const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { resolve } = require("node:path");
const { generateDocumentationIndexView } = require("./generate-documentation-index-view.cjs");

const REQUIRED_TOP_LEVEL_FOLDERS = [
  "architecture",
  "contributors",
  "operations",
  "baselines",
  "adr",
  "context",
  "prompts",
  "ui",
];

const REQUIRED_CONTEXT_SUBFOLDERS = [
  "packs",
  "routing",
  "governance",
  "templates",
];

const REQUIRED_CONTEXT_FILES = [
  "docs/context/context-asset-metadata.md",
  "docs/context/context-asset-metadata.ai.md",
  "docs/context/context-asset-metadata.contract.json",
  "docs/context/documentation-indexing-model.md",
  "docs/context/documentation-indexing-model.ai.md",
  "docs/context/documentation-index-coverage-rules.md",
  "docs/context/documentation-index-coverage-rules.ai.md",
  "docs/context/documentation-indexed-document-metadata.md",
  "docs/context/documentation-indexed-document-metadata.ai.md",
  "docs/context/documentation-indexed-document-metadata.contract.json",
  "docs/context/documentation-registry.md",
  "docs/context/documentation-registry.ai.md",
  "docs/context/documentation-registry.seed.json",
  "docs/context/documentation-index.md",
  "docs/context/documentation-index.ai.md",
  "docs/context/documentation-identity-and-reference-conventions.md",
  "docs/context/documentation-identity-and-reference-conventions.ai.md",
  "docs/context/documentation-identity-and-reference.contract.json",
  "docs/context/packs/README.md",
  "docs/context/packs/README.ai.md",
  "docs/context/packs/context-pack.contract.json",
  "docs/context/packs/context-pack-catalog.contract.json",
  "docs/context/packs/context-pack-catalog.seed.json",
  "docs/context/packs/context-system-foundations.pack.md",
  "docs/context/packs/context-system-foundations.pack.ai.md",
  "docs/context/packs/documentation-refactor.pack.md",
  "docs/context/packs/documentation-refactor.pack.ai.md",
  "docs/context/packs/identity-and-security.pack.md",
  "docs/context/packs/identity-and-security.pack.ai.md",
  "docs/context/packs/studio-and-system-composition.pack.md",
  "docs/context/packs/studio-and-system-composition.pack.ai.md",
  "docs/context/routing/README.md",
  "docs/context/routing/README.ai.md",
  "docs/context/routing/prompt-routing-contract.md",
  "docs/context/routing/prompt-routing-contract.ai.md",
  "docs/context/routing/task-to-context-routing.contract.json",
  "docs/context/routing/task-to-context-routing.seed.json",
  "docs/context/governance/README.md",
  "docs/context/governance/README.ai.md",
  "docs/context/governance/context-governance-policy.md",
  "docs/context/governance/context-governance-policy.ai.md",
  "docs/context/governance/documentation-quality-standard.md",
  "docs/context/governance/documentation-quality-standard.ai.md",
  "docs/context/governance/context-asset-lifecycle.md",
  "docs/context/governance/context-asset-lifecycle.ai.md",
  "docs/context/governance/documentation-indexing-rollout-boundaries.md",
  "docs/context/governance/documentation-indexing-rollout-boundaries.ai.md",
  "docs/context/governance/context-system-rollout-boundaries.md",
  "docs/context/governance/context-system-rollout-boundaries.ai.md",
  "docs/context/templates/README.md",
  "docs/context/templates/README.ai.md",
  "docs/context/templates/task-to-context-routing-entry.template.json",
  "docs/context/templates/documentation-registry-entry.template.json",
  "docs/context/templates/documentation-registry-entry.architecture.template.json",
  "docs/context/templates/documentation-registry-entry.adr.template.json",
  "docs/context/templates/documentation-registry-entry.context-pack.template.json",
];

const REQUIRED_DOCUMENTATION_INDEXING_MODEL_HEADINGS = [
  "## Discovery Problems This Model Solves",
  "## Indexing Model",
  "## Goals",
  "## Non-Goals and Complexity Boundaries",
  "## Relationship to Taxonomy, Routing, and Context Packs",
];

const REQUIRED_DOCUMENTATION_INDEXING_MODEL_AI_HEADINGS = [
  "## Model Summary",
  "## Core Goals",
  "## Discovery Problems Addressed",
  "## Relationship Contract",
  "## Non-Goals",
  "## Complexity Target",
];

const REQUIRED_DOCUMENTATION_INDEX_COVERAGE_RULES_HEADINGS = [
  "## Coverage Modes",
  "## Coverage Policy By Category",
  "## Inclusion Rules",
  "## Selective Indexing Rules",
  "## Exclusion Rules",
  "## Status and Authoritativeness Expectations",
  "## Registry Representation Rules",
];

const REQUIRED_DOCUMENTATION_INDEX_COVERAGE_RULES_AI_HEADINGS = [
  "## Coverage Modes",
  "## Required Categories",
  "## Selective Categories",
  "## Excluded Categories",
  "## Status and Authority Rules",
  "## Registry Contract",
];

const REQUIRED_DOCUMENTATION_INDEX_VIEW_HEADINGS = [
  "## Canonical Sources",
  "## At a Glance",
  "## Browse by Document Type",
  "## Browse by Domain",
  "## Browse by Status",
  "## Maintenance and Validation",
];

const REQUIRED_DOCUMENTATION_QUALITY_STANDARD_HEADINGS = [
  "## Scope and Enforcement Boundary",
  "## Required Rules (Normative, Enforceable)",
  "## Rule Severity Levels and Failure Policy",
  "## Documentation Category Rule Scope Matrix",
  "## Category-Specific Enforcement Boundaries",
  "## Recommended Guidance (Non-Blocking)",
  "## Automation Mapping for Lightweight Tooling",
  "## Governance and Change Control",
];

const REQUIRED_ADR_FILES = [
  "docs/adr/records/adr-registry.json",
];

const ADR_DECISION_STATUSES = new Set([
  "proposed",
  "accepted",
  "superseded",
  "deprecated",
]);

const REQUIRED_HEADER_FIELDS = [
  "title",
  "doc_type",
  "status",
  "authoritativeness",
  "owned_by",
  "last_reviewed",
];

const REQUIRED_INDEXED_DOCUMENT_METADATA_FIELDS = [
  "path",
  "title",
  "docType",
  "domain",
  "status",
  "authoritativeness",
  "summary",
];

const OPTIONAL_INDEXED_DOCUMENT_METADATA_FIELDS = [
  "keywords",
  "relatedCodePaths",
  "relatedDocs",
  "relatedRecordIds",
  "owner",
  "lastReviewed",
  "aiPath",
  "supersedes",
  "supersededBy",
];

const DOCUMENTATION_RECORD_ID_PATTERN = /^doc-[a-z0-9]+(?:-[a-z0-9]+)*$/;

const REQUIRED_DOCUMENTATION_REGISTRY_ENTRY_FIELDS = [
  "recordId",
  ...REQUIRED_INDEXED_DOCUMENT_METADATA_FIELDS,
];

const SEED_DOCUMENTS = [
  "docs/architecture/README.md",
  "docs/architecture/domain-and-application-core.md",
  "docs/unified-api-contributor-guide.md",
  "docs/contributors/docs-migration-safety-guide.md",
  "docs/security-policy-configuration-operations.md",
  "docs/documentation-migration-baseline.md",
  "docs/context/documentation-taxonomy.md",
];

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

function isArrayOfNonEmptyStrings(value, options = {}) {
  const allowEmpty = options.allowEmpty === true;
  return Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.every((entry) => isNonEmptyString(entry));
}

function addIssue(issues, code, message) {
  issues.push({ code, message });
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
  const afterFrontmatter = normalized.slice(closingDelimiterIndex + 5);
  if (!afterFrontmatter.trimStart().startsWith("# ")) {
    throw new Error("missing H1 immediately after frontmatter block");
  }

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

function extractSectionBody(markdownContent, heading) {
  const normalized = markdownContent.replace(/\r\n/g, "\n");
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionPattern = new RegExp(`^${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|\\n#\\s+|$)`, "m");
  const match = normalized.match(sectionPattern);
  return match ? match[1] : "";
}

function extractBacktickedValues(text) {
  const values = [];
  const pattern = /`([^`]+)`/g;
  let match = pattern.exec(text);
  while (match) {
    values.push(match[1].trim());
    match = pattern.exec(text);
  }
  return values.filter((value) => value.length > 0);
}

function pathExistsForReference(repoRoot, pathValue) {
  if (!isNonEmptyString(pathValue)) {
    return false;
  }
  const normalized = pathValue.trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
  return existsSync(resolve(repoRoot, normalized));
}

function isValidIsoDate(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return false;
  }

  const parsedDate = new Date(`${dateValue}T00:00:00.000Z`);
  return Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().startsWith(dateValue);
}

function validateDocsFoundation(repoRoot) {
  const issues = [];
  const docsRoot = resolve(repoRoot, "docs");

  if (!existsSync(docsRoot)) {
    issues.push({
      code: "DOCS_ROOT_MISSING",
      message: `Expected docs root at ${normalizePath(docsRoot)}.`,
    });
    return issues;
  }

  for (const folder of REQUIRED_TOP_LEVEL_FOLDERS) {
    const folderPath = resolve(docsRoot, folder);
    if (!existsSync(folderPath)) {
      issues.push({
        code: "TOP_LEVEL_FOLDER_MISSING",
        message: `Missing required folder: docs/${folder}/`,
      });
    }
  }

  const requiredRouterPaths = [
    "docs/README.md",
    "docs/README.ai.md",
    ...REQUIRED_TOP_LEVEL_FOLDERS.flatMap((folder) => [
      `docs/${folder}/README.md`,
      `docs/${folder}/README.ai.md`,
    ]),
  ];

  for (const relativePath of requiredRouterPaths) {
    const absolutePath = resolve(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
      issues.push({
        code: "ROUTER_FILE_MISSING",
        message: `Missing required router file: ${relativePath}`,
      });
    }
  }

  for (const folder of REQUIRED_CONTEXT_SUBFOLDERS) {
    const folderPath = resolve(repoRoot, "docs/context", folder);
    if (!existsSync(folderPath)) {
      issues.push({
        code: "CONTEXT_SUBFOLDER_MISSING",
        message: `Missing required context subfolder: docs/context/${folder}/`,
      });
    }
  }

  for (const relativePath of REQUIRED_CONTEXT_FILES) {
    const absolutePath = resolve(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
      issues.push({
        code: "CONTEXT_FILE_MISSING",
        message: `Missing required context foundation file: ${relativePath}`,
      });
    }
  }

  for (const relativePath of REQUIRED_ADR_FILES) {
    const absolutePath = resolve(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
      issues.push({
        code: "ADR_FILE_MISSING",
        message: `Missing required ADR foundation file: ${relativePath}`,
      });
    }
  }

  const documentationIndexingModelPath = resolve(repoRoot, "docs/context/documentation-indexing-model.md");
  if (existsSync(documentationIndexingModelPath)) {
    const content = readFileSync(documentationIndexingModelPath, "utf8");
    for (const heading of REQUIRED_DOCUMENTATION_INDEXING_MODEL_HEADINGS) {
      if (!content.includes(heading)) {
        addIssue(
          issues,
          "DOCUMENTATION_INDEX_MODEL_INVALID",
          `docs/context/documentation-indexing-model.md is missing required heading '${heading}'.`,
        );
      }
    }
  }

  const documentationIndexingModelAiPath = resolve(repoRoot, "docs/context/documentation-indexing-model.ai.md");
  if (existsSync(documentationIndexingModelAiPath)) {
    const content = readFileSync(documentationIndexingModelAiPath, "utf8");
    for (const heading of REQUIRED_DOCUMENTATION_INDEXING_MODEL_AI_HEADINGS) {
      if (!content.includes(heading)) {
        addIssue(
          issues,
          "DOCUMENTATION_INDEX_MODEL_INVALID",
          `docs/context/documentation-indexing-model.ai.md is missing required heading '${heading}'.`,
        );
      }
    }
  }

  const documentationIndexCoverageRulesPath = resolve(repoRoot, "docs/context/documentation-index-coverage-rules.md");
  if (existsSync(documentationIndexCoverageRulesPath)) {
    const content = readFileSync(documentationIndexCoverageRulesPath, "utf8");
    for (const heading of REQUIRED_DOCUMENTATION_INDEX_COVERAGE_RULES_HEADINGS) {
      if (!content.includes(heading)) {
        addIssue(
          issues,
          "DOCUMENTATION_INDEX_COVERAGE_RULES_INVALID",
          `docs/context/documentation-index-coverage-rules.md is missing required heading '${heading}'.`,
        );
      }
    }
  }

  const documentationIndexCoverageRulesAiPath = resolve(repoRoot, "docs/context/documentation-index-coverage-rules.ai.md");
  if (existsSync(documentationIndexCoverageRulesAiPath)) {
    const content = readFileSync(documentationIndexCoverageRulesAiPath, "utf8");
    for (const heading of REQUIRED_DOCUMENTATION_INDEX_COVERAGE_RULES_AI_HEADINGS) {
      if (!content.includes(heading)) {
        addIssue(
          issues,
          "DOCUMENTATION_INDEX_COVERAGE_RULES_INVALID",
          `docs/context/documentation-index-coverage-rules.ai.md is missing required heading '${heading}'.`,
        );
      }
    }
  }

  const documentationIndexViewPath = resolve(repoRoot, "docs/context/documentation-index.md");
  if (existsSync(documentationIndexViewPath)) {
    const content = readFileSync(documentationIndexViewPath, "utf8");
    for (const heading of REQUIRED_DOCUMENTATION_INDEX_VIEW_HEADINGS) {
      if (!content.includes(heading)) {
        addIssue(
          issues,
          "DOCUMENTATION_INDEX_VIEW_INVALID",
          `docs/context/documentation-index.md is missing required heading '${heading}'.`,
        );
      }
    }
  }

  const documentationIndexViewAiPath = resolve(repoRoot, "docs/context/documentation-index.ai.md");
  if (existsSync(documentationIndexViewAiPath)) {
    const content = readFileSync(documentationIndexViewAiPath, "utf8");
    for (const heading of REQUIRED_DOCUMENTATION_INDEX_VIEW_HEADINGS) {
      if (!content.includes(heading)) {
        addIssue(
          issues,
          "DOCUMENTATION_INDEX_VIEW_INVALID",
          `docs/context/documentation-index.ai.md is missing required heading '${heading}'.`,
        );
      }
    }
  }

  const documentationQualityStandardPath = resolve(repoRoot, "docs/context/governance/documentation-quality-standard.md");
  if (existsSync(documentationQualityStandardPath)) {
    const content = readFileSync(documentationQualityStandardPath, "utf8");
    for (const heading of REQUIRED_DOCUMENTATION_QUALITY_STANDARD_HEADINGS) {
      if (!content.includes(heading)) {
        addIssue(
          issues,
          "DOCUMENTATION_QUALITY_STANDARD_INVALID",
          `docs/context/governance/documentation-quality-standard.md is missing required heading '${heading}'.`,
        );
      }
    }
  }

  const documentationQualityStandardAiPath = resolve(repoRoot, "docs/context/governance/documentation-quality-standard.ai.md");
  if (existsSync(documentationQualityStandardAiPath)) {
    const content = readFileSync(documentationQualityStandardAiPath, "utf8");
    for (const heading of REQUIRED_DOCUMENTATION_QUALITY_STANDARD_HEADINGS) {
      if (!content.includes(heading)) {
        addIssue(
          issues,
          "DOCUMENTATION_QUALITY_STANDARD_INVALID",
          `docs/context/governance/documentation-quality-standard.ai.md is missing required heading '${heading}'.`,
        );
      }
    }
  }

  try {
    const documentationIndexResult = generateDocumentationIndexView({ repoRoot, checkOnly: true });
    if (!documentationIndexResult.matches) {
      addIssue(
        issues,
        "DOCUMENTATION_INDEX_VIEW_OUT_OF_SYNC",
        "docs/context/documentation-index(.ai).md is out of sync with docs/context/documentation-registry.seed.json. Run node dev/scripts/generate-documentation-index-view.cjs.",
      );
    }
  } catch (error) {
    addIssue(
      issues,
      "DOCUMENTATION_INDEX_VIEW_INVALID",
      `Failed to validate generated documentation index view: ${error.message}`,
    );
  }

  const contextPackCatalogContractPath = resolve(repoRoot, "docs/context/packs/context-pack-catalog.contract.json");
  const contextPackCatalogSeedPath = resolve(repoRoot, "docs/context/packs/context-pack-catalog.seed.json");
  const contextPackContractPath = resolve(repoRoot, "docs/context/packs/context-pack.contract.json");
  const contextMapPath = resolve(repoRoot, "docs/context/context-map.json");
  const contextAssetMetadataContractPath = resolve(repoRoot, "docs/context/context-asset-metadata.contract.json");
  const indexedDocumentMetadataContractPath = resolve(repoRoot, "docs/context/documentation-indexed-document-metadata.contract.json");
  const documentationIdentityReferenceContractPath = resolve(repoRoot, "docs/context/documentation-identity-and-reference.contract.json");
  const documentationRegistrySeedPath = resolve(repoRoot, "docs/context/documentation-registry.seed.json");
  const taskRoutingContractPath = resolve(repoRoot, "docs/context/routing/task-to-context-routing.contract.json");
  const taskRoutingSeedPath = resolve(repoRoot, "docs/context/routing/task-to-context-routing.seed.json");
  const adrRegistryPath = resolve(repoRoot, "docs/adr/records/adr-registry.json");

  const expectedContextJsonArtifacts = [
    contextPackContractPath,
    contextMapPath,
    contextAssetMetadataContractPath,
    indexedDocumentMetadataContractPath,
    documentationIdentityReferenceContractPath,
    documentationRegistrySeedPath,
    contextPackCatalogContractPath,
    contextPackCatalogSeedPath,
    taskRoutingContractPath,
    taskRoutingSeedPath,
  ];

  const contextJsonArtifacts = new Map();
  for (const artifactPath of expectedContextJsonArtifacts) {
    if (!existsSync(artifactPath)) {
      continue;
    }

    try {
      contextJsonArtifacts.set(artifactPath, readJson(artifactPath));
    } catch (error) {
      issues.push({
        code: "CONTEXT_JSON_INVALID",
        message: `${normalizePath(artifactPath)} is not valid JSON: ${error.message}`,
      });
    }
  }

  const packContractSpec = contextJsonArtifacts.get(contextPackContractPath);
  if (packContractSpec) {
    if (packContractSpec.schemaVersion !== "1.0.0" || packContractSpec.artifactType !== "context-pack-contract") {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/packs/context-pack.contract.json must declare schemaVersion 1.0.0 and artifactType context-pack-contract.",
      });
    }

    if (!Array.isArray(packContractSpec.requiredSections) || !Array.isArray(packContractSpec.optionalSections)) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/packs/context-pack.contract.json must include requiredSections and optionalSections arrays.",
      });
    }

    const qualityRules = packContractSpec.qualityRules;
    if (!qualityRules || typeof qualityRules !== "object") {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/packs/context-pack.contract.json must include a qualityRules object.",
      });
    }
  }

  const packContract = contextJsonArtifacts.get(contextPackCatalogContractPath);
  if (packContract) {
    if (packContract.schemaVersion !== "1.0.0" || packContract.artifactType !== "context-pack-catalog") {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/packs/context-pack-catalog.contract.json must declare schemaVersion 1.0.0 and artifactType context-pack-catalog.",
      });
    }

    if (packContract.contextAssetMetadataContractPath !== "docs/context/context-asset-metadata.contract.json") {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/packs/context-pack-catalog.contract.json must reference docs/context/context-asset-metadata.contract.json.",
      });
    }
  }

  const packSeed = contextJsonArtifacts.get(contextPackCatalogSeedPath);
  if (packSeed) {
    if (packSeed.schemaVersion !== "1.0.0" || packSeed.artifactType !== "context-pack-catalog" || !Array.isArray(packSeed.packs)) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/packs/context-pack-catalog.seed.json must include schemaVersion 1.0.0, artifactType context-pack-catalog, and packs array.",
      });
    }
  }

  const contextAssetMetadataContract = contextJsonArtifacts.get(contextAssetMetadataContractPath);
  if (contextAssetMetadataContract) {
    if (
      contextAssetMetadataContract.schemaVersion !== "1.0.0"
      || contextAssetMetadataContract.artifactType !== "context-asset-metadata-standard"
    ) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/context-asset-metadata.contract.json must declare schemaVersion 1.0.0 and artifactType context-asset-metadata-standard.",
      });
    }
  }

  const indexedDocumentMetadataContract = contextJsonArtifacts.get(indexedDocumentMetadataContractPath);
  const documentationIdentityReferenceContract = contextJsonArtifacts.get(documentationIdentityReferenceContractPath);
  if (indexedDocumentMetadataContract) {
    if (
      indexedDocumentMetadataContract.schemaVersion !== "1.0.0"
      || indexedDocumentMetadataContract.artifactType !== "documentation-indexed-document-metadata-standard"
    ) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-indexed-document-metadata.contract.json must declare schemaVersion 1.0.0 and artifactType documentation-indexed-document-metadata-standard.",
      });
    }

    if (
      indexedDocumentMetadataContract.canonicalHumanSpecPath !== "docs/context/documentation-indexed-document-metadata.md"
      || indexedDocumentMetadataContract.canonicalAiSpecPath !== "docs/context/documentation-indexed-document-metadata.ai.md"
    ) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-indexed-document-metadata.contract.json must reference canonical human/AI spec paths.",
      });
    }

    if (
      !Array.isArray(indexedDocumentMetadataContract.requiredFields)
      || JSON.stringify(indexedDocumentMetadataContract.requiredFields) !== JSON.stringify(REQUIRED_INDEXED_DOCUMENT_METADATA_FIELDS)
    ) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-indexed-document-metadata.contract.json requiredFields changed; update validator expectations.",
      });
    }

    if (
      !Array.isArray(indexedDocumentMetadataContract.optionalFields)
      || JSON.stringify(indexedDocumentMetadataContract.optionalFields) !== JSON.stringify(OPTIONAL_INDEXED_DOCUMENT_METADATA_FIELDS)
    ) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-indexed-document-metadata.contract.json optionalFields changed; update validator expectations.",
      });
    }

    if (
      !indexedDocumentMetadataContract.fieldDefinitions
      || typeof indexedDocumentMetadataContract.fieldDefinitions !== "object"
    ) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-indexed-document-metadata.contract.json must include fieldDefinitions.",
      });
    } else {
      for (const fieldName of [...REQUIRED_INDEXED_DOCUMENT_METADATA_FIELDS, ...OPTIONAL_INDEXED_DOCUMENT_METADATA_FIELDS]) {
        if (!indexedDocumentMetadataContract.fieldDefinitions[fieldName]) {
          issues.push({
            code: "CONTEXT_CONTRACT_INVALID",
            message: `docs/context/documentation-indexed-document-metadata.contract.json missing fieldDefinitions.${fieldName}.`,
          });
        }
      }
    }

    if (
      indexedDocumentMetadataContract.identityConventionsContractPath
      !== "docs/context/documentation-identity-and-reference.contract.json"
    ) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-indexed-document-metadata.contract.json must reference docs/context/documentation-identity-and-reference.contract.json.",
      });
    }
  }

  if (documentationIdentityReferenceContract) {
    if (
      documentationIdentityReferenceContract.schemaVersion !== "1.0.0"
      || documentationIdentityReferenceContract.artifactType !== "documentation-identity-and-reference-conventions"
    ) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-identity-and-reference.contract.json must declare schemaVersion 1.0.0 and artifactType documentation-identity-and-reference-conventions.",
      });
    }

    if (
      documentationIdentityReferenceContract.canonicalHumanSpecPath
      !== "docs/context/documentation-identity-and-reference-conventions.md"
      || documentationIdentityReferenceContract.canonicalAiSpecPath
      !== "docs/context/documentation-identity-and-reference-conventions.ai.md"
    ) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-identity-and-reference.contract.json must reference canonical human/AI spec paths.",
      });
    }

    const stableIdentity = documentationIdentityReferenceContract.stableIdentity || {};
    if (
      stableIdentity.field !== "recordId"
      || stableIdentity.pattern !== "^doc-[a-z0-9]+(?:-[a-z0-9]+)*$"
    ) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-identity-and-reference.contract.json stableIdentity must define recordId and the canonical doc-id pattern.",
      });
    }
  }

  const documentationRegistry = contextJsonArtifacts.get(documentationRegistrySeedPath);
  if (documentationRegistry) {
    if (
      documentationRegistry.schemaVersion !== "1.0.0"
      || documentationRegistry.artifactType !== "documentation-registry"
    ) {
      issues.push({
        code: "CONTEXT_REGISTRY_INVALID",
        message: "docs/context/documentation-registry.seed.json must declare schemaVersion 1.0.0 and artifactType documentation-registry.",
      });
    }

    if (
      documentationRegistry.entryContractPath !== "docs/context/documentation-indexed-document-metadata.contract.json"
      || documentationRegistry.taxonomyContractPath !== "docs/context/documentation-taxonomy.contract.json"
    ) {
      issues.push({
        code: "CONTEXT_REGISTRY_INVALID",
        message: "docs/context/documentation-registry.seed.json must reference indexed-document metadata and taxonomy contracts.",
      });
    }

    for (const [fieldName, label] of [
      ["docTypeCatalog", "docTypeCatalog"],
      ["statusCatalog", "statusCatalog"],
      ["authoritativenessCatalog", "authoritativenessCatalog"],
    ]) {
      const fieldValue = documentationRegistry[fieldName];
      if (!isArrayOfNonEmptyStrings(fieldValue)) {
        issues.push({
          code: "CONTEXT_REGISTRY_INVALID",
          message: `docs/context/documentation-registry.seed.json must include non-empty ${label}.`,
        });
      }
    }

    if (
      !documentationRegistry.domainRelationships
      || typeof documentationRegistry.domainRelationships !== "object"
      || Array.isArray(documentationRegistry.domainRelationships)
    ) {
      issues.push({
        code: "CONTEXT_REGISTRY_INVALID",
        message: "docs/context/documentation-registry.seed.json must include domainRelationships object.",
      });
    } else {
      for (const [domainId, relatedDomains] of Object.entries(documentationRegistry.domainRelationships)) {
        if (!isNonEmptyString(domainId)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            "docs/context/documentation-registry.seed.json domainRelationships keys must be non-empty strings.",
          );
          continue;
        }

        if (!isArrayOfNonEmptyStrings(relatedDomains)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json domainRelationships.${domainId} must be a non-empty string array.`,
          );
        }
      }
    }

    if (!Array.isArray(documentationRegistry.entries) || documentationRegistry.entries.length === 0) {
      issues.push({
        code: "CONTEXT_REGISTRY_INVALID",
        message: "docs/context/documentation-registry.seed.json must include non-empty entries array.",
      });
    }

    if (
      !documentationRegistry.discoveryIndex
      || typeof documentationRegistry.discoveryIndex !== "object"
      || Array.isArray(documentationRegistry.discoveryIndex)
    ) {
      issues.push({
        code: "CONTEXT_REGISTRY_INVALID",
        message: "docs/context/documentation-registry.seed.json must include discoveryIndex object.",
      });
    } else {
      for (const indexName of ["byDocType", "byStatus", "byDomain", "byAuthoritativeness", "byTaskCategory"]) {
        const indexValue = documentationRegistry.discoveryIndex[indexName];
        if (!indexValue || typeof indexValue !== "object" || Array.isArray(indexValue)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json discoveryIndex.${indexName} must be an object map.`,
          );
        }
      }
    }

    const coveragePolicy = documentationRegistry.coveragePolicy;
    if (
      !coveragePolicy
      || typeof coveragePolicy !== "object"
      || Array.isArray(coveragePolicy)
    ) {
      issues.push({
        code: "CONTEXT_REGISTRY_INVALID",
        message: "docs/context/documentation-registry.seed.json must include coveragePolicy object.",
      });
    } else {
      if (coveragePolicy.schemaVersion !== "1.0.0") {
        addIssue(
          issues,
          "CONTEXT_REGISTRY_INVALID",
          "docs/context/documentation-registry.seed.json coveragePolicy.schemaVersion must be '1.0.0'.",
        );
      }

      for (const [fieldName, expectedPath] of [
        ["canonicalHumanSpecPath", "docs/context/documentation-index-coverage-rules.md"],
        ["canonicalAiSpecPath", "docs/context/documentation-index-coverage-rules.ai.md"],
      ]) {
        if (coveragePolicy[fieldName] !== expectedPath) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json coveragePolicy.${fieldName} must equal '${expectedPath}'.`,
          );
        } else if (!pathExistsForReference(repoRoot, expectedPath)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json coveragePolicy.${fieldName} references missing path '${expectedPath}'.`,
          );
        }
      }

      const requiredCategories = coveragePolicy.requiredCategories;
      const selectiveCategories = coveragePolicy.selectiveCategories;
      const excludedCategories = coveragePolicy.excludedCategories;
      const categoryRules = coveragePolicy.categoryRules;

      for (const [fieldName, allowEmpty] of [
        ["requiredCategories", false],
        ["selectiveCategories", false],
        ["excludedCategories", false],
      ]) {
        const categories = coveragePolicy[fieldName];
        if (!isArrayOfNonEmptyStrings(categories, { allowEmpty })) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json coveragePolicy.${fieldName} must be a non-empty string array.`,
          );
        }
      }

      if (
        !categoryRules
        || typeof categoryRules !== "object"
        || Array.isArray(categoryRules)
      ) {
        addIssue(
          issues,
          "CONTEXT_REGISTRY_INVALID",
          "docs/context/documentation-registry.seed.json coveragePolicy.categoryRules must be an object map.",
        );
      } else {
        const allCategoryIds = new Set([
          ...(Array.isArray(requiredCategories) ? requiredCategories : []),
          ...(Array.isArray(selectiveCategories) ? selectiveCategories : []),
          ...(Array.isArray(excludedCategories) ? excludedCategories : []),
        ]);

        for (const categoryId of allCategoryIds) {
          const rule = categoryRules[categoryId];
          if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
            addIssue(
              issues,
              "CONTEXT_REGISTRY_INVALID",
              `docs/context/documentation-registry.seed.json coveragePolicy.categoryRules must include object for '${categoryId}'.`,
            );
            continue;
          }

          if (!isNonEmptyString(rule.coverageMode) || !new Set(["required", "selective", "excluded"]).has(rule.coverageMode)) {
            addIssue(
              issues,
              "CONTEXT_REGISTRY_INVALID",
              `docs/context/documentation-registry.seed.json coveragePolicy.categoryRules['${categoryId}'].coverageMode must be required|selective|excluded.`,
            );
          }

          if (!isArrayOfNonEmptyStrings(rule.includePaths)) {
            addIssue(
              issues,
              "CONTEXT_REGISTRY_INVALID",
              `docs/context/documentation-registry.seed.json coveragePolicy.categoryRules['${categoryId}'].includePaths must be a non-empty string array.`,
            );
          }

          if (!isNonEmptyString(rule.representation)) {
            addIssue(
              issues,
              "CONTEXT_REGISTRY_INVALID",
              `docs/context/documentation-registry.seed.json coveragePolicy.categoryRules['${categoryId}'].representation must be a non-empty string.`,
            );
          }

          for (const fieldName of ["expectedStatus", "expectedAuthoritativeness"]) {
            const expectedValues = rule[fieldName];
            if (!Array.isArray(expectedValues) || !expectedValues.every((value) => isNonEmptyString(value))) {
              addIssue(
                issues,
                "CONTEXT_REGISTRY_INVALID",
                `docs/context/documentation-registry.seed.json coveragePolicy.categoryRules['${categoryId}'].${fieldName} must be a string array.`,
              );
            }
          }
        }
      }
    }
  }

  const routingContract = contextJsonArtifacts.get(taskRoutingContractPath);
  if (routingContract) {
    if (routingContract.schemaVersion !== "1.0.0" || routingContract.artifactType !== "task-to-context-routing-map") {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/routing/task-to-context-routing.contract.json must declare schemaVersion 1.0.0 and artifactType task-to-context-routing-map.",
      });
    }

    if (!Array.isArray(routingContract.routingRequestRequiredFields) || routingContract.routingRequestRequiredFields.length === 0) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/routing/task-to-context-routing.contract.json must include routingRequestRequiredFields.",
      });
    }

    if (!Array.isArray(routingContract.supportedTaskCategories) || routingContract.supportedTaskCategories.length < 8) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/routing/task-to-context-routing.contract.json must include supportedTaskCategories with at least 8 categories.",
      });
    }

    if (routingContract.contextAssetMetadataContractPath !== "docs/context/context-asset-metadata.contract.json") {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/routing/task-to-context-routing.contract.json must reference docs/context/context-asset-metadata.contract.json.",
      });
    }
  }

  const routingSeed = contextJsonArtifacts.get(taskRoutingSeedPath);
  if (routingSeed) {
    if (routingSeed.schemaVersion !== "1.0.0" || routingSeed.artifactType !== "task-to-context-routing-map" || !Array.isArray(routingSeed.mappings)) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/routing/task-to-context-routing.seed.json must include schemaVersion 1.0.0, artifactType task-to-context-routing-map, and mappings array.",
      });
    }

    if (!Array.isArray(routingSeed.taskCategoryMap) || routingSeed.taskCategoryMap.length < 8) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/routing/task-to-context-routing.seed.json must include taskCategoryMap with at least 8 task categories.",
      });
    }

    if (!Array.isArray(routingSeed.routingExamples) || routingSeed.routingExamples.length === 0) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/routing/task-to-context-routing.seed.json must include routingExamples.",
      });
    }
  }

  const contextMap = contextJsonArtifacts.get(contextMapPath);
  const catalogSeed = contextJsonArtifacts.get(contextPackCatalogSeedPath);
  const catalogContract = contextJsonArtifacts.get(contextPackCatalogContractPath);
  let adrRegistry;
  if (existsSync(adrRegistryPath)) {
    try {
      adrRegistry = readJson(adrRegistryPath);
    } catch (error) {
      addIssue(
        issues,
        "ADR_REGISTRY_INVALID",
        "docs/adr/records/adr-registry.json is not valid JSON.",
      );
    }
  }

  if (adrRegistry) {
    if (adrRegistry.schemaVersion !== "1.0.0" || adrRegistry.artifactType !== "adr-registry") {
      addIssue(
        issues,
        "ADR_REGISTRY_INVALID",
        "docs/adr/records/adr-registry.json must declare schemaVersion 1.0.0 and artifactType adr-registry.",
      );
    }

    if (!Array.isArray(adrRegistry.records) || adrRegistry.records.length === 0) {
      addIssue(
        issues,
        "ADR_REGISTRY_INVALID",
        "docs/adr/records/adr-registry.json must include non-empty records.",
      );
    }

    if (
      !adrRegistry.discoveryIndex
      || typeof adrRegistry.discoveryIndex !== "object"
      || !adrRegistry.discoveryIndex.byDecisionStatus
      || typeof adrRegistry.discoveryIndex.byDecisionStatus !== "object"
      || !adrRegistry.discoveryIndex.byDomain
      || typeof adrRegistry.discoveryIndex.byDomain !== "object"
    ) {
      addIssue(
        issues,
        "ADR_REGISTRY_INVALID",
        "docs/adr/records/adr-registry.json must include discoveryIndex.byDecisionStatus and discoveryIndex.byDomain objects.",
      );
    }

    const registryIdentifiers = new Set();
    const registryNumbers = [];
    const seenHumanPaths = new Set();
    const seenAiPaths = new Set();
    const adrFrontmatterByHumanPath = new Map();
    const adrAiFrontmatterByHumanPath = new Map();
    const adrContentByHumanPath = new Map();

    for (const [index, entry] of (adrRegistry.records || []).entries()) {
      const requiredFields = [
        "identifier",
        "adrNumber",
        "title",
        "decisionStatus",
        "decisionDate",
        "summary",
        "humanDocPath",
        "aiDocPath",
      ];
      for (const field of requiredFields) {
        if (!isNonEmptyString(entry?.[field])) {
          addIssue(
            issues,
            "ADR_REGISTRY_INVALID",
            `docs/adr/records/adr-registry.json record index ${index} is missing required field '${field}'.`,
          );
        }
      }

      if (!Array.isArray(entry?.relatedDomains) || !isArrayOfNonEmptyStrings(entry.relatedDomains)) {
        addIssue(
          issues,
          "ADR_REGISTRY_INVALID",
          `docs/adr/records/adr-registry.json record '${entry?.identifier || `index-${index}`}' must include non-empty relatedDomains.`,
        );
      }

      if (isNonEmptyString(entry?.decisionStatus) && !ADR_DECISION_STATUSES.has(entry.decisionStatus)) {
        addIssue(
          issues,
          "ADR_REGISTRY_INVALID",
          `docs/adr/records/adr-registry.json record '${entry.identifier}' has unsupported decisionStatus '${entry.decisionStatus}'.`,
        );
      }

      if (isNonEmptyString(entry?.decisionDate) && !isValidIsoDate(entry.decisionDate)) {
        addIssue(
          issues,
          "ADR_REGISTRY_INVALID",
          `docs/adr/records/adr-registry.json record '${entry.identifier}' has invalid decisionDate '${entry.decisionDate}'.`,
        );
      }

      if (isNonEmptyString(entry?.summary) && entry.summary.length > 260) {
        addIssue(
          issues,
          "ADR_REGISTRY_INVALID",
          `docs/adr/records/adr-registry.json record '${entry.identifier}' summary exceeds 260 characters.`,
        );
      }

      if (isNonEmptyString(entry?.identifier) && registryIdentifiers.has(entry.identifier)) {
        addIssue(
          issues,
          "ADR_REGISTRY_INVALID",
          `docs/adr/records/adr-registry.json contains duplicate identifier '${entry.identifier}'.`,
        );
      }
      registryIdentifiers.add(entry?.identifier);

      if (!/^\d{3}$/.test(entry?.adrNumber || "")) {
        addIssue(
          issues,
          "ADR_REGISTRY_INVALID",
          `docs/adr/records/adr-registry.json record '${entry?.identifier || `index-${index}`}' must use a 3-digit adrNumber.`,
        );
      } else {
        registryNumbers.push(Number(entry.adrNumber));
      }

      for (const pathField of ["humanDocPath", "aiDocPath"]) {
        const pathValue = entry?.[pathField];
        if (!isNonEmptyString(pathValue)) {
          continue;
        }
        if (!pathExistsForReference(repoRoot, pathValue)) {
          addIssue(
            issues,
            "ADR_REGISTRY_REFERENCE_INVALID",
            `docs/adr/records/adr-registry.json record '${entry?.identifier || `index-${index}`}' references missing ${pathField} '${pathValue}'.`,
          );
        }
      }

      if (isNonEmptyString(entry?.humanDocPath) && seenHumanPaths.has(entry.humanDocPath)) {
        addIssue(
          issues,
          "ADR_REGISTRY_INVALID",
          `docs/adr/records/adr-registry.json contains duplicate humanDocPath '${entry.humanDocPath}'.`,
        );
      }
      seenHumanPaths.add(entry?.humanDocPath);

      if (isNonEmptyString(entry?.aiDocPath) && seenAiPaths.has(entry.aiDocPath)) {
        addIssue(
          issues,
          "ADR_REGISTRY_INVALID",
          `docs/adr/records/adr-registry.json contains duplicate aiDocPath '${entry.aiDocPath}'.`,
        );
      }
      seenAiPaths.add(entry?.aiDocPath);

      if (isNonEmptyString(entry?.identifier) && isNonEmptyString(entry?.adrNumber)) {
        const expectedIdentifier = `ADR-${entry.adrNumber}`;
        if (entry.identifier !== expectedIdentifier) {
          addIssue(
            issues,
            "ADR_REGISTRY_INVALID",
            `docs/adr/records/adr-registry.json record '${entry.identifier}' must use identifier '${expectedIdentifier}'.`,
          );
        }
      }

      if (pathExistsForReference(repoRoot, entry?.humanDocPath)) {
        try {
          const humanContent = readFileSync(resolve(repoRoot, entry.humanDocPath), "utf8");
          const frontmatter = parseFrontmatter(humanContent);
          const expectedTitle = `ADR-${entry.adrNumber} ${entry.title}`;
          adrFrontmatterByHumanPath.set(entry.humanDocPath, frontmatter);
          adrContentByHumanPath.set(entry.humanDocPath, humanContent);
          if (frontmatter.title !== expectedTitle) {
            addIssue(
              issues,
              "ADR_REGISTRY_REFERENCE_INVALID",
              `docs/adr/records/adr-registry.json record '${entry.identifier}' title does not match human ADR frontmatter.`,
            );
          }
          if (frontmatter.adr_number !== entry.adrNumber) {
            addIssue(
              issues,
              "ADR_REGISTRY_REFERENCE_INVALID",
              `docs/adr/records/adr-registry.json record '${entry.identifier}' adrNumber does not match human ADR frontmatter.`,
            );
          }
          if (frontmatter.decision_status !== entry.decisionStatus) {
            addIssue(
              issues,
              "ADR_REGISTRY_REFERENCE_INVALID",
              `docs/adr/records/adr-registry.json record '${entry.identifier}' decisionStatus does not match human ADR frontmatter.`,
            );
          }
          if (frontmatter.decision_date !== entry.decisionDate) {
            addIssue(
              issues,
              "ADR_REGISTRY_REFERENCE_INVALID",
              `docs/adr/records/adr-registry.json record '${entry.identifier}' decisionDate does not match human ADR frontmatter.`,
            );
          }
        } catch (error) {
          addIssue(
            issues,
            "ADR_REGISTRY_REFERENCE_INVALID",
            `docs/adr/records/adr-registry.json record '${entry?.identifier || `index-${index}`}' has unreadable human ADR frontmatter: ${error.message}`,
          );
        }
      }

      if (pathExistsForReference(repoRoot, entry?.aiDocPath)) {
        try {
          const aiFrontmatter = parseFrontmatter(readFileSync(resolve(repoRoot, entry.aiDocPath), "utf8"));
          adrAiFrontmatterByHumanPath.set(entry.humanDocPath, aiFrontmatter);
        } catch (error) {
          addIssue(
            issues,
            "ADR_REGISTRY_REFERENCE_INVALID",
            `docs/adr/records/adr-registry.json record '${entry?.identifier || `index-${index}`}' has unreadable AI ADR frontmatter: ${error.message}`,
          );
        }
      }
    }

    const sortedRegistryNumbers = [...registryNumbers].sort((left, right) => left - right);
    if (JSON.stringify(registryNumbers) !== JSON.stringify(sortedRegistryNumbers)) {
      addIssue(
        issues,
        "ADR_REGISTRY_INVALID",
        "docs/adr/records/adr-registry.json records must be sorted by adrNumber ascending.",
      );
    }

    const expectedHumanAdrDocs = readdirSync(resolve(repoRoot, "docs/adr/records"))
      .filter((name) => /^adr-\d{3}-.*\.md$/.test(name) && !name.endsWith(".ai.md"))
      .map((name) => `docs/adr/records/${name}`)
      .sort();
    const expectedHumanAdrDocSet = new Set(expectedHumanAdrDocs);
    const registryHumanDocs = [...seenHumanPaths].filter((pathValue) => isNonEmptyString(pathValue)).sort();
    if (JSON.stringify(expectedHumanAdrDocs) !== JSON.stringify(registryHumanDocs)) {
      addIssue(
        issues,
        "ADR_REGISTRY_REFERENCE_INVALID",
        "docs/adr/records/adr-registry.json humanDocPath entries must match all ADR record docs in docs/adr/records.",
      );
    }

    const discoveryByStatus = adrRegistry.discoveryIndex?.byDecisionStatus || {};
    for (const status of ADR_DECISION_STATUSES) {
      if (!Array.isArray(discoveryByStatus[status])) {
        addIssue(
          issues,
          "ADR_REGISTRY_INVALID",
          `docs/adr/records/adr-registry.json discoveryIndex.byDecisionStatus must include array for '${status}'.`,
        );
      }
    }

    for (const [status, identifiers] of Object.entries(discoveryByStatus)) {
      if (!ADR_DECISION_STATUSES.has(status)) {
        addIssue(
          issues,
          "ADR_REGISTRY_INVALID",
          `docs/adr/records/adr-registry.json discoveryIndex.byDecisionStatus has unsupported key '${status}'.`,
        );
        continue;
      }
      if (!Array.isArray(identifiers) || !isArrayOfNonEmptyStrings(identifiers, { allowEmpty: true })) {
        addIssue(
          issues,
          "ADR_REGISTRY_INVALID",
          `docs/adr/records/adr-registry.json discoveryIndex.byDecisionStatus['${status}'] must be an array of strings.`,
        );
        continue;
      }
      const expectedIds = (adrRegistry.records || [])
        .filter((record) => record.decisionStatus === status)
        .map((record) => record.identifier);
      if (JSON.stringify(identifiers) !== JSON.stringify(expectedIds)) {
        addIssue(
          issues,
          "ADR_REGISTRY_REFERENCE_INVALID",
          `docs/adr/records/adr-registry.json discoveryIndex.byDecisionStatus['${status}'] must match record decisionStatus membership.`,
        );
      }
    }

    for (const [domain, identifiers] of Object.entries(adrRegistry.discoveryIndex?.byDomain || {})) {
      if (!isNonEmptyString(domain)) {
        addIssue(
          issues,
          "ADR_REGISTRY_INVALID",
          "docs/adr/records/adr-registry.json discoveryIndex.byDomain keys must be non-empty strings.",
        );
      }
      if (!Array.isArray(identifiers) || !isArrayOfNonEmptyStrings(identifiers, { allowEmpty: false })) {
        addIssue(
          issues,
          "ADR_REGISTRY_INVALID",
          `docs/adr/records/adr-registry.json discoveryIndex.byDomain['${domain}'] must be a non-empty string array.`,
        );
        continue;
      }
      for (const identifier of identifiers) {
        if (!registryIdentifiers.has(identifier)) {
          addIssue(
            issues,
            "ADR_REGISTRY_REFERENCE_INVALID",
            `docs/adr/records/adr-registry.json discoveryIndex.byDomain['${domain}'] references unknown identifier '${identifier}'.`,
          );
        }
      }
    }

    for (const [humanDocPath, frontmatter] of adrFrontmatterByHumanPath.entries()) {
      const aiFrontmatter = adrAiFrontmatterByHumanPath.get(humanDocPath);
      const humanContent = adrContentByHumanPath.get(humanDocPath) || "";
      const supersedes = typeof frontmatter.supersedes === "string" ? frontmatter.supersedes : "";
      const supersededBy = typeof frontmatter.superseded_by === "string" ? frontmatter.superseded_by : "";
      const hasSupersessionSection = /^##\s+Supersession\s*$/m.test(humanContent);

      if (aiFrontmatter) {
        for (const field of ["supersedes", "superseded_by"]) {
          if (frontmatter[field] !== aiFrontmatter[field]) {
            addIssue(
              issues,
              "ADR_SUPERSESSION_MISMATCH",
              `${humanDocPath} and AI companion differ for '${field}'.`,
            );
          }
        }
      }

      if (isNonEmptyString(supersedes) && isNonEmptyString(supersededBy)) {
        addIssue(
          issues,
          "ADR_SUPERSESSION_CONFLICT",
          `${humanDocPath} cannot set both supersedes and superseded_by.`,
        );
      }

      if ((isNonEmptyString(supersedes) || isNonEmptyString(supersededBy)) && !hasSupersessionSection) {
        addIssue(
          issues,
          "ADR_SUPERSESSION_SECTION_MISSING",
          `${humanDocPath} must include '## Supersession' when supersedes or superseded_by is set.`,
        );
      }

      if (frontmatter.decision_status === "superseded" && !isNonEmptyString(supersededBy)) {
        addIssue(
          issues,
          "ADR_SUPERSESSION_LINK_MISSING",
          `${humanDocPath} has decision_status 'superseded' but is missing superseded_by.`,
        );
      }

      if (isNonEmptyString(supersedes)) {
        if (!expectedHumanAdrDocSet.has(supersedes)) {
          addIssue(
            issues,
            "ADR_SUPERSESSION_REFERENCE_INVALID",
            `${humanDocPath} supersedes references unknown ADR path '${supersedes}'.`,
          );
        }
      }

      if (isNonEmptyString(supersededBy)) {
        if (!expectedHumanAdrDocSet.has(supersededBy)) {
          addIssue(
            issues,
            "ADR_SUPERSESSION_REFERENCE_INVALID",
            `${humanDocPath} superseded_by references unknown ADR path '${supersededBy}'.`,
          );
          continue;
        }

        const replacementFrontmatter = adrFrontmatterByHumanPath.get(supersededBy);
        if (!replacementFrontmatter) {
          addIssue(
            issues,
            "ADR_SUPERSESSION_REFERENCE_INVALID",
            `${humanDocPath} superseded_by target '${supersededBy}' is missing readable frontmatter.`,
          );
          continue;
        }

        if (replacementFrontmatter.decision_status !== "accepted") {
          addIssue(
            issues,
            "ADR_SUPERSESSION_TARGET_INVALID",
            `${humanDocPath} superseded_by target '${supersededBy}' must be decision_status 'accepted'.`,
          );
        }

        if (replacementFrontmatter.supersedes !== humanDocPath) {
          addIssue(
            issues,
            "ADR_SUPERSESSION_BACKLINK_MISSING",
            `${humanDocPath} superseded_by target '${supersededBy}' must set supersedes: ${humanDocPath}.`,
          );
        }
      }
    }
  }

  const routingContractTaskCategories = new Set(
    Array.isArray(routingContract?.supportedTaskCategories)
      ? routingContract.supportedTaskCategories
        .map((entry) => entry?.id)
        .filter((entry) => isNonEmptyString(entry))
      : [],
  );
  const routingAllowedSelectionModes = new Set(Array.isArray(routingContract?.allowedSelectionModes) ? routingContract.allowedSelectionModes : []);
  const routingAllowedPriorityTiers = new Set(Array.isArray(routingContract?.priorityTiers) ? routingContract.priorityTiers : []);
  const catalogPackIds = new Set(
    Array.isArray(catalogSeed?.packs)
      ? catalogSeed.packs
        .map((entry) => entry?.id)
        .filter((entry) => isNonEmptyString(entry))
      : [],
  );

  if (catalogSeed && catalogContract) {
    const requiredCatalogFields = Array.isArray(catalogContract.entryRequiredFields)
      ? catalogContract.entryRequiredFields
      : [];
    const allowedStatusValues = new Set(Array.isArray(catalogContract.allowedStatusValues) ? catalogContract.allowedStatusValues : []);
    const registryRecordIds = new Set(
      Array.isArray(documentationRegistry?.entries)
        ? documentationRegistry.entries
          .map((entry) => entry?.recordId)
          .filter((value) => isNonEmptyString(value))
        : [],
    );
    const registryRecordIdByPath = new Map(
      Array.isArray(documentationRegistry?.entries)
        ? documentationRegistry.entries
          .filter((entry) => isNonEmptyString(entry?.path) && isNonEmptyString(entry?.recordId))
          .map((entry) => [entry.path, entry.recordId])
        : [],
    );

    for (const [index, packEntry] of (catalogSeed.packs || []).entries()) {
      if (!packEntry || typeof packEntry !== "object") {
        addIssue(
          issues,
          "CONTEXT_PACK_SHAPE_INVALID",
          `docs/context/packs/context-pack-catalog.seed.json pack index ${index} must be an object.`,
        );
        continue;
      }

      for (const field of requiredCatalogFields) {
        const fieldValue = packEntry[field];
        if (Array.isArray(fieldValue)) {
          if (fieldValue.length === 0 || !isArrayOfNonEmptyStrings(fieldValue)) {
            addIssue(
              issues,
              "CONTEXT_PACK_SHAPE_INVALID",
              `docs/context/packs/context-pack-catalog.seed.json pack '${packEntry.id || `index-${index}`}' field '${field}' must be a non-empty string array.`,
            );
          }
          continue;
        }

        if (!isNonEmptyString(fieldValue)) {
          addIssue(
            issues,
            "CONTEXT_PACK_SHAPE_INVALID",
            `docs/context/packs/context-pack-catalog.seed.json pack '${packEntry.id || `index-${index}`}' is missing required field '${field}'.`,
          );
        }
      }

      if (isNonEmptyString(packEntry.status) && allowedStatusValues.size > 0 && !allowedStatusValues.has(packEntry.status)) {
        addIssue(
          issues,
          "CONTEXT_PACK_SHAPE_INVALID",
          `docs/context/packs/context-pack-catalog.seed.json pack '${packEntry.id || `index-${index}`}' has unsupported status '${packEntry.status}'.`,
        );
      }

      for (const pathField of ["primaryDocPath", "aiDocPath"]) {
        if (!isNonEmptyString(packEntry[pathField])) {
          continue;
        }
        const absolutePath = resolve(repoRoot, packEntry[pathField]);
        if (!existsSync(absolutePath)) {
          addIssue(
            issues,
            "CONTEXT_PACK_REFERENCE_INVALID",
            `docs/context/packs/context-pack-catalog.seed.json pack '${packEntry.id || `index-${index}`}' references missing file '${packEntry[pathField]}'.`,
          );
        }
      }

      for (const listField of ["relatedDocPaths", "relatedCodePaths"]) {
        const listValue = packEntry[listField];
        if (!Array.isArray(listValue)) {
          continue;
        }
        for (const referencePath of listValue) {
          if (!isNonEmptyString(referencePath)) {
            addIssue(
              issues,
              "CONTEXT_PACK_REFERENCE_INVALID",
              `docs/context/packs/context-pack-catalog.seed.json pack '${packEntry.id || `index-${index}`}' has non-string ${listField} entry.`,
            );
            continue;
          }
          if (!pathExistsForReference(repoRoot, referencePath)) {
            addIssue(
              issues,
              "CONTEXT_PACK_REFERENCE_INVALID",
              `docs/context/packs/context-pack-catalog.seed.json pack '${packEntry.id || `index-${index}`}' references missing ${listField} path '${referencePath}'.`,
            );
          }
        }
      }

      if (!isArrayOfNonEmptyStrings(packEntry.relatedDocRecordIds)) {
        addIssue(
          issues,
          "CONTEXT_PACK_REFERENCE_INVALID",
          `docs/context/packs/context-pack-catalog.seed.json pack '${packEntry.id || `index-${index}`}' must include non-empty relatedDocRecordIds for stable registry linking.`,
        );
      } else {
        const packRecordIds = new Set(packEntry.relatedDocRecordIds);
        for (const recordId of packEntry.relatedDocRecordIds) {
          if (!registryRecordIds.has(recordId)) {
            addIssue(
              issues,
              "CONTEXT_PACK_REFERENCE_INVALID",
              `docs/context/packs/context-pack-catalog.seed.json pack '${packEntry.id || `index-${index}`}' references unknown relatedDocRecordId '${recordId}'.`,
            );
          }
        }

        const indexedDocPaths = [
          packEntry.primaryDocPath,
          ...(Array.isArray(packEntry.relatedDocPaths) ? packEntry.relatedDocPaths : []),
        ].filter((value) => isNonEmptyString(value) && registryRecordIdByPath.has(value));

        for (const indexedDocPath of indexedDocPaths) {
          const expectedRecordId = registryRecordIdByPath.get(indexedDocPath);
          if (isNonEmptyString(expectedRecordId) && !packRecordIds.has(expectedRecordId)) {
            addIssue(
              issues,
              "CONTEXT_PACK_REFERENCE_INVALID",
              `docs/context/packs/context-pack-catalog.seed.json pack '${packEntry.id || `index-${index}`}' references indexed doc path '${indexedDocPath}' but is missing relatedDocRecordId '${expectedRecordId}'.`,
            );
          }
        }
      }
    }
  }

  if (packContractSpec && catalogSeed && Array.isArray(catalogSeed.packs) && Array.isArray(packContractSpec.requiredSections)) {
    const requiredHeadings = packContractSpec.requiredSections
      .map((section) => section?.heading)
      .filter((heading) => isNonEmptyString(heading));

    for (const packEntry of catalogSeed.packs) {
      if (!packEntry || typeof packEntry !== "object" || !isNonEmptyString(packEntry.id)) {
        continue;
      }

      for (const pathField of ["primaryDocPath", "aiDocPath"]) {
        const packPath = packEntry[pathField];
        if (!isNonEmptyString(packPath)) {
          continue;
        }

        const absolutePackPath = resolve(repoRoot, packPath);
        if (!existsSync(absolutePackPath)) {
          continue;
        }

        const content = readFileSync(absolutePackPath, "utf8");
        for (const heading of requiredHeadings) {
          if (!content.includes(heading)) {
            addIssue(
              issues,
              "CONTEXT_PACK_SHAPE_INVALID",
              `${packPath} is missing required heading '${heading}'.`,
            );
          }
        }

        const authoritativeDocsSection = extractSectionBody(content, "## Authoritative Docs");
        for (const pathValue of extractBacktickedValues(authoritativeDocsSection)) {
          if (!pathExistsForReference(repoRoot, pathValue)) {
            addIssue(
              issues,
              "CONTEXT_PACK_REFERENCE_INVALID",
              `${packPath} references missing authoritative doc path '${pathValue}'.`,
            );
          }
        }

        const authoritativeCodeSection = extractSectionBody(content, "## Authoritative Code Paths");
        for (const pathValue of extractBacktickedValues(authoritativeCodeSection)) {
          if (!pathExistsForReference(repoRoot, pathValue)) {
            addIssue(
              issues,
              "CONTEXT_PACK_REFERENCE_INVALID",
              `${packPath} references missing authoritative code path '${pathValue}'.`,
            );
          }
        }

        const relatedPacksSection = extractSectionBody(content, "## Related Packs");
        for (const maybePackId of extractBacktickedValues(relatedPacksSection)) {
          if (/^[a-z0-9][a-z0-9-]*$/.test(maybePackId) && catalogPackIds.size > 0 && !catalogPackIds.has(maybePackId)) {
            addIssue(
              issues,
              "CONTEXT_PACK_REFERENCE_INVALID",
              `${packPath} references unknown related pack '${maybePackId}'.`,
            );
          }
        }
      }
    }
  }

  if (contextMap) {
    if (contextMap.schemaVersion !== "1.0.0" || contextMap.artifactType !== "context-map") {
      addIssue(
        issues,
        "CONTEXT_MAP_INVALID",
        "docs/context/context-map.json must declare schemaVersion 1.0.0 and artifactType context-map.",
      );
    }

    if (contextMap.routingContractPath !== "docs/context/routing/task-to-context-routing.contract.json"
      || contextMap.routingSeedPath !== "docs/context/routing/task-to-context-routing.seed.json"
      || contextMap.contextPackCatalogPath !== "docs/context/packs/context-pack-catalog.seed.json") {
      addIssue(
        issues,
        "CONTEXT_MAP_INVALID_REFERENCE",
        "docs/context/context-map.json must reference canonical routing and pack catalog artifact paths.",
      );
    }

    if (!Array.isArray(contextMap.taskCategoryDefaults) || contextMap.taskCategoryDefaults.length === 0) {
      addIssue(
        issues,
        "CONTEXT_MAP_INVALID",
        "docs/context/context-map.json must include non-empty taskCategoryDefaults.",
      );
    }

    if (!Array.isArray(contextMap.taskCategoryMappings) || contextMap.taskCategoryMappings.length === 0) {
      addIssue(
        issues,
        "CONTEXT_MAP_INVALID",
        "docs/context/context-map.json must include non-empty taskCategoryMappings.",
      );
    }

    const contextProfileIds = new Set(
      Array.isArray(contextMap.contextAssemblyPolicy?.profileCatalog)
        ? contextMap.contextAssemblyPolicy.profileCatalog
          .map((profile) => profile?.profileId)
          .filter((profileId) => isNonEmptyString(profileId))
        : [],
    );

    const globalExclusionTagIds = new Set(
      Array.isArray(contextMap.globalExclusionTags)
        ? contextMap.globalExclusionTags
          .map((tag) => tag?.tagId)
          .filter((tagId) => isNonEmptyString(tagId))
        : [],
    );
    const authoritativeSourceTags = new Set(
      Array.isArray(contextMap.authorityTagCatalog?.authoritativeSourceTags)
        ? contextMap.authorityTagCatalog.authoritativeSourceTags
        : [],
    );
    const relatedSourceTags = new Set(
      Array.isArray(contextMap.authorityTagCatalog?.relatedSourceTags)
        ? contextMap.authorityTagCatalog.relatedSourceTags
        : [],
    );

    for (const entry of contextMap.taskCategoryDefaults || []) {
      if (!isNonEmptyString(entry.taskCategoryId)) {
        addIssue(issues, "CONTEXT_MAP_INVALID", "docs/context/context-map.json taskCategoryDefaults entries must include taskCategoryId.");
        continue;
      }
      if (routingContractTaskCategories.size > 0 && !routingContractTaskCategories.has(entry.taskCategoryId)) {
        addIssue(
          issues,
          "CONTEXT_MAP_INVALID_REFERENCE",
          `docs/context/context-map.json default category '${entry.taskCategoryId}' is not present in routing contract supportedTaskCategories.`,
        );
      }
      if (routingAllowedSelectionModes.size > 0 && !routingAllowedSelectionModes.has(entry.selectionMode)) {
        addIssue(
          issues,
          "CONTEXT_MAP_INVALID_REFERENCE",
          `docs/context/context-map.json default category '${entry.taskCategoryId}' uses unsupported selectionMode '${entry.selectionMode}'.`,
        );
      }
      if (routingAllowedPriorityTiers.size > 0 && !routingAllowedPriorityTiers.has(entry.priorityTier)) {
        addIssue(
          issues,
          "CONTEXT_MAP_INVALID_REFERENCE",
          `docs/context/context-map.json default category '${entry.taskCategoryId}' uses unsupported priorityTier '${entry.priorityTier}'.`,
        );
      }
      if (!contextProfileIds.has(entry.contextAssemblyProfileId)) {
        addIssue(
          issues,
          "CONTEXT_MAP_INVALID_REFERENCE",
          `docs/context/context-map.json default category '${entry.taskCategoryId}' references unknown contextAssemblyProfileId '${entry.contextAssemblyProfileId}'.`,
        );
      }
    }

    for (const mapping of contextMap.taskCategoryMappings || []) {
      if (!isNonEmptyString(mapping.taskCategoryId)) {
        addIssue(issues, "CONTEXT_MAP_INVALID", "docs/context/context-map.json taskCategoryMappings entries must include taskCategoryId.");
        continue;
      }
      if (routingContractTaskCategories.size > 0 && !routingContractTaskCategories.has(mapping.taskCategoryId)) {
        addIssue(
          issues,
          "CONTEXT_MAP_INVALID_REFERENCE",
          `docs/context/context-map.json mapping '${mapping.mappingId || "<unknown>"}' uses unsupported taskCategoryId '${mapping.taskCategoryId}'.`,
        );
      }
      if (!contextProfileIds.has(mapping.contextAssemblyProfileId)) {
        addIssue(
          issues,
          "CONTEXT_MAP_INVALID_REFERENCE",
          `docs/context/context-map.json mapping '${mapping.mappingId || "<unknown>"}' references unknown contextAssemblyProfileId '${mapping.contextAssemblyProfileId}'.`,
        );
      }
      if (!Array.isArray(mapping.packRefs) || mapping.packRefs.length === 0) {
        addIssue(
          issues,
          "CONTEXT_MAP_INVALID",
          `docs/context/context-map.json mapping '${mapping.mappingId || "<unknown>"}' must include non-empty packRefs.`,
        );
      } else {
        const packOrders = new Set();
        for (const packRef of mapping.packRefs) {
          if (!isNonEmptyString(packRef.packId) || (catalogPackIds.size > 0 && !catalogPackIds.has(packRef.packId))) {
            addIssue(
              issues,
              "CONTEXT_MAP_INVALID_REFERENCE",
              `docs/context/context-map.json mapping '${mapping.mappingId || "<unknown>"}' references unknown pack '${packRef.packId}'.`,
            );
          }
          if (!Number.isInteger(packRef.priorityOrder) || packRef.priorityOrder <= 0) {
            addIssue(
              issues,
              "CONTEXT_MAP_INVALID",
              `docs/context/context-map.json mapping '${mapping.mappingId || "<unknown>"}' contains invalid priorityOrder '${packRef.priorityOrder}'.`,
            );
          }
          if (packOrders.has(packRef.priorityOrder)) {
            addIssue(
              issues,
              "CONTEXT_MAP_INVALID",
              `docs/context/context-map.json mapping '${mapping.mappingId || "<unknown>"}' contains duplicate priorityOrder '${packRef.priorityOrder}'.`,
            );
          }
          packOrders.add(packRef.priorityOrder);
        }
      }

      if (!isArrayOfNonEmptyStrings(mapping.exclusionTagIds)) {
        addIssue(
          issues,
          "CONTEXT_MAP_INVALID",
          `docs/context/context-map.json mapping '${mapping.mappingId || "<unknown>"}' must include non-empty exclusionTagIds.`,
        );
      } else {
        for (const exclusionTagId of mapping.exclusionTagIds) {
          if (!globalExclusionTagIds.has(exclusionTagId)) {
            addIssue(
              issues,
              "CONTEXT_MAP_INVALID_REFERENCE",
              `docs/context/context-map.json mapping '${mapping.mappingId || "<unknown>"}' references unknown exclusionTagId '${exclusionTagId}'.`,
            );
          }
        }
      }

      for (const sourceTag of mapping.authoritativeSourceTags || []) {
        if (!authoritativeSourceTags.has(sourceTag)) {
          addIssue(
            issues,
            "CONTEXT_MAP_INVALID_REFERENCE",
            `docs/context/context-map.json mapping '${mapping.mappingId || "<unknown>"}' references unknown authoritativeSourceTag '${sourceTag}'.`,
          );
        }
      }
      for (const sourceTag of mapping.relatedSourceTags || []) {
        if (!relatedSourceTags.has(sourceTag)) {
          addIssue(
            issues,
            "CONTEXT_MAP_INVALID_REFERENCE",
            `docs/context/context-map.json mapping '${mapping.mappingId || "<unknown>"}' references unknown relatedSourceTag '${sourceTag}'.`,
          );
        }
      }

      const tierHints = mapping.contextAssemblyTierHints || {};
      for (const tierKey of ["foundation", "domain", "implementation", "optional"]) {
        const hint = tierHints[tierKey];
        if (!hint || typeof hint !== "object") {
          addIssue(
            issues,
            "CONTEXT_MAP_INVALID",
            `docs/context/context-map.json mapping '${mapping.mappingId || "<unknown>"}' is missing contextAssemblyTierHints.${tierKey}.`,
          );
          continue;
        }
        if (!Number.isFinite(hint.weight)) {
          addIssue(
            issues,
            "CONTEXT_MAP_INVALID",
            `docs/context/context-map.json mapping '${mapping.mappingId || "<unknown>"}' has non-numeric contextAssemblyTierHints.${tierKey}.weight.`,
          );
        }
        if (typeof hint.includeByDefault !== "boolean") {
          addIssue(
            issues,
            "CONTEXT_MAP_INVALID",
            `docs/context/context-map.json mapping '${mapping.mappingId || "<unknown>"}' must set boolean contextAssemblyTierHints.${tierKey}.includeByDefault.`,
          );
        }
      }
    }
  }

  if (routingSeed) {
    const contextProfileIds = new Set(
      Array.isArray(contextMap?.contextAssemblyPolicy?.profileCatalog)
        ? contextMap.contextAssemblyPolicy.profileCatalog
          .map((profile) => profile?.profileId)
          .filter((profileId) => isNonEmptyString(profileId))
        : [],
    );
    const registryRecordIds = new Set(
      Array.isArray(documentationRegistry?.entries)
        ? documentationRegistry.entries
          .map((entry) => entry?.recordId)
          .filter((value) => isNonEmptyString(value))
        : [],
    );
    const registryRecordIdByPath = new Map(
      Array.isArray(documentationRegistry?.entries)
        ? documentationRegistry.entries
          .filter((entry) => isNonEmptyString(entry?.path) && isNonEmptyString(entry?.recordId))
          .map((entry) => [entry.path, entry.recordId])
        : [],
    );

    for (const mapping of routingSeed.mappings || []) {
      if (routingContractTaskCategories.size > 0 && !routingContractTaskCategories.has(mapping.taskCategory)) {
        addIssue(
          issues,
          "ROUTING_REFERENCE_INVALID",
          `docs/context/routing/task-to-context-routing.seed.json mapping '${mapping.taskId || "<unknown>"}' uses unsupported taskCategory '${mapping.taskCategory}'.`,
        );
      }
      if (!isArrayOfNonEmptyStrings(mapping.packIds || [])) {
        addIssue(
          issues,
          "ROUTING_REFERENCE_INVALID",
          `docs/context/routing/task-to-context-routing.seed.json mapping '${mapping.taskId || "<unknown>"}' must include non-empty packIds.`,
        );
      } else {
        for (const packId of mapping.packIds) {
          if (catalogPackIds.size > 0 && !catalogPackIds.has(packId)) {
            addIssue(
              issues,
              "ROUTING_REFERENCE_INVALID",
              `docs/context/routing/task-to-context-routing.seed.json mapping '${mapping.taskId || "<unknown>"}' references unknown packId '${packId}'.`,
            );
          }
        }
      }
      if (contextProfileIds.size > 0 && !contextProfileIds.has(mapping.contextAssemblyProfileId)) {
        addIssue(
          issues,
          "ROUTING_REFERENCE_INVALID",
          `docs/context/routing/task-to-context-routing.seed.json mapping '${mapping.taskId || "<unknown>"}' references unknown contextAssemblyProfileId '${mapping.contextAssemblyProfileId}'.`,
        );
      }

      for (const listField of ["relatedDocPaths", "relatedCodePaths"]) {
        const listValue = mapping[listField];
        if (!Array.isArray(listValue) || listValue.length === 0) {
          addIssue(
            issues,
            "ROUTING_REFERENCE_INVALID",
            `docs/context/routing/task-to-context-routing.seed.json mapping '${mapping.taskId || "<unknown>"}' must include non-empty ${listField}.`,
          );
          continue;
        }
        for (const referencePath of listValue) {
          if (!isNonEmptyString(referencePath)) {
            addIssue(
              issues,
              "ROUTING_REFERENCE_INVALID",
              `docs/context/routing/task-to-context-routing.seed.json mapping '${mapping.taskId || "<unknown>"}' has non-string ${listField} entry.`,
            );
            continue;
          }
          if (!pathExistsForReference(repoRoot, referencePath)) {
            addIssue(
              issues,
              "ROUTING_REFERENCE_INVALID",
              `docs/context/routing/task-to-context-routing.seed.json mapping '${mapping.taskId || "<unknown>"}' references missing ${listField} path '${referencePath}'.`,
            );
          }
        }
      }

      if (!isArrayOfNonEmptyStrings(mapping.relatedDocRecordIds)) {
        addIssue(
          issues,
          "ROUTING_REFERENCE_INVALID",
          `docs/context/routing/task-to-context-routing.seed.json mapping '${mapping.taskId || "<unknown>"}' must include non-empty relatedDocRecordIds for stable registry linking.`,
        );
      } else {
        const mappingRecordIds = new Set(mapping.relatedDocRecordIds);
        for (const recordId of mapping.relatedDocRecordIds) {
          if (!registryRecordIds.has(recordId)) {
            addIssue(
              issues,
              "ROUTING_REFERENCE_INVALID",
              `docs/context/routing/task-to-context-routing.seed.json mapping '${mapping.taskId || "<unknown>"}' references unknown relatedDocRecordId '${recordId}'.`,
            );
          }
        }

        const indexedDocPaths = Array.isArray(mapping.relatedDocPaths)
          ? mapping.relatedDocPaths
            .filter((value) => isNonEmptyString(value) && registryRecordIdByPath.has(value))
          : [];
        for (const indexedDocPath of indexedDocPaths) {
          const expectedRecordId = registryRecordIdByPath.get(indexedDocPath);
          if (isNonEmptyString(expectedRecordId) && !mappingRecordIds.has(expectedRecordId)) {
            addIssue(
              issues,
              "ROUTING_REFERENCE_INVALID",
              `docs/context/routing/task-to-context-routing.seed.json mapping '${mapping.taskId || "<unknown>"}' references indexed relatedDocPath '${indexedDocPath}' but is missing relatedDocRecordId '${expectedRecordId}'.`,
            );
          }
        }
      }
    }

    for (const example of routingSeed.routingExamples || []) {
      if (!isArrayOfNonEmptyStrings(example.expectedPackOrder || [])) {
        addIssue(
          issues,
          "ROUTING_REFERENCE_INVALID",
          `docs/context/routing/task-to-context-routing.seed.json routing example '${example.taskId || "<unknown>"}' must include non-empty expectedPackOrder.`,
        );
      } else {
        for (const packId of example.expectedPackOrder) {
          if (catalogPackIds.size > 0 && !catalogPackIds.has(packId)) {
            addIssue(
              issues,
              "ROUTING_REFERENCE_INVALID",
              `docs/context/routing/task-to-context-routing.seed.json routing example '${example.taskId || "<unknown>"}' references unknown expectedPackOrder pack '${packId}'.`,
            );
          }
        }
      }

      if (Array.isArray(example.expectedRelatedDocOrder)) {
        for (const referencePath of example.expectedRelatedDocOrder) {
          if (!isNonEmptyString(referencePath)) {
            addIssue(
              issues,
              "ROUTING_REFERENCE_INVALID",
              `docs/context/routing/task-to-context-routing.seed.json routing example '${example.taskId || "<unknown>"}' has non-string expectedRelatedDocOrder entry.`,
            );
            continue;
          }
          if (!pathExistsForReference(repoRoot, referencePath)) {
            addIssue(
              issues,
              "ROUTING_REFERENCE_INVALID",
              `docs/context/routing/task-to-context-routing.seed.json routing example '${example.taskId || "<unknown>"}' references missing expectedRelatedDocOrder path '${referencePath}'.`,
            );
          }
        }
      }

      const indexedDocPaths = Array.isArray(example.expectedRelatedDocOrder)
        ? example.expectedRelatedDocOrder
          .filter((value) => isNonEmptyString(value) && registryRecordIdByPath.has(value))
        : [];
      if (indexedDocPaths.length > 0 && !isArrayOfNonEmptyStrings(example.relatedDocRecordIds)) {
        addIssue(
          issues,
          "ROUTING_REFERENCE_INVALID",
          `docs/context/routing/task-to-context-routing.seed.json routing example '${example.taskId || "<unknown>"}' must include non-empty relatedDocRecordIds when expectedRelatedDocOrder includes indexed docs.`,
        );
      } else if (example.relatedDocRecordIds !== undefined) {
        const exampleRecordIds = new Set(example.relatedDocRecordIds);
        for (const recordId of example.relatedDocRecordIds) {
          if (!registryRecordIds.has(recordId)) {
            addIssue(
              issues,
              "ROUTING_REFERENCE_INVALID",
              `docs/context/routing/task-to-context-routing.seed.json routing example '${example.taskId || "<unknown>"}' references unknown relatedDocRecordId '${recordId}'.`,
            );
          }
        }

        for (const indexedDocPath of indexedDocPaths) {
          const expectedRecordId = registryRecordIdByPath.get(indexedDocPath);
          if (isNonEmptyString(expectedRecordId) && !exampleRecordIds.has(expectedRecordId)) {
            addIssue(
              issues,
              "ROUTING_REFERENCE_INVALID",
              `docs/context/routing/task-to-context-routing.seed.json routing example '${example.taskId || "<unknown>"}' references indexed expectedRelatedDocOrder path '${indexedDocPath}' but is missing relatedDocRecordId '${expectedRecordId}'.`,
            );
          }
        }
      }
    }
  }

  const taxonomyContractPath = resolve(repoRoot, "docs/context/documentation-taxonomy.contract.json");
  const metadataContractPath = resolve(repoRoot, "docs/context/documentation-metadata-header.contract.json");

  if (!existsSync(taxonomyContractPath)) {
    issues.push({
      code: "CONTRACT_MISSING",
      message: "Missing taxonomy contract: docs/context/documentation-taxonomy.contract.json",
    });
  }

  if (!existsSync(metadataContractPath)) {
    issues.push({
      code: "CONTRACT_MISSING",
      message: "Missing metadata header contract: docs/context/documentation-metadata-header.contract.json",
    });
  }

  if (!existsSync(taxonomyContractPath) || !existsSync(metadataContractPath)) {
    return issues;
  }

  const taxonomyContract = readJson(taxonomyContractPath);
  const metadataContract = readJson(metadataContractPath);

  const allowedDocTypes = new Set(taxonomyContract.metadataFields.document_type.allowedValues);
  const allowedStatuses = new Set(taxonomyContract.metadataFields.status.allowedValues);
  const allowedAuthoritativeness = new Set(taxonomyContract.metadataFields.authoritativeness.allowedValues);
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  if (indexedDocumentMetadataContract) {
    if (
      indexedDocumentMetadataContract.derivedFromTaxonomyContractPath !== "docs/context/documentation-taxonomy.contract.json"
    ) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-indexed-document-metadata.contract.json must reference docs/context/documentation-taxonomy.contract.json.",
      });
    }

    const indexedFieldDefs = indexedDocumentMetadataContract.fieldDefinitions || {};
    if (indexedFieldDefs.docType?.derivedFromTaxonomyField !== "document_type") {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-indexed-document-metadata.contract.json fieldDefinitions.docType must derive from taxonomy field document_type.",
      });
    }
    if (indexedFieldDefs.status?.derivedFromTaxonomyField !== "status") {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-indexed-document-metadata.contract.json fieldDefinitions.status must derive from taxonomy field status.",
      });
    }
    if (indexedFieldDefs.authoritativeness?.derivedFromTaxonomyField !== "authoritativeness") {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-indexed-document-metadata.contract.json fieldDefinitions.authoritativeness must derive from taxonomy field authoritativeness.",
      });
    }

    const exampleEntry = indexedDocumentMetadataContract.exampleEntry || {};
    if (!allowedDocTypes.has(exampleEntry.docType)) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-indexed-document-metadata.contract.json exampleEntry.docType must use taxonomy document_type values.",
      });
    }
    if (!allowedStatuses.has(exampleEntry.status)) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-indexed-document-metadata.contract.json exampleEntry.status must use taxonomy status values.",
      });
    }
    if (!allowedAuthoritativeness.has(exampleEntry.authoritativeness)) {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/documentation-indexed-document-metadata.contract.json exampleEntry.authoritativeness must use taxonomy authoritativeness values.",
      });
    }
  }

  if (documentationRegistry) {
    const requiredEntryFields = new Set(REQUIRED_DOCUMENTATION_REGISTRY_ENTRY_FIELDS);
    const optionalEntryFields = new Set(OPTIONAL_INDEXED_DOCUMENT_METADATA_FIELDS);

    if (
      JSON.stringify(documentationRegistry.docTypeCatalog || []) !== JSON.stringify([...allowedDocTypes])
    ) {
      addIssue(
        issues,
        "CONTEXT_REGISTRY_INVALID",
        "docs/context/documentation-registry.seed.json docTypeCatalog must align with taxonomy document_type allowed values.",
      );
    }
    if (
      JSON.stringify(documentationRegistry.statusCatalog || []) !== JSON.stringify([...allowedStatuses])
    ) {
      addIssue(
        issues,
        "CONTEXT_REGISTRY_INVALID",
        "docs/context/documentation-registry.seed.json statusCatalog must align with taxonomy status allowed values.",
      );
    }
    if (
      JSON.stringify(documentationRegistry.authoritativenessCatalog || []) !== JSON.stringify([...allowedAuthoritativeness])
    ) {
      addIssue(
        issues,
        "CONTEXT_REGISTRY_INVALID",
        "docs/context/documentation-registry.seed.json authoritativenessCatalog must align with taxonomy authoritativeness allowed values.",
      );
    }

    const entryIds = new Set();
    for (const entry of documentationRegistry.entries || []) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        addIssue(
          issues,
          "CONTEXT_REGISTRY_INVALID",
          "docs/context/documentation-registry.seed.json entries must contain objects only.",
        );
        continue;
      }

      for (const fieldName of requiredEntryFields) {
        if (!isNonEmptyString(entry[fieldName])) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json entry is missing required non-empty field '${fieldName}'.`,
          );
        }
      }

      const recordId = entry.recordId;
      if (isNonEmptyString(recordId)) {
        if (!DOCUMENTATION_RECORD_ID_PATTERN.test(recordId)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json entry has invalid recordId '${recordId}'. Record ids must match '${DOCUMENTATION_RECORD_ID_PATTERN.source}'.`,
          );
        }
        if (entryIds.has(recordId)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json has duplicate recordId '${recordId}'.`,
          );
        }
        entryIds.add(recordId);
      }

      for (const fieldName of Object.keys(entry)) {
        if (!requiredEntryFields.has(fieldName) && !optionalEntryFields.has(fieldName)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' uses unsupported field '${fieldName}'.`,
          );
        }
      }

      if (isNonEmptyString(entry.path)) {
        if (!entry.path.startsWith("docs/") || !entry.path.endsWith(".md") || entry.path.endsWith(".ai.md")) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' has invalid path '${entry.path}'.`,
          );
        } else if (!pathExistsForReference(repoRoot, entry.path)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' references missing path '${entry.path}'.`,
          );
        }
      }

      if (entry.aiPath !== undefined) {
        if (!isNonEmptyString(entry.aiPath) || !entry.aiPath.endsWith(".ai.md")) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' has invalid aiPath '${entry.aiPath}'.`,
          );
        } else if (!pathExistsForReference(repoRoot, entry.aiPath)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' references missing aiPath '${entry.aiPath}'.`,
          );
        }
      }

      if (isNonEmptyString(entry.docType) && !allowedDocTypes.has(entry.docType)) {
        addIssue(
          issues,
          "CONTEXT_REGISTRY_INVALID",
          `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' uses unsupported docType '${entry.docType}'.`,
        );
      }
      if (isNonEmptyString(entry.status) && !allowedStatuses.has(entry.status)) {
        addIssue(
          issues,
          "CONTEXT_REGISTRY_INVALID",
          `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' uses unsupported status '${entry.status}'.`,
        );
      }
      if (isNonEmptyString(entry.authoritativeness) && !allowedAuthoritativeness.has(entry.authoritativeness)) {
        addIssue(
          issues,
          "CONTEXT_REGISTRY_INVALID",
          `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' uses unsupported authoritativeness '${entry.authoritativeness}'.`,
        );
      }

      for (const listField of ["keywords", "relatedCodePaths", "relatedDocs"]) {
        if (entry[listField] !== undefined && !isArrayOfNonEmptyStrings(entry[listField])) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' field '${listField}' must be a non-empty string array when set.`,
          );
        }
      }

      if (entry.relatedRecordIds !== undefined && !isArrayOfNonEmptyStrings(entry.relatedRecordIds)) {
        addIssue(
          issues,
          "CONTEXT_REGISTRY_INVALID",
          `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' field 'relatedRecordIds' must be a non-empty string array when set.`,
        );
      }

      for (const referenceField of ["relatedCodePaths", "relatedDocs", "supersedes", "supersededBy"]) {
        const value = entry[referenceField];
        if (Array.isArray(value)) {
          for (const pathValue of value) {
            if (!pathExistsForReference(repoRoot, pathValue)) {
              addIssue(
                issues,
                "CONTEXT_REGISTRY_INVALID",
                `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' references missing ${referenceField} path '${pathValue}'.`,
              );
            }
          }
        } else if (isNonEmptyString(value) && !pathExistsForReference(repoRoot, value)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' references missing ${referenceField} path '${value}'.`,
          );
        }
      }

      if (entry.supersedes && entry.supersededBy) {
        addIssue(
          issues,
          "CONTEXT_REGISTRY_INVALID",
          `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' cannot set both supersedes and supersededBy.`,
        );
      }
      if (entry.status === "superseded" && !isNonEmptyString(entry.supersededBy)) {
        addIssue(
          issues,
          "CONTEXT_REGISTRY_INVALID",
          `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' with status superseded must set supersededBy.`,
        );
      }

      if (entry.lastReviewed !== undefined) {
        if (!isNonEmptyString(entry.lastReviewed) || !isValidIsoDate(entry.lastReviewed)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' has invalid lastReviewed '${entry.lastReviewed}'.`,
          );
        } else {
          const reviewedDate = new Date(`${entry.lastReviewed}T00:00:00.000Z`);
          if (reviewedDate.getTime() > todayUtc.getTime()) {
            addIssue(
              issues,
              "CONTEXT_REGISTRY_INVALID",
              `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' has future lastReviewed '${entry.lastReviewed}'.`,
            );
          }
        }
      }
    }

    for (const entry of documentationRegistry.entries || []) {
      if (!Array.isArray(entry?.relatedRecordIds)) {
        continue;
      }
      for (const referencedRecordId of entry.relatedRecordIds) {
        if (!entryIds.has(referencedRecordId)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' references unknown relatedRecordId '${referencedRecordId}'.`,
          );
        } else if (entry.recordId === referencedRecordId) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json entry '${entry.recordId || "<unknown>"}' cannot reference itself in relatedRecordIds.`,
          );
        }
      }
    }

    const discoveryIndex = documentationRegistry.discoveryIndex || {};
    const indexChecks = [
      { indexName: "byDocType", requiredKeys: documentationRegistry.docTypeCatalog || [], entryField: "docType" },
      { indexName: "byStatus", requiredKeys: documentationRegistry.statusCatalog || [], entryField: "status" },
      { indexName: "byAuthoritativeness", requiredKeys: documentationRegistry.authoritativenessCatalog || [], entryField: "authoritativeness" },
      { indexName: "byDomain", requiredKeys: Object.keys(documentationRegistry.domainRelationships || {}), entryField: "domain" },
    ];

    for (const { indexName, requiredKeys, entryField } of indexChecks) {
      const indexMap = discoveryIndex[indexName];
      if (!indexMap || typeof indexMap !== "object" || Array.isArray(indexMap)) {
        continue;
      }

      for (const requiredKey of requiredKeys) {
        if (!Array.isArray(indexMap[requiredKey])) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json discoveryIndex.${indexName} must include key '${requiredKey}' with an array value.`,
          );
        }
      }

      for (const [key, recordIds] of Object.entries(indexMap)) {
        if (!Array.isArray(recordIds)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json discoveryIndex.${indexName}.${key} must be an array.`,
          );
          continue;
        }

        for (const recordId of recordIds) {
          if (!isNonEmptyString(recordId) || !entryIds.has(recordId)) {
            addIssue(
              issues,
              "CONTEXT_REGISTRY_INVALID",
              `docs/context/documentation-registry.seed.json discoveryIndex.${indexName}.${key} references unknown recordId '${recordId}'.`,
            );
          }
        }
      }

      for (const entry of documentationRegistry.entries || []) {
        const key = entry?.[entryField];
        if (!isNonEmptyString(entry?.recordId) || !isNonEmptyString(key)) {
          continue;
        }

        const keyList = Array.isArray(indexMap[key]) ? indexMap[key] : [];
        if (!keyList.includes(entry.recordId)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json discoveryIndex.${indexName}.${key} must include '${entry.recordId}'.`,
          );
        }
      }
    }

    const byTaskCategory = discoveryIndex.byTaskCategory;
    if (!byTaskCategory || typeof byTaskCategory !== "object" || Array.isArray(byTaskCategory)) {
      addIssue(
        issues,
        "CONTEXT_REGISTRY_INVALID",
        "docs/context/documentation-registry.seed.json discoveryIndex.byTaskCategory must be an object map.",
      );
    } else {
      const requiredTaskCategories = routingContractTaskCategories.size > 0
        ? [...routingContractTaskCategories]
        : [];
      for (const taskCategory of requiredTaskCategories) {
        if (!Array.isArray(byTaskCategory[taskCategory]) || byTaskCategory[taskCategory].length === 0) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json discoveryIndex.byTaskCategory must include non-empty array for '${taskCategory}'.`,
          );
        }
      }

      for (const [taskCategory, recordIds] of Object.entries(byTaskCategory)) {
        if (routingContractTaskCategories.size > 0 && !routingContractTaskCategories.has(taskCategory)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json discoveryIndex.byTaskCategory has unsupported key '${taskCategory}'.`,
          );
        }

        if (!Array.isArray(recordIds)) {
          addIssue(
            issues,
            "CONTEXT_REGISTRY_INVALID",
            `docs/context/documentation-registry.seed.json discoveryIndex.byTaskCategory.${taskCategory} must be an array.`,
          );
          continue;
        }

        for (const recordId of recordIds) {
          if (!isNonEmptyString(recordId) || !entryIds.has(recordId)) {
            addIssue(
              issues,
              "CONTEXT_REGISTRY_INVALID",
              `docs/context/documentation-registry.seed.json discoveryIndex.byTaskCategory.${taskCategory} references unknown recordId '${recordId}'.`,
            );
          }
        }
      }
    }

    const taskRoutingIndex = documentationRegistry.taskRoutingIndex;
    if (!taskRoutingIndex || typeof taskRoutingIndex !== "object" || Array.isArray(taskRoutingIndex)) {
      addIssue(
        issues,
        "CONTEXT_REGISTRY_INVALID",
        "docs/context/documentation-registry.seed.json must include taskRoutingIndex object.",
      );
    } else {
      if (taskRoutingIndex.schemaVersion !== "1.0.0") {
        addIssue(
          issues,
          "CONTEXT_REGISTRY_INVALID",
          "docs/context/documentation-registry.seed.json taskRoutingIndex.schemaVersion must be '1.0.0'.",
        );
      }

      if (taskRoutingIndex.routingSeedPath !== "docs/context/routing/task-to-context-routing.seed.json") {
        addIssue(
          issues,
          "CONTEXT_REGISTRY_INVALID",
          "docs/context/documentation-registry.seed.json taskRoutingIndex.routingSeedPath must be 'docs/context/routing/task-to-context-routing.seed.json'.",
        );
      }
      if (taskRoutingIndex.contextMapPath !== "docs/context/context-map.json") {
        addIssue(
          issues,
          "CONTEXT_REGISTRY_INVALID",
          "docs/context/documentation-registry.seed.json taskRoutingIndex.contextMapPath must be 'docs/context/context-map.json'.",
        );
      }

      const routeHintsByTaskCategory = taskRoutingIndex.routeHintsByTaskCategory;
      if (!routeHintsByTaskCategory || typeof routeHintsByTaskCategory !== "object" || Array.isArray(routeHintsByTaskCategory)) {
        addIssue(
          issues,
          "CONTEXT_REGISTRY_INVALID",
          "docs/context/documentation-registry.seed.json taskRoutingIndex.routeHintsByTaskCategory must be an object map.",
        );
      } else {
        const routingTaskIds = new Set(Array.isArray(routingSeed?.mappings) ? routingSeed.mappings.map((mapping) => mapping?.taskId).filter((value) => isNonEmptyString(value)) : []);
        const contextMapDefaults = new Map(Array.isArray(contextMap?.taskCategoryDefaults) ? contextMap.taskCategoryDefaults.map((entry) => [entry?.taskCategoryId, entry]) : []);
        const contextMapMappingIds = new Set(Array.isArray(contextMap?.taskCategoryMappings) ? contextMap.taskCategoryMappings.map((mapping) => mapping?.mappingId).filter((value) => isNonEmptyString(value)) : []);
        const requiredTaskCategories = routingContractTaskCategories.size > 0
          ? [...routingContractTaskCategories]
          : Object.keys(routeHintsByTaskCategory);

        for (const taskCategory of requiredTaskCategories) {
          const hint = routeHintsByTaskCategory[taskCategory];
          if (!hint || typeof hint !== "object" || Array.isArray(hint)) {
            addIssue(
              issues,
              "CONTEXT_REGISTRY_INVALID",
              `docs/context/documentation-registry.seed.json taskRoutingIndex.routeHintsByTaskCategory must include object for '${taskCategory}'.`,
            );
            continue;
          }

          if (!Array.isArray(hint.routeTaskIds)) {
            addIssue(
              issues,
              "CONTEXT_REGISTRY_INVALID",
              `docs/context/documentation-registry.seed.json taskRoutingIndex.routeHintsByTaskCategory.${taskCategory}.routeTaskIds must be an array.`,
            );
          } else {
            for (const routeTaskId of hint.routeTaskIds) {
              if (!isNonEmptyString(routeTaskId) || (routingTaskIds.size > 0 && !routingTaskIds.has(routeTaskId))) {
                addIssue(
                  issues,
                  "CONTEXT_REGISTRY_INVALID",
                  `docs/context/documentation-registry.seed.json taskRoutingIndex.routeHintsByTaskCategory.${taskCategory}.routeTaskIds references unknown taskId '${routeTaskId}'.`,
                );
              }
            }
          }

          if (!isArrayOfNonEmptyStrings(hint.contextMapMappingIds)) {
            addIssue(
              issues,
              "CONTEXT_REGISTRY_INVALID",
              `docs/context/documentation-registry.seed.json taskRoutingIndex.routeHintsByTaskCategory.${taskCategory}.contextMapMappingIds must be a non-empty string array.`,
            );
          } else {
            for (const mappingId of hint.contextMapMappingIds) {
              if (contextMapMappingIds.size > 0 && !contextMapMappingIds.has(mappingId)) {
                addIssue(
                  issues,
                  "CONTEXT_REGISTRY_INVALID",
                  `docs/context/documentation-registry.seed.json taskRoutingIndex.routeHintsByTaskCategory.${taskCategory}.contextMapMappingIds references unknown mappingId '${mappingId}'.`,
                );
              }
            }
          }

          const contextDefault = contextMapDefaults.get(taskCategory);
          if (contextDefault) {
            if (hint.defaultSelectionMode !== contextDefault.selectionMode) {
              addIssue(
                issues,
                "CONTEXT_REGISTRY_INVALID",
                `docs/context/documentation-registry.seed.json taskRoutingIndex.routeHintsByTaskCategory.${taskCategory}.defaultSelectionMode must match context-map default '${contextDefault.selectionMode}'.`,
              );
            }
            if (hint.defaultPriorityTier !== contextDefault.priorityTier) {
              addIssue(
                issues,
                "CONTEXT_REGISTRY_INVALID",
                `docs/context/documentation-registry.seed.json taskRoutingIndex.routeHintsByTaskCategory.${taskCategory}.defaultPriorityTier must match context-map default '${contextDefault.priorityTier}'.`,
              );
            }
            if (hint.contextAssemblyProfileId !== contextDefault.contextAssemblyProfileId) {
              addIssue(
                issues,
                "CONTEXT_REGISTRY_INVALID",
                `docs/context/documentation-registry.seed.json taskRoutingIndex.routeHintsByTaskCategory.${taskCategory}.contextAssemblyProfileId must match context-map default '${contextDefault.contextAssemblyProfileId}'.`,
              );
            }
          }
        }
      }
    }
  }

  for (const seedPath of SEED_DOCUMENTS) {
    const absoluteSeedPath = resolve(repoRoot, seedPath);
    if (!existsSync(absoluteSeedPath)) {
      issues.push({
        code: "SEED_DOC_MISSING",
        message: `Missing seed document: ${seedPath}`,
      });
      continue;
    }

    let frontmatter;
    try {
      frontmatter = parseFrontmatter(readFileSync(absoluteSeedPath, "utf8"));
    } catch (error) {
      issues.push({
        code: "FRONTMATTER_INVALID",
        message: `${seedPath}: ${error.message}`,
      });
      continue;
    }

    for (const field of REQUIRED_HEADER_FIELDS) {
      const value = frontmatter[field];
      if (typeof value !== "string" || value.trim().length === 0) {
        issues.push({
          code: "HEADER_FIELD_MISSING",
          message: `${seedPath}: missing required header field '${field}'.`,
        });
      }
    }

    const docType = frontmatter.doc_type;
    if (typeof docType === "string" && !allowedDocTypes.has(docType)) {
      issues.push({
        code: "HEADER_ENUM_INVALID",
        message: `${seedPath}: doc_type '${docType}' is not in taxonomy contract.`,
      });
    }

    const status = frontmatter.status;
    if (typeof status === "string" && !allowedStatuses.has(status)) {
      issues.push({
        code: "HEADER_ENUM_INVALID",
        message: `${seedPath}: status '${status}' is not in taxonomy contract.`,
      });
    }

    const authoritativeness = frontmatter.authoritativeness;
    if (typeof authoritativeness === "string" && !allowedAuthoritativeness.has(authoritativeness)) {
      issues.push({
        code: "HEADER_ENUM_INVALID",
        message: `${seedPath}: authoritativeness '${authoritativeness}' is not in taxonomy contract.`,
      });
    }

    const reviewed = frontmatter.last_reviewed;
    if (typeof reviewed === "string") {
      if (!isValidIsoDate(reviewed)) {
        issues.push({
          code: "LAST_REVIEWED_INVALID",
          message: `${seedPath}: last_reviewed '${reviewed}' is not a valid YYYY-MM-DD date.`,
        });
      } else {
        const reviewedDate = new Date(`${reviewed}T00:00:00.000Z`);
        if (reviewedDate.getTime() > todayUtc.getTime()) {
          issues.push({
            code: "LAST_REVIEWED_IN_FUTURE",
            message: `${seedPath}: last_reviewed '${reviewed}' cannot be in the future.`,
          });
        }
      }
    }

    if (frontmatter.supersedes && frontmatter.superseded_by) {
      issues.push({
        code: "SUPERSESSION_CONFLICT",
        message: `${seedPath}: supersedes and superseded_by cannot both be set.`,
      });
    }

    if (frontmatter.status === "superseded" && typeof frontmatter.superseded_by !== "string") {
      issues.push({
        code: "SUPERSESSION_LINK_MISSING",
        message: `${seedPath}: status is superseded but superseded_by is missing.`,
      });
    }

    const aiCompanionPath = seedPath.replace(/\.md$/, ".ai.md");
    const absoluteAiCompanionPath = resolve(repoRoot, aiCompanionPath);
    if (!existsSync(absoluteAiCompanionPath)) {
      issues.push({
        code: "SEED_AI_COMPANION_MISSING",
        message: `Missing AI companion for seed doc: ${aiCompanionPath}`,
      });
      continue;
    }

    try {
      const aiFrontmatter = parseFrontmatter(readFileSync(absoluteAiCompanionPath, "utf8"));
      for (const field of ["doc_type", "status", "authoritativeness", "owned_by", "last_reviewed"]) {
        if (frontmatter[field] !== aiFrontmatter[field]) {
          issues.push({
            code: "SEED_PAIR_MISMATCH",
            message: `${seedPath} and ${aiCompanionPath} differ for metadata field '${field}'.`,
          });
        }
      }
    } catch (error) {
      issues.push({
        code: "FRONTMATTER_INVALID",
        message: `${aiCompanionPath}: ${error.message}`,
      });
    }
  }

  const expectedRequiredFields = Object.keys(metadataContract.requiredFields || {});
  if (JSON.stringify(expectedRequiredFields) !== JSON.stringify(REQUIRED_HEADER_FIELDS)) {
    issues.push({
      code: "METADATA_CONTRACT_DRIFT",
      message: "docs/context/documentation-metadata-header.contract.json requiredFields changed; update validator seed expectations.",
    });
  }

  return issues;
}

function main() {
  let repoRoot;
  try {
    ({ repoRoot } = parseArgs(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`Argument error: ${error.message}\n`);
    process.exit(2);
  }

  const issues = validateDocsFoundation(repoRoot);

  if (issues.length > 0) {
    process.stderr.write("Docs foundation validation failed.\n");
    for (const issue of issues) {
      process.stderr.write(`- [${issue.code}] ${issue.message}\n`);
    }
    process.stderr.write(`Total issues: ${issues.length}\n`);
    process.exit(1);
  }

  process.stdout.write([
    "Docs foundation validation passed.",
    `Checked top-level folders: ${REQUIRED_TOP_LEVEL_FOLDERS.length}`,
    `Checked router files: ${2 + (REQUIRED_TOP_LEVEL_FOLDERS.length * 2)}`,
    `Checked context foundation assets: ${REQUIRED_CONTEXT_FILES.length}`,
    `Checked ADR foundation assets: ${REQUIRED_ADR_FILES.length}`,
    "Checked context map and pack shape references.",
    "Checked pack/routing/source cross-reference integrity.",
    "Checked documentation registry cross-reference integrity.",
    "Checked ADR registry cross-reference integrity.",
    `Checked metadata seed docs: ${SEED_DOCUMENTS.length}`,
  ].join("\n") + "\n");
}

main();
