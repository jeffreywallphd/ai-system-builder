const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const REGISTRY_PATH = "docs/context/documentation-registry.seed.json";
const METADATA_CONTRACT_PATH = "docs/context/documentation-indexed-document-metadata.contract.json";
const TAXONOMY_CONTRACT_PATH = "docs/context/documentation-taxonomy.contract.json";
const RECORD_ID_PATTERN = /^doc-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIRED_DISCOVERY_INDEXES = [
  "byDocType",
  "byStatus",
  "byDomain",
  "byAuthoritativeness",
  "byTaskCategory",
];

function addIssue(issues, code, message) {
  issues.push({ code, message });
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

function isValidIsoDate(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return false;
  }

  const parsedDate = new Date(`${dateValue}T00:00:00.000Z`);
  return Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().startsWith(dateValue);
}

function normalizeRepoPath(pathValue) {
  return pathValue.trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function isCanonicalHumanDocsMarkdownPath(pathValue) {
  if (!isNonEmptyString(pathValue)) {
    return false;
  }
  const normalizedPath = normalizeRepoPath(pathValue);
  return normalizedPath.startsWith("docs/")
    && normalizedPath.endsWith(".md")
    && !normalizedPath.endsWith(".ai.md");
}

function pathExistsForReference(repoRoot, pathValue) {
  if (!isNonEmptyString(pathValue)) {
    return false;
  }
  const normalized = normalizeRepoPath(pathValue);
  return existsSync(resolve(repoRoot, normalized));
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

function validateDocumentationRegistry(repoRoot) {
  const issues = [];
  const registryAbsolutePath = resolve(repoRoot, REGISTRY_PATH);
  const metadataContractAbsolutePath = resolve(repoRoot, METADATA_CONTRACT_PATH);
  const taxonomyContractAbsolutePath = resolve(repoRoot, TAXONOMY_CONTRACT_PATH);
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  if (!existsSync(registryAbsolutePath)) {
    addIssue(
      issues,
      "REGISTRY_FILE_MISSING",
      `Missing documentation registry seed: ${REGISTRY_PATH}.`,
    );
    return issues;
  }

  let registry;
  try {
    registry = readJson(registryAbsolutePath);
  } catch (error) {
    addIssue(
      issues,
      "REGISTRY_JSON_INVALID",
      `${REGISTRY_PATH} is not valid JSON: ${error.message}`,
    );
    return issues;
  }

  let metadataContract;
  if (!existsSync(metadataContractAbsolutePath)) {
    addIssue(
      issues,
      "REGISTRY_CONTRACT_MISSING",
      `Missing metadata contract: ${METADATA_CONTRACT_PATH}.`,
    );
  } else {
    try {
      metadataContract = readJson(metadataContractAbsolutePath);
    } catch (error) {
      addIssue(
        issues,
        "REGISTRY_CONTRACT_INVALID",
        `${METADATA_CONTRACT_PATH} is not valid JSON: ${error.message}`,
      );
    }
  }

  let taxonomyContract;
  if (!existsSync(taxonomyContractAbsolutePath)) {
    addIssue(
      issues,
      "REGISTRY_TAXONOMY_MISSING",
      `Missing taxonomy contract: ${TAXONOMY_CONTRACT_PATH}.`,
    );
  } else {
    try {
      taxonomyContract = readJson(taxonomyContractAbsolutePath);
    } catch (error) {
      addIssue(
        issues,
        "REGISTRY_TAXONOMY_INVALID",
        `${TAXONOMY_CONTRACT_PATH} is not valid JSON: ${error.message}`,
      );
    }
  }

  if (registry.schemaVersion !== "1.0.0") {
    addIssue(
      issues,
      "REGISTRY_SHAPE_INVALID",
      `${REGISTRY_PATH} schemaVersion must be '1.0.0'.`,
    );
  }
  if (registry.artifactType !== "documentation-registry") {
    addIssue(
      issues,
      "REGISTRY_SHAPE_INVALID",
      `${REGISTRY_PATH} artifactType must be 'documentation-registry'.`,
    );
  }
  if (registry.status !== "seed") {
    addIssue(
      issues,
      "REGISTRY_SHAPE_INVALID",
      `${REGISTRY_PATH} status must be 'seed'.`,
    );
  }
  if (registry.entryContractPath !== METADATA_CONTRACT_PATH) {
    addIssue(
      issues,
      "REGISTRY_SHAPE_INVALID",
      `${REGISTRY_PATH} entryContractPath must be '${METADATA_CONTRACT_PATH}'.`,
    );
  }
  if (registry.taxonomyContractPath !== TAXONOMY_CONTRACT_PATH) {
    addIssue(
      issues,
      "REGISTRY_SHAPE_INVALID",
      `${REGISTRY_PATH} taxonomyContractPath must be '${TAXONOMY_CONTRACT_PATH}'.`,
    );
  }

  if (!isArrayOfNonEmptyStrings(registry.docTypeCatalog)) {
    addIssue(
      issues,
      "REGISTRY_SHAPE_INVALID",
      `${REGISTRY_PATH} docTypeCatalog must be a non-empty string array.`,
    );
  }
  if (!isArrayOfNonEmptyStrings(registry.statusCatalog)) {
    addIssue(
      issues,
      "REGISTRY_SHAPE_INVALID",
      `${REGISTRY_PATH} statusCatalog must be a non-empty string array.`,
    );
  }
  if (!isArrayOfNonEmptyStrings(registry.authoritativenessCatalog)) {
    addIssue(
      issues,
      "REGISTRY_SHAPE_INVALID",
      `${REGISTRY_PATH} authoritativenessCatalog must be a non-empty string array.`,
    );
  }

  if (!registry.domainRelationships || typeof registry.domainRelationships !== "object" || Array.isArray(registry.domainRelationships)) {
    addIssue(
      issues,
      "REGISTRY_SHAPE_INVALID",
      `${REGISTRY_PATH} domainRelationships must be an object map.`,
    );
  } else {
    for (const [domain, relatedDomains] of Object.entries(registry.domainRelationships)) {
      if (!isNonEmptyString(domain)) {
        addIssue(
          issues,
          "REGISTRY_SHAPE_INVALID",
          `${REGISTRY_PATH} domainRelationships has invalid domain key '${domain}'.`,
        );
      }
      if (!isArrayOfNonEmptyStrings(relatedDomains, { allowEmpty: true })) {
        addIssue(
          issues,
          "REGISTRY_SHAPE_INVALID",
          `${REGISTRY_PATH} domainRelationships.${domain} must be an array of non-empty strings.`,
        );
      }
    }
  }

  if (!Array.isArray(registry.entries) || registry.entries.length === 0) {
    addIssue(
      issues,
      "REGISTRY_SHAPE_INVALID",
      `${REGISTRY_PATH} entries must be a non-empty array.`,
    );
    return issues;
  }

  const taxonomyDocTypes = new Set(
    taxonomyContract?.metadataFields?.document_type?.allowedValues || [],
  );
  const taxonomyStatuses = new Set(
    taxonomyContract?.metadataFields?.status?.allowedValues || [],
  );
  const taxonomyAuthoritativeness = new Set(
    taxonomyContract?.metadataFields?.authoritativeness?.allowedValues || [],
  );

  if (taxonomyDocTypes.size > 0) {
    for (const value of registry.docTypeCatalog || []) {
      if (!taxonomyDocTypes.has(value)) {
        addIssue(
          issues,
          "REGISTRY_TAXONOMY_MISMATCH",
          `${REGISTRY_PATH} docTypeCatalog has unsupported value '${value}'.`,
        );
      }
    }
  }
  if (taxonomyStatuses.size > 0) {
    for (const value of registry.statusCatalog || []) {
      if (!taxonomyStatuses.has(value)) {
        addIssue(
          issues,
          "REGISTRY_TAXONOMY_MISMATCH",
          `${REGISTRY_PATH} statusCatalog has unsupported value '${value}'.`,
        );
      }
    }
  }
  if (taxonomyAuthoritativeness.size > 0) {
    for (const value of registry.authoritativenessCatalog || []) {
      if (!taxonomyAuthoritativeness.has(value)) {
        addIssue(
          issues,
          "REGISTRY_TAXONOMY_MISMATCH",
          `${REGISTRY_PATH} authoritativenessCatalog has unsupported value '${value}'.`,
        );
      }
    }
  }

  const requiredFields = [
    "recordId",
    ...((metadataContract && Array.isArray(metadataContract.requiredFields))
      ? metadataContract.requiredFields
      : []),
  ];
  const optionalFields = (metadataContract && Array.isArray(metadataContract.optionalFields))
    ? metadataContract.optionalFields
    : [];

  if (requiredFields.length === 1) {
    addIssue(
      issues,
      "REGISTRY_CONTRACT_INVALID",
      `${METADATA_CONTRACT_PATH} requiredFields must be a non-empty array.`,
    );
  }
  if (!Array.isArray(optionalFields)) {
    addIssue(
      issues,
      "REGISTRY_CONTRACT_INVALID",
      `${METADATA_CONTRACT_PATH} optionalFields must be an array.`,
    );
  }

  const allowedEntryFields = new Set([...requiredFields, ...optionalFields]);
  const entryRecordIds = new Set();
  const entryPaths = new Set();
  const entryPathToRecordId = new Map();
  const knownDomains = new Set(Object.keys(registry.domainRelationships || {}));
  const docTypeCatalog = new Set(registry.docTypeCatalog || []);
  const statusCatalog = new Set(registry.statusCatalog || []);
  const authoritativenessCatalog = new Set(registry.authoritativenessCatalog || []);
  const optionalArrayFields = ["keywords", "relatedCodePaths", "relatedDocs", "relatedRecordIds"];
  const optionalPathFields = ["relatedCodePaths", "relatedDocs", "supersedes", "supersededBy"];

  for (const entry of registry.entries) {
    const entryId = isNonEmptyString(entry?.recordId) ? entry.recordId : "<unknown>";

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      addIssue(
        issues,
        "REGISTRY_ENTRY_INVALID",
        `${REGISTRY_PATH} contains a non-object entry.`,
      );
      continue;
    }

    for (const key of Object.keys(entry)) {
      if (!allowedEntryFields.has(key)) {
        addIssue(
          issues,
          "REGISTRY_ENTRY_INVALID",
          `${REGISTRY_PATH} entry '${entryId}' has unsupported field '${key}'.`,
        );
      }
    }

    for (const fieldName of requiredFields) {
      const value = entry[fieldName];
      if (!isNonEmptyString(value)) {
        addIssue(
          issues,
          "REGISTRY_ENTRY_INVALID",
          `${REGISTRY_PATH} entry '${entryId}' is missing required field '${fieldName}'.`,
        );
      }
    }

    if (isNonEmptyString(entry.recordId)) {
      if (!RECORD_ID_PATTERN.test(entry.recordId)) {
        addIssue(
          issues,
          "REGISTRY_ENTRY_INVALID",
          `${REGISTRY_PATH} entry '${entry.recordId}' recordId must match ${RECORD_ID_PATTERN}.`,
        );
      }
      if (entryRecordIds.has(entry.recordId)) {
        addIssue(
          issues,
          "REGISTRY_ENTRY_INVALID",
          `${REGISTRY_PATH} has duplicate recordId '${entry.recordId}'.`,
        );
      }
      entryRecordIds.add(entry.recordId);
    }

    if (isNonEmptyString(entry.path)) {
      if (!isCanonicalHumanDocsMarkdownPath(entry.path)) {
        addIssue(
          issues,
          "REGISTRY_ENTRY_INVALID",
          `${REGISTRY_PATH} entry '${entryId}' path must be a human markdown docs path.`,
        );
      }
      if (!pathExistsForReference(repoRoot, entry.path)) {
        addIssue(
          issues,
          "REGISTRY_REFERENCE_INVALID",
          `${REGISTRY_PATH} entry '${entryId}' path references missing file '${entry.path}'.`,
        );
      }
      const normalizedPath = normalizeRepoPath(entry.path);

      if (entryPaths.has(normalizedPath)) {
        addIssue(
          issues,
          "REGISTRY_ENTRY_INVALID",
          `${REGISTRY_PATH} has duplicate entry path '${entry.path}'.`,
        );
      }
      entryPaths.add(normalizedPath);

      if (isNonEmptyString(entry.recordId) && !entryPathToRecordId.has(normalizedPath)) {
        entryPathToRecordId.set(normalizedPath, entry.recordId);
      }
    }

    if (entry.aiPath !== undefined) {
      if (!isNonEmptyString(entry.aiPath) || !entry.aiPath.endsWith(".ai.md")) {
        addIssue(
          issues,
          "REGISTRY_ENTRY_INVALID",
          `${REGISTRY_PATH} entry '${entryId}' field 'aiPath' must be a .ai.md path when set.`,
        );
      } else if (!pathExistsForReference(repoRoot, entry.aiPath)) {
        addIssue(
          issues,
          "REGISTRY_REFERENCE_INVALID",
          `${REGISTRY_PATH} entry '${entryId}' aiPath references missing file '${entry.aiPath}'.`,
        );
      }
    }

    if (isNonEmptyString(entry.docType) && !docTypeCatalog.has(entry.docType)) {
      addIssue(
        issues,
        "REGISTRY_ENTRY_INVALID",
        `${REGISTRY_PATH} entry '${entryId}' has unsupported docType '${entry.docType}'.`,
      );
    }
    if (isNonEmptyString(entry.status) && !statusCatalog.has(entry.status)) {
      addIssue(
        issues,
        "REGISTRY_ENTRY_INVALID",
        `${REGISTRY_PATH} entry '${entryId}' has unsupported status '${entry.status}'.`,
      );
    }
    if (
      isNonEmptyString(entry.authoritativeness)
      && !authoritativenessCatalog.has(entry.authoritativeness)
    ) {
      addIssue(
        issues,
        "REGISTRY_ENTRY_INVALID",
        `${REGISTRY_PATH} entry '${entryId}' has unsupported authoritativeness '${entry.authoritativeness}'.`,
      );
    }
    if (isNonEmptyString(entry.domain) && knownDomains.size > 0 && !knownDomains.has(entry.domain)) {
      addIssue(
        issues,
        "REGISTRY_ENTRY_INVALID",
        `${REGISTRY_PATH} entry '${entryId}' has unsupported domain '${entry.domain}'.`,
      );
    }

    for (const fieldName of optionalArrayFields) {
      if (entry[fieldName] === undefined) {
        continue;
      }
      if (!isArrayOfNonEmptyStrings(entry[fieldName])) {
        addIssue(
          issues,
          "REGISTRY_ENTRY_INVALID",
          `${REGISTRY_PATH} entry '${entryId}' field '${fieldName}' must be a non-empty string array when set.`,
        );
      }
    }

    for (const fieldName of optionalPathFields) {
      const value = entry[fieldName];
      if (Array.isArray(value)) {
        for (const referencePath of value) {
          if (!pathExistsForReference(repoRoot, referencePath)) {
            addIssue(
              issues,
              "REGISTRY_REFERENCE_INVALID",
              `${REGISTRY_PATH} entry '${entryId}' field '${fieldName}' references missing path '${referencePath}'.`,
            );
          }
        }
      } else if (isNonEmptyString(value) && !pathExistsForReference(repoRoot, value)) {
        addIssue(
          issues,
          "REGISTRY_REFERENCE_INVALID",
          `${REGISTRY_PATH} entry '${entryId}' field '${fieldName}' references missing path '${value}'.`,
        );
      }
    }

    if (entry.supersedes && entry.supersededBy) {
      addIssue(
        issues,
        "REGISTRY_ENTRY_INVALID",
        `${REGISTRY_PATH} entry '${entryId}' cannot set both supersedes and supersededBy.`,
      );
    }
    if (entry.status === "superseded" && !isNonEmptyString(entry.supersededBy)) {
      addIssue(
        issues,
        "REGISTRY_ENTRY_INVALID",
        `${REGISTRY_PATH} entry '${entryId}' with status superseded must set supersededBy.`,
      );
    }

    if (entry.lastReviewed !== undefined) {
      if (!isNonEmptyString(entry.lastReviewed) || !isValidIsoDate(entry.lastReviewed)) {
        addIssue(
          issues,
          "REGISTRY_ENTRY_INVALID",
          `${REGISTRY_PATH} entry '${entryId}' has invalid lastReviewed '${entry.lastReviewed}'.`,
        );
      } else {
        const reviewedDate = new Date(`${entry.lastReviewed}T00:00:00.000Z`);
        if (reviewedDate.getTime() > todayUtc.getTime()) {
          addIssue(
            issues,
            "REGISTRY_ENTRY_INVALID",
            `${REGISTRY_PATH} entry '${entryId}' has future lastReviewed '${entry.lastReviewed}'.`,
          );
        }
      }
    }
  }

  for (const entry of registry.entries) {
    if (!Array.isArray(entry.relatedRecordIds)) {
      continue;
    }

    for (const relatedRecordId of entry.relatedRecordIds) {
      if (!entryRecordIds.has(relatedRecordId)) {
        addIssue(
          issues,
          "REGISTRY_REFERENCE_INVALID",
          `${REGISTRY_PATH} entry '${entry.recordId || "<unknown>"}' references unknown relatedRecordId '${relatedRecordId}'.`,
        );
      } else if (relatedRecordId === entry.recordId) {
        addIssue(
          issues,
          "REGISTRY_REFERENCE_INVALID",
          `${REGISTRY_PATH} entry '${entry.recordId || "<unknown>"}' cannot reference itself in relatedRecordIds.`,
        );
      }
    }
  }

  for (const entry of registry.entries) {
    if (!Array.isArray(entry.relatedDocs)) {
      continue;
    }

    const entryId = isNonEmptyString(entry?.recordId) ? entry.recordId : "<unknown>";
    const relatedRecordIds = new Set(
      Array.isArray(entry.relatedRecordIds) ? entry.relatedRecordIds : [],
    );

    for (const relatedDocPath of entry.relatedDocs) {
      const normalizedRelatedPath = normalizeRepoPath(relatedDocPath);
      const relatedRecordId = entryPathToRecordId.get(normalizedRelatedPath);
      if (relatedRecordId && !relatedRecordIds.has(relatedRecordId)) {
        addIssue(
          issues,
          "REGISTRY_CROSS_REFERENCE_INVALID",
          `${REGISTRY_PATH} entry '${entryId}' relatedDocs path '${relatedDocPath}' points to indexed record '${relatedRecordId}' but relatedRecordIds is missing that identifier.`,
        );
      }
    }
  }

  if (!registry.discoveryIndex || typeof registry.discoveryIndex !== "object" || Array.isArray(registry.discoveryIndex)) {
    addIssue(
      issues,
      "REGISTRY_SHAPE_INVALID",
      `${REGISTRY_PATH} discoveryIndex must be an object map.`,
    );
  } else {
    for (const indexName of REQUIRED_DISCOVERY_INDEXES) {
      const indexMap = registry.discoveryIndex[indexName];
      if (!indexMap || typeof indexMap !== "object" || Array.isArray(indexMap)) {
        addIssue(
          issues,
          "REGISTRY_SHAPE_INVALID",
          `${REGISTRY_PATH} discoveryIndex.${indexName} must be an object map.`,
        );
        continue;
      }

      for (const [key, recordIds] of Object.entries(indexMap)) {
        if (!isNonEmptyString(key)) {
          addIssue(
            issues,
            "REGISTRY_SHAPE_INVALID",
            `${REGISTRY_PATH} discoveryIndex.${indexName} has an empty key.`,
          );
        }
        if (!Array.isArray(recordIds)) {
          addIssue(
            issues,
            "REGISTRY_SHAPE_INVALID",
            `${REGISTRY_PATH} discoveryIndex.${indexName}.${key} must be an array.`,
          );
          continue;
        }
        for (const recordId of recordIds) {
          if (!isNonEmptyString(recordId) || !entryRecordIds.has(recordId)) {
            addIssue(
              issues,
              "REGISTRY_REFERENCE_INVALID",
              `${REGISTRY_PATH} discoveryIndex.${indexName}.${key} references unknown recordId '${recordId}'.`,
            );
          }
        }
      }
    }
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

  const issues = validateDocumentationRegistry(repoRoot);
  if (issues.length > 0) {
    process.stderr.write("Documentation registry validation failed.\n");
    for (const issue of issues) {
      process.stderr.write(`- [${issue.code}] ${issue.message}\n`);
    }
    process.stderr.write(`Total issues: ${issues.length}\n`);
    process.exit(1);
  }

  process.stdout.write([
    "Documentation registry validation passed.",
    `Checked registry: ${REGISTRY_PATH}`,
    "Checked top-level registry shape and taxonomy catalog alignment.",
    "Checked required metadata fields and entry-level invariants.",
    "Checked discovery index record references.",
    "Checked related-doc cross-reference alignment with stable record identifiers.",
  ].join("\n") + "\n");
}

main();
