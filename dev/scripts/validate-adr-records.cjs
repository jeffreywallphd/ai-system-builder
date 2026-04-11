const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { dirname, relative, resolve } = require("node:path");

const REQUIRED_ADR_SECTIONS = [
  "Status",
  "Decision Date",
  "Decision Statement",
  "Context and Problem Statement",
  "Decision Drivers",
  "Considered Options",
  "Chosen Approach",
  "Consequences",
  "Related Documentation",
  "Related Code Paths",
];

const REQUIRED_METADATA_FIELDS = [
  "title",
  "adr_number",
  "decision_status",
  "decision_date",
];

const ADR_DECISION_STATUSES = new Set([
  "proposed",
  "accepted",
  "superseded",
  "deprecated",
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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidIsoDate(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return false;
  }

  const parsedDate = new Date(`${dateValue}T00:00:00.000Z`);
  return Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().startsWith(dateValue);
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

function findHeadingLine(markdownContent, headingText) {
  const normalized = markdownContent.replace(/\r\n/g, "\n");
  const escapedHeadingText = headingText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^##\\s+${escapedHeadingText}\\s*$`, "m");
  const match = normalized.match(pattern);
  return match ? match[0] : "";
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

function extractH1(markdownContent) {
  const normalized = markdownContent.replace(/\r\n/g, "\n");
  const h1Match = normalized.match(/^#\s+(.+)$/m);
  return h1Match ? h1Match[1].trim() : "";
}

function extractInlineCodeReferences(text) {
  const references = [];
  const pattern = /`([^`]+)`/g;
  let match = pattern.exec(text);
  while (match) {
    references.push(match[1].trim());
    match = pattern.exec(text);
  }
  return references.filter((reference) => reference.length > 0);
}

function extractMarkdownLinkReferences(text) {
  const references = [];
  const pattern = /\[[^\]]+\]\(([^)]+)\)/g;
  let match = pattern.exec(text);
  while (match) {
    references.push(match[1].trim());
    match = pattern.exec(text);
  }
  return references.filter((reference) => reference.length > 0);
}

function normalizeReferencePath({ referencePath, sourceRelativePath, repoRoot }) {
  if (!isNonEmptyString(referencePath)) {
    return "";
  }

  const stripped = referencePath
    .trim()
    .replace(/^<|>$/g, "")
    .split("#")[0]
    .split("?")[0]
    .trim();

  if (!isNonEmptyString(stripped)) {
    return "";
  }

  if (/^[a-z]+:/i.test(stripped)) {
    return "";
  }

  const slashNormalized = stripped.replace(/\\/g, "/");

  if (slashNormalized.startsWith("docs/")) {
    return slashNormalized;
  }

  if (slashNormalized.startsWith("./") || slashNormalized.startsWith("../")) {
    const sourceDirectory = dirname(resolve(repoRoot, sourceRelativePath));
    const absoluteReferencePath = resolve(sourceDirectory, slashNormalized);
    return normalizePath(relative(repoRoot, absoluteReferencePath));
  }

  return "";
}

function collectDocReferencesFromText({ text, sourceRelativePath, repoRoot }) {
  const references = [
    ...extractInlineCodeReferences(text),
    ...extractMarkdownLinkReferences(text),
  ];
  const normalizedReferences = new Set();
  for (const reference of references) {
    const normalized = normalizeReferencePath({ referencePath: reference, sourceRelativePath, repoRoot });
    if (normalized.startsWith("docs/")) {
      normalizedReferences.add(normalized);
    }
  }
  return [...normalizedReferences];
}

function collectDocReferencesFromSection({
  markdownContent,
  headingText,
  sourceRelativePath,
  repoRoot,
}) {
  const sectionBody = extractSectionBody(markdownContent, headingText);
  return collectDocReferencesFromText({
    text: sectionBody,
    sourceRelativePath,
    repoRoot,
  });
}

function deriveVariantReference(referencePath, useAiVariant) {
  if (referencePath.endsWith(".ai.md")) {
    return useAiVariant
      ? referencePath
      : referencePath.replace(/\.ai\.md$/, ".md");
  }

  if (referencePath.endsWith(".md")) {
    return useAiVariant
      ? referencePath.replace(/\.md$/, ".ai.md")
      : referencePath;
  }

  return referencePath;
}

function buildExpectedVariantReferenceSet({
  references,
  useAiVariant,
  repoRoot,
}) {
  const expectedReferences = new Set();
  for (const reference of references) {
    const preferredVariant = deriveVariantReference(reference, useAiVariant);
    if (preferredVariant !== reference && existsSync(resolve(repoRoot, preferredVariant))) {
      expectedReferences.add(preferredVariant);
      continue;
    }
    expectedReferences.add(reference);
  }
  return expectedReferences;
}

function findFirstMissingReference(expectedReferences, actualReferences) {
  for (const expectedReference of expectedReferences) {
    if (!actualReferences.has(expectedReference)) {
      return expectedReference;
    }
  }
  return "";
}

function isAdrRecordDocPath(referencePath) {
  return /^docs\/adr\/records\/adr-\d{3}-.+\.(ai\.)?md$/.test(referencePath);
}

function validateAdrDocument({
  issues,
  absolutePath,
  relativePath,
  expectedAdrNumber,
  expectedDecisionTitle,
}) {
  let markdownContent;
  try {
    markdownContent = readFileSync(absolutePath, "utf8");
  } catch (error) {
    addIssue(
      issues,
      "ADR_RECORD_FILE_INVALID",
      `${relativePath} could not be read: ${error.message}`,
    );
    return null;
  }

  let frontmatter;
  try {
    frontmatter = parseFrontmatter(markdownContent);
  } catch (error) {
    addIssue(
      issues,
      "ADR_FRONTMATTER_INVALID",
      `${relativePath}: ${error.message}`,
    );
    return null;
  }

  for (const field of REQUIRED_METADATA_FIELDS) {
    if (!isNonEmptyString(frontmatter[field])) {
      addIssue(
        issues,
        "ADR_METADATA_MISSING",
        `${relativePath} is missing required metadata field '${field}'.`,
      );
    }
  }

  if (!/^\d{3}$/.test(frontmatter.adr_number || "")) {
    addIssue(
      issues,
      "ADR_METADATA_INVALID",
      `${relativePath} has invalid adr_number '${frontmatter.adr_number}'.`,
    );
  }

  if (isNonEmptyString(frontmatter.adr_number) && frontmatter.adr_number !== expectedAdrNumber) {
    addIssue(
      issues,
      "ADR_IDENTIFIER_MISMATCH",
      `${relativePath} adr_number '${frontmatter.adr_number}' does not match expected '${expectedAdrNumber}'.`,
    );
  }

  if (!ADR_DECISION_STATUSES.has(frontmatter.decision_status)) {
    addIssue(
      issues,
      "ADR_METADATA_INVALID",
      `${relativePath} has unsupported decision_status '${frontmatter.decision_status}'.`,
    );
  }

  if (!isValidIsoDate(frontmatter.decision_date || "")) {
    addIssue(
      issues,
      "ADR_METADATA_INVALID",
      `${relativePath} has invalid decision_date '${frontmatter.decision_date}'.`,
    );
  }

  const expectedFrontmatterTitle = `ADR-${expectedAdrNumber} ${expectedDecisionTitle}`;
  if (frontmatter.title !== expectedFrontmatterTitle) {
    addIssue(
      issues,
      "ADR_IDENTIFIER_MISMATCH",
      `${relativePath} title '${frontmatter.title}' does not match expected '${expectedFrontmatterTitle}'.`,
    );
  }

  const expectedH1 = `ADR-${expectedAdrNumber}: ${expectedDecisionTitle}`;
  const h1 = extractH1(markdownContent);
  if (h1 !== expectedH1) {
    addIssue(
      issues,
      "ADR_H1_INVALID",
      `${relativePath} H1 '${h1}' does not match expected '${expectedH1}'.`,
    );
  }

  for (const sectionHeading of REQUIRED_ADR_SECTIONS) {
    if (!findHeadingLine(markdownContent, sectionHeading)) {
      addIssue(
        issues,
        "ADR_REQUIRED_SECTION_MISSING",
        `${relativePath} is missing required section '## ${sectionHeading}'.`,
      );
      continue;
    }

    const body = extractSectionBody(markdownContent, sectionHeading).trim();
    if (body.length === 0) {
      addIssue(
        issues,
        "ADR_REQUIRED_SECTION_EMPTY",
        `${relativePath} section '## ${sectionHeading}' must not be empty.`,
      );
    }
  }

  const statusBody = extractSectionBody(markdownContent, "Status").trim();
  const statusLine = statusBody.split("\n").find((line) => line.trim().length > 0)?.trim() || "";
  if (isNonEmptyString(frontmatter.decision_status) && statusLine !== frontmatter.decision_status) {
    addIssue(
      issues,
      "ADR_SECTION_METADATA_MISMATCH",
      `${relativePath} status section '${statusLine}' does not match decision_status '${frontmatter.decision_status}'.`,
    );
  }

  const decisionDateBody = extractSectionBody(markdownContent, "Decision Date").trim();
  const decisionDateLine = decisionDateBody.split("\n").find((line) => line.trim().length > 0)?.trim() || "";
  if (isNonEmptyString(frontmatter.decision_date) && decisionDateLine !== frontmatter.decision_date) {
    addIssue(
      issues,
      "ADR_SECTION_METADATA_MISMATCH",
      `${relativePath} decision date section '${decisionDateLine}' does not match decision_date '${frontmatter.decision_date}'.`,
    );
  }

  const supersedes = typeof frontmatter.supersedes === "string" ? frontmatter.supersedes : "";
  const supersededBy = typeof frontmatter.superseded_by === "string" ? frontmatter.superseded_by : "";
  const hasSupersessionSection = Boolean(findHeadingLine(markdownContent, "Supersession"));
  if ((isNonEmptyString(supersedes) || isNonEmptyString(supersededBy)) && !hasSupersessionSection) {
    addIssue(
      issues,
      "ADR_SUPERSESSION_SECTION_MISSING",
      `${relativePath} must include '## Supersession' when supersedes or superseded_by is set.`,
    );
  }

  return {
    frontmatter,
    markdownContent,
  };
}

function validateAdrRecords(repoRoot) {
  const issues = [];

  const adrRecordsRoot = resolve(repoRoot, "docs/adr/records");
  if (!existsSync(adrRecordsRoot)) {
    addIssue(
      issues,
      "ADR_RECORDS_ROOT_MISSING",
      `Expected ADR records folder at ${normalizePath(adrRecordsRoot)}.`,
    );
    return issues;
  }

  const registryPath = resolve(repoRoot, "docs/adr/records/adr-registry.json");
  if (!existsSync(registryPath)) {
    addIssue(
      issues,
      "ADR_REGISTRY_MISSING",
      "Missing required ADR registry: docs/adr/records/adr-registry.json",
    );
    return issues;
  }

  let registry;
  try {
    registry = JSON.parse(readFileSync(registryPath, "utf8"));
  } catch (error) {
    addIssue(
      issues,
      "ADR_REGISTRY_INVALID",
      `docs/adr/records/adr-registry.json is invalid JSON: ${error.message}`,
    );
    return issues;
  }

  if (!Array.isArray(registry.records) || registry.records.length === 0) {
    addIssue(
      issues,
      "ADR_REGISTRY_INVALID",
      "docs/adr/records/adr-registry.json must include a non-empty records array.",
    );
    return issues;
  }

  const docsInFolder = readdirSync(adrRecordsRoot)
    .filter((name) => /^adr-\d{3}-.*\.md$/.test(name) && !name.endsWith(".ai.md"))
    .map((name) => `docs/adr/records/${name}`)
    .sort();

  const docsInRegistry = registry.records
    .map((entry) => entry?.humanDocPath)
    .filter((entry) => isNonEmptyString(entry))
    .sort();
  const registryHumanDocPaths = new Set(
    registry.records
      .map((entry) => entry?.humanDocPath)
      .filter((entry) => isNonEmptyString(entry)),
  );
  const registryAiDocPaths = new Set(
    registry.records
      .map((entry) => entry?.aiDocPath)
      .filter((entry) => isNonEmptyString(entry)),
  );

  if (JSON.stringify(docsInFolder) !== JSON.stringify(docsInRegistry)) {
    addIssue(
      issues,
      "ADR_REGISTRY_REFERENCE_INVALID",
      "ADR registry humanDocPath entries must match ADR documents present in docs/adr/records.",
    );
  }

  for (const [index, entry] of registry.records.entries()) {
    const requiredFields = [
      "identifier",
      "adrNumber",
      "title",
      "decisionStatus",
      "decisionDate",
      "humanDocPath",
      "aiDocPath",
    ];

    for (const field of requiredFields) {
      if (!isNonEmptyString(entry?.[field])) {
        addIssue(
          issues,
          "ADR_REGISTRY_RECORD_INVALID",
          `adr-registry record index ${index} is missing required field '${field}'.`,
        );
      }
    }

    if (!isNonEmptyString(entry?.adrNumber) || !/^\d{3}$/.test(entry.adrNumber)) {
      addIssue(
        issues,
        "ADR_REGISTRY_RECORD_INVALID",
        `adr-registry record '${entry?.identifier || `index-${index}`}' has invalid adrNumber '${entry?.adrNumber}'.`,
      );
      continue;
    }

    const expectedIdentifier = `ADR-${entry.adrNumber}`;
    if (entry.identifier !== expectedIdentifier) {
      addIssue(
        issues,
        "ADR_REGISTRY_RECORD_INVALID",
        `adr-registry record '${entry.identifier}' must use identifier '${expectedIdentifier}'.`,
      );
    }

    if (!ADR_DECISION_STATUSES.has(entry.decisionStatus)) {
      addIssue(
        issues,
        "ADR_REGISTRY_RECORD_INVALID",
        `adr-registry record '${entry.identifier}' has unsupported decisionStatus '${entry.decisionStatus}'.`,
      );
    }

    if (!isValidIsoDate(entry.decisionDate)) {
      addIssue(
        issues,
        "ADR_REGISTRY_RECORD_INVALID",
        `adr-registry record '${entry.identifier}' has invalid decisionDate '${entry.decisionDate}'.`,
      );
    }

    for (const docPath of [entry.humanDocPath, entry.aiDocPath]) {
      const absoluteDocPath = resolve(repoRoot, docPath || "");
      if (!existsSync(absoluteDocPath)) {
        addIssue(
          issues,
          "ADR_RECORD_FILE_MISSING",
          `adr-registry record '${entry.identifier}' references missing file '${docPath}'.`,
        );
      }
    }

    const humanPath = entry.humanDocPath;
    const aiPath = entry.aiDocPath;
    const absoluteHumanPath = resolve(repoRoot, humanPath || "");
    const absoluteAiPath = resolve(repoRoot, aiPath || "");

    if (!existsSync(absoluteHumanPath) || !existsSync(absoluteAiPath)) {
      continue;
    }

    const humanValidationResult = validateAdrDocument({
      issues,
      absolutePath: absoluteHumanPath,
      relativePath: humanPath,
      expectedAdrNumber: entry.adrNumber,
      expectedDecisionTitle: entry.title,
    });
    const aiValidationResult = validateAdrDocument({
      issues,
      absolutePath: absoluteAiPath,
      relativePath: aiPath,
      expectedAdrNumber: entry.adrNumber,
      expectedDecisionTitle: entry.title,
    });

    if (!humanValidationResult || !aiValidationResult) {
      continue;
    }
    const humanFrontmatter = humanValidationResult.frontmatter;
    const aiFrontmatter = aiValidationResult.frontmatter;

    for (const field of [
      "title",
      "adr_number",
      "decision_status",
      "decision_date",
      "supersedes",
      "superseded_by",
    ]) {
      if (humanFrontmatter[field] !== aiFrontmatter[field]) {
        addIssue(
          issues,
          "ADR_RECORD_PAIR_MISMATCH",
          `${humanPath} and ${aiPath} differ for metadata field '${field}'.`,
        );
      }
    }

    const humanRelatedDocReferences = collectDocReferencesFromSection({
      markdownContent: humanValidationResult.markdownContent,
      headingText: "Related Documentation",
      sourceRelativePath: humanPath,
      repoRoot,
    });
    const aiRelatedDocReferences = collectDocReferencesFromSection({
      markdownContent: aiValidationResult.markdownContent,
      headingText: "Related Documentation",
      sourceRelativePath: aiPath,
      repoRoot,
    });

    if (humanRelatedDocReferences.length === 0) {
      addIssue(
        issues,
        "ADR_RELATED_DOC_REFERENCE_MISSING",
        `${humanPath} must include at least one docs reference in '## Related Documentation'.`,
      );
    }

    if (aiRelatedDocReferences.length === 0) {
      addIssue(
        issues,
        "ADR_RELATED_DOC_REFERENCE_MISSING",
        `${aiPath} must include at least one docs reference in '## Related Documentation'.`,
      );
    }

    for (const referencePath of humanRelatedDocReferences) {
      if (!existsSync(resolve(repoRoot, referencePath))) {
        addIssue(
          issues,
          "ADR_RELATED_DOC_REFERENCE_INVALID",
          `${humanPath} references missing related documentation path '${referencePath}'.`,
        );
      }

      if (referencePath.endsWith(".ai.md")) {
        addIssue(
          issues,
          "ADR_RELATED_DOC_VARIANT_INVALID",
          `${humanPath} should reference human docs (.md) in '## Related Documentation': '${referencePath}'.`,
        );
      }

      if (isAdrRecordDocPath(referencePath) && !registryHumanDocPaths.has(referencePath)) {
        addIssue(
          issues,
          "ADR_RELATED_ADR_TARGET_MISSING",
          `${humanPath} references ADR path '${referencePath}' that is not registered in adr-registry.json.`,
        );
      }
    }

    for (const referencePath of aiRelatedDocReferences) {
      if (!existsSync(resolve(repoRoot, referencePath))) {
        addIssue(
          issues,
          "ADR_RELATED_DOC_REFERENCE_INVALID",
          `${aiPath} references missing related documentation path '${referencePath}'.`,
        );
      }

      if (referencePath.endsWith(".md") && !referencePath.endsWith(".ai.md")) {
        addIssue(
          issues,
          "ADR_RELATED_DOC_VARIANT_INVALID",
          `${aiPath} should reference AI docs (.ai.md) in '## Related Documentation': '${referencePath}'.`,
        );
      }

      if (isAdrRecordDocPath(referencePath) && !registryAiDocPaths.has(referencePath)) {
        addIssue(
          issues,
          "ADR_RELATED_ADR_TARGET_MISSING",
          `${aiPath} references ADR path '${referencePath}' that is not registered in adr-registry.json.`,
        );
      }
    }

    const expectedAiReferences = buildExpectedVariantReferenceSet({
      references: humanRelatedDocReferences,
      useAiVariant: true,
      repoRoot,
    });
    const actualAiReferences = new Set(aiRelatedDocReferences);
    const missingAiReference = findFirstMissingReference(expectedAiReferences, actualAiReferences);
    if (missingAiReference) {
      addIssue(
        issues,
        "ADR_RELATED_DOC_PAIR_MISMATCH",
        `${aiPath} is missing related documentation reference '${missingAiReference}' expected from ${humanPath}.`,
      );
    }

    const expectedHumanReferences = buildExpectedVariantReferenceSet({
      references: aiRelatedDocReferences,
      useAiVariant: false,
      repoRoot,
    });
    const actualHumanReferences = new Set(humanRelatedDocReferences);
    const missingHumanReference = findFirstMissingReference(expectedHumanReferences, actualHumanReferences);
    if (missingHumanReference) {
      addIssue(
        issues,
        "ADR_RELATED_DOC_PAIR_MISMATCH",
        `${humanPath} is missing related documentation reference '${missingHumanReference}' expected from ${aiPath}.`,
      );
    }
  }

  const architectureDocsRoot = resolve(repoRoot, "docs/architecture");
  if (existsSync(architectureDocsRoot)) {
    const architectureDocNames = readdirSync(architectureDocsRoot)
      .filter((name) => name.endsWith(".md"));
    for (const docName of architectureDocNames) {
      const relativeDocPath = `docs/architecture/${docName}`;
      const absoluteDocPath = resolve(repoRoot, relativeDocPath);
      const markdownContent = readFileSync(absoluteDocPath, "utf8");
      if (!findHeadingLine(markdownContent, "Related ADRs")) {
        continue;
      }

      const adrReferences = collectDocReferencesFromSection({
        markdownContent,
        headingText: "Related ADRs",
        sourceRelativePath: relativeDocPath,
        repoRoot,
      }).filter((referencePath) => isAdrRecordDocPath(referencePath));

      const expectedRegistrySet = relativeDocPath.endsWith(".ai.md")
        ? registryAiDocPaths
        : registryHumanDocPaths;

      for (const referencePath of adrReferences) {
        if (!existsSync(resolve(repoRoot, referencePath))) {
          addIssue(
            issues,
            "ARCHITECTURE_ADR_REFERENCE_INVALID",
            `${relativeDocPath} references missing ADR '${referencePath}' in '## Related ADRs'.`,
          );
          continue;
        }

        if (!expectedRegistrySet.has(referencePath)) {
          addIssue(
            issues,
            "ARCHITECTURE_ADR_REFERENCE_INVALID",
            `${relativeDocPath} references ADR '${referencePath}' that is not registered in adr-registry.json.`,
          );
        }
      }
    }
  }

  const contextPacksRoot = resolve(repoRoot, "docs/context/packs");
  if (existsSync(contextPacksRoot)) {
    const contextPackDocNames = readdirSync(contextPacksRoot)
      .filter((name) => /\.pack(\.ai)?\.md$/.test(name));
    for (const docName of contextPackDocNames) {
      const relativeDocPath = `docs/context/packs/${docName}`;
      const absoluteDocPath = resolve(repoRoot, relativeDocPath);
      const markdownContent = readFileSync(absoluteDocPath, "utf8");
      if (!findHeadingLine(markdownContent, "Authoritative Docs")) {
        continue;
      }

      const adrReferences = collectDocReferencesFromSection({
        markdownContent,
        headingText: "Authoritative Docs",
        sourceRelativePath: relativeDocPath,
        repoRoot,
      }).filter((referencePath) => isAdrRecordDocPath(referencePath));

      const expectedRegistrySet = relativeDocPath.endsWith(".ai.md")
        ? registryAiDocPaths
        : registryHumanDocPaths;

      for (const referencePath of adrReferences) {
        if (!existsSync(resolve(repoRoot, referencePath))) {
          addIssue(
            issues,
            "CONTEXT_PACK_ADR_REFERENCE_INVALID",
            `${relativeDocPath} references missing ADR '${referencePath}' in '## Authoritative Docs'.`,
          );
          continue;
        }

        if (!expectedRegistrySet.has(referencePath)) {
          addIssue(
            issues,
            "CONTEXT_PACK_ADR_REFERENCE_INVALID",
            `${relativeDocPath} references ADR '${referencePath}' that is not registered in adr-registry.json.`,
          );
        }
      }
    }
  }

  for (const [indexPath, expectedRegistrySet] of [
    ["docs/adr/records/README.md", registryHumanDocPaths],
    ["docs/adr/records/README.ai.md", registryAiDocPaths],
  ]) {
    const absoluteIndexPath = resolve(repoRoot, indexPath);
    if (!existsSync(absoluteIndexPath)) {
      continue;
    }

    const markdownContent = readFileSync(absoluteIndexPath, "utf8");
    const referencedAdrs = collectDocReferencesFromText({
      text: markdownContent,
      sourceRelativePath: indexPath,
      repoRoot,
    }).filter((referencePath) => isAdrRecordDocPath(referencePath));
    const referencedAdrSet = new Set(referencedAdrs);

    for (const referencePath of referencedAdrSet) {
      if (!existsSync(resolve(repoRoot, referencePath))) {
        addIssue(
          issues,
          "ADR_INDEX_REFERENCE_INVALID",
          `${indexPath} references missing ADR path '${referencePath}'.`,
        );
      } else if (!expectedRegistrySet.has(referencePath)) {
        addIssue(
          issues,
          "ADR_INDEX_REFERENCE_INVALID",
          `${indexPath} references ADR path '${referencePath}' that is not registered in adr-registry.json.`,
        );
      }
    }

    for (const referencePath of expectedRegistrySet) {
      if (!referencedAdrSet.has(referencePath)) {
        addIssue(
          issues,
          "ADR_INDEX_REFERENCE_MISSING",
          `${indexPath} is missing ADR path '${referencePath}' from adr-registry.json.`,
        );
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

  const issues = validateAdrRecords(repoRoot);

  if (issues.length > 0) {
    process.stderr.write("ADR validation failed.\n");
    for (const issue of issues) {
      process.stderr.write(`- [${issue.code}] ${issue.message}\n`);
    }
    process.stderr.write(`Total issues: ${issues.length}\n`);
    process.exit(1);
  }

  process.stdout.write([
    "ADR validation passed.",
    `Checked required sections: ${REQUIRED_ADR_SECTIONS.length}`,
    `Checked metadata fields: ${REQUIRED_METADATA_FIELDS.length}`,
    "Checked identifier consistency across registry, filename, frontmatter, and H1.",
    "Checked markdown and AI companion ADR metadata alignment.",
    "Checked ADR related-documentation cross-reference integrity and .md/.ai.md pairing.",
    "Checked architecture and context-pack ADR references against ADR registry targets.",
    "Checked ADR index files against registry records.",
  ].join("\n") + "\n");
}

main();
