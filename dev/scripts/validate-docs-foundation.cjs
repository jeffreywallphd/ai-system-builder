const { existsSync, readFileSync } = require("node:fs");
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
  "docs/context/packs/README.md",
  "docs/context/packs/README.ai.md",
  "docs/context/packs/context-pack-catalog.contract.json",
  "docs/context/packs/context-pack-catalog.seed.json",
  "docs/context/routing/README.md",
  "docs/context/routing/README.ai.md",
  "docs/context/routing/task-to-context-routing.contract.json",
  "docs/context/routing/task-to-context-routing.seed.json",
  "docs/context/governance/README.md",
  "docs/context/governance/README.ai.md",
  "docs/context/governance/context-governance-policy.md",
  "docs/context/governance/context-governance-policy.ai.md",
];

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

  const contextPackCatalogContractPath = resolve(repoRoot, "docs/context/packs/context-pack-catalog.contract.json");
  const contextPackCatalogSeedPath = resolve(repoRoot, "docs/context/packs/context-pack-catalog.seed.json");
  const taskRoutingContractPath = resolve(repoRoot, "docs/context/routing/task-to-context-routing.contract.json");
  const taskRoutingSeedPath = resolve(repoRoot, "docs/context/routing/task-to-context-routing.seed.json");

  const expectedContextJsonArtifacts = [
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

  const packContract = contextJsonArtifacts.get(contextPackCatalogContractPath);
  if (packContract) {
    if (packContract.schemaVersion !== "1.0.0" || packContract.artifactType !== "context-pack-catalog") {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/packs/context-pack-catalog.contract.json must declare schemaVersion 1.0.0 and artifactType context-pack-catalog.",
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

  const routingContract = contextJsonArtifacts.get(taskRoutingContractPath);
  if (routingContract) {
    if (routingContract.schemaVersion !== "1.0.0" || routingContract.artifactType !== "task-to-context-routing-map") {
      issues.push({
        code: "CONTEXT_CONTRACT_INVALID",
        message: "docs/context/routing/task-to-context-routing.contract.json must declare schemaVersion 1.0.0 and artifactType task-to-context-routing-map.",
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
    `Checked metadata seed docs: ${SEED_DOCUMENTS.length}`,
  ].join("\n") + "\n");
}

main();
