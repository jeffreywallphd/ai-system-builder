const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { resolve } = require("node:path");

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
  "docs/context/governance/context-asset-lifecycle.md",
  "docs/context/governance/context-asset-lifecycle.ai.md",
  "docs/context/governance/context-system-rollout-boundaries.md",
  "docs/context/governance/context-system-rollout-boundaries.ai.md",
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

  const contextPackCatalogContractPath = resolve(repoRoot, "docs/context/packs/context-pack-catalog.contract.json");
  const contextPackCatalogSeedPath = resolve(repoRoot, "docs/context/packs/context-pack-catalog.seed.json");
  const contextPackContractPath = resolve(repoRoot, "docs/context/packs/context-pack.contract.json");
  const contextMapPath = resolve(repoRoot, "docs/context/context-map.json");
  const contextAssetMetadataContractPath = resolve(repoRoot, "docs/context/context-asset-metadata.contract.json");
  const taskRoutingContractPath = resolve(repoRoot, "docs/context/routing/task-to-context-routing.contract.json");
  const taskRoutingSeedPath = resolve(repoRoot, "docs/context/routing/task-to-context-routing.seed.json");
  const adrRegistryPath = resolve(repoRoot, "docs/adr/records/adr-registry.json");

  const expectedContextJsonArtifacts = [
    contextPackContractPath,
    contextMapPath,
    contextAssetMetadataContractPath,
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
          const frontmatter = parseFrontmatter(readFileSync(resolve(repoRoot, entry.humanDocPath), "utf8"));
          const expectedTitle = `ADR-${entry.adrNumber} ${entry.title}`;
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
    "Checked ADR registry cross-reference integrity.",
    `Checked metadata seed docs: ${SEED_DOCUMENTS.length}`,
  ].join("\n") + "\n");
}

main();
