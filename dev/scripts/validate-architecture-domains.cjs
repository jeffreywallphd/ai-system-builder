const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");

const REQUIRED_DOMAIN_FILES = [
  "overview.md",
  "overview.ai.md",
  "references/README.md",
  "references/README.ai.md",
];

const DOMAIN_ROUTER_FILES = [
  "docs/architecture/domains/README.md",
  "docs/architecture/domains/README.ai.md",
];

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

function extractExpectedDomainIds(taxonomyContent) {
  const ids = [];
  const seen = new Set();
  const pattern = /^\|\s*`([^`]+)`\s*\|/gm;
  let match = pattern.exec(taxonomyContent);
  while (match) {
    const domainId = match[1].trim();
    if (!seen.has(domainId)) {
      ids.push(domainId);
      seen.add(domainId);
    }
    match = pattern.exec(taxonomyContent);
  }
  return ids;
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

function validateCoreLinksInFile({ issues, repoRoot, relativePath }) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    return;
  }

  const content = readFileSync(absolutePath, "utf8");
  const links = extractMarkdownLinks(content);
  const reported = new Set();

  for (const linkTarget of links) {
    const normalizedTarget = normalizeLocalLink(linkTarget);
    if (!normalizedTarget) {
      continue;
    }

    const resolvedTarget = resolveLinkTarget(repoRoot, relativePath, normalizedTarget);
    if (!existsSync(resolvedTarget)) {
      const key = `${relativePath}::${normalizedTarget}`;
      if (reported.has(key)) {
        continue;
      }
      reported.add(key);
      addIssue(
        issues,
        "DOMAIN_CORE_LINK_MISSING",
        `${relativePath} references missing path '${normalizedTarget}'.`,
      );
    }
  }
}

function validateArchitectureDomains(repoRoot) {
  const issues = [];
  const domainsRoot = resolve(repoRoot, "docs/architecture/domains");
  const taxonomyPath = resolve(repoRoot, "docs/architecture/architecture-domain-taxonomy.md");

  if (!existsSync(domainsRoot)) {
    addIssue(
      issues,
      "DOMAIN_ROOT_MISSING",
      `Expected architecture domain root at ${normalizePath(domainsRoot)}.`,
    );
    return issues;
  }

  if (!existsSync(taxonomyPath)) {
    addIssue(
      issues,
      "DOMAIN_TAXONOMY_MISSING",
      "Missing required taxonomy source: docs/architecture/architecture-domain-taxonomy.md",
    );
    return issues;
  }

  const taxonomyContent = readFileSync(taxonomyPath, "utf8");
  const expectedDomainIds = extractExpectedDomainIds(taxonomyContent);
  if (expectedDomainIds.length === 0) {
    addIssue(
      issues,
      "DOMAIN_TAXONOMY_INVALID",
      "Could not extract domain IDs from docs/architecture/architecture-domain-taxonomy.md",
    );
    return issues;
  }

  const actualDomainIds = readdirSync(domainsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const expectedDomainSet = new Set(expectedDomainIds);
  const actualDomainSet = new Set(actualDomainIds);

  for (const domainId of expectedDomainIds) {
    if (!actualDomainSet.has(domainId)) {
      addIssue(
        issues,
        "DOMAIN_DIRECTORY_MISSING",
        `Missing expected architecture domain directory: docs/architecture/domains/${domainId}/`,
      );
    }
  }

  for (const domainId of actualDomainIds) {
    if (!expectedDomainSet.has(domainId)) {
      addIssue(
        issues,
        "DOMAIN_DIRECTORY_UNEXPECTED",
        `Unexpected architecture domain directory not declared in taxonomy: docs/architecture/domains/${domainId}/`,
      );
    }
  }

  for (const routerPath of DOMAIN_ROUTER_FILES) {
    const absoluteRouterPath = resolve(repoRoot, routerPath);
    if (!existsSync(absoluteRouterPath)) {
      addIssue(
        issues,
        "DOMAIN_ROUTER_MISSING",
        `Missing required domain router file: ${routerPath}`,
      );
      continue;
    }

    const routerContent = readFileSync(absoluteRouterPath, "utf8");
    for (const domainId of expectedDomainIds) {
      const expectedOverviewLink = `./${domainId}/overview.md`;
      if (!routerContent.includes(expectedOverviewLink)) {
        addIssue(
          issues,
          "DOMAIN_ROUTER_LINK_MISSING",
          `${routerPath} is missing required domain overview link '${expectedOverviewLink}'.`,
        );
      }
    }

    validateCoreLinksInFile({ issues, repoRoot, relativePath: routerPath });
  }

  for (const domainId of expectedDomainIds) {
    const domainRelativeRoot = `docs/architecture/domains/${domainId}`;
    const domainAbsoluteRoot = resolve(repoRoot, domainRelativeRoot);

    if (!existsSync(domainAbsoluteRoot)) {
      continue;
    }

    for (const requiredPath of REQUIRED_DOMAIN_FILES) {
      const relativePath = `${domainRelativeRoot}/${requiredPath}`;
      if (!existsSync(resolve(repoRoot, relativePath))) {
        addIssue(
          issues,
          "DOMAIN_REQUIRED_FILE_MISSING",
          `Missing required domain file: ${relativePath}`,
        );
      }
    }

    const overviewPath = `${domainRelativeRoot}/overview.md`;
    const overviewAiPath = `${domainRelativeRoot}/overview.ai.md`;
    const referencesReadmePath = `${domainRelativeRoot}/references/README.md`;
    const referencesReadmeAiPath = `${domainRelativeRoot}/references/README.ai.md`;

    if (existsSync(resolve(repoRoot, overviewPath))) {
      const overviewContent = readFileSync(resolve(repoRoot, overviewPath), "utf8");
      const overviewLinks = extractMarkdownLinks(overviewContent)
        .map((linkTarget) => normalizeLocalLink(linkTarget));
      if (!overviewLinks.some((linkTarget) => linkTarget.startsWith("./references/"))) {
        addIssue(
          issues,
          "DOMAIN_REQUIRED_LINK_MISSING",
          `${overviewPath} must link to at least one './references/*.md' domain reference.`,
        );
      }
      validateCoreLinksInFile({ issues, repoRoot, relativePath: overviewPath });
    }

    if (existsSync(resolve(repoRoot, overviewAiPath))) {
      const overviewAiContent = readFileSync(resolve(repoRoot, overviewAiPath), "utf8");
      const overviewAiLinks = extractMarkdownLinks(overviewAiContent)
        .map((linkTarget) => normalizeLocalLink(linkTarget));
      if (!overviewAiLinks.some((linkTarget) => linkTarget.startsWith("./references/"))) {
        addIssue(
          issues,
          "DOMAIN_REQUIRED_LINK_MISSING",
          `${overviewAiPath} must link to at least one './references/*.md' domain reference.`,
        );
      }
      validateCoreLinksInFile({ issues, repoRoot, relativePath: overviewAiPath });
    }

    if (existsSync(resolve(repoRoot, referencesReadmePath))) {
      const referencesContent = readFileSync(resolve(repoRoot, referencesReadmePath), "utf8");
      if (!referencesContent.includes("../overview.md")) {
        addIssue(
          issues,
          "DOMAIN_REQUIRED_LINK_MISSING",
          `${referencesReadmePath} must link to '../overview.md'.`,
        );
      }
      validateCoreLinksInFile({ issues, repoRoot, relativePath: referencesReadmePath });
    }

    if (existsSync(resolve(repoRoot, referencesReadmeAiPath))) {
      const referencesAiContent = readFileSync(resolve(repoRoot, referencesReadmeAiPath), "utf8");
      if (!referencesAiContent.includes("../overview.md")) {
        addIssue(
          issues,
          "DOMAIN_REQUIRED_LINK_MISSING",
          `${referencesReadmeAiPath} must link to '../overview.md'.`,
        );
      }
      validateCoreLinksInFile({ issues, repoRoot, relativePath: referencesReadmeAiPath });
    }

    const referencesRoot = resolve(repoRoot, `${domainRelativeRoot}/references`);
    if (!existsSync(referencesRoot)) {
      continue;
    }

    const referenceFiles = readdirSync(referencesRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    const humanReferenceDocs = referenceFiles.filter(
      (name) => name.endsWith(".md") && !name.endsWith(".ai.md") && name !== "README.md",
    );
    const aiReferenceDocs = referenceFiles.filter(
      (name) => name.endsWith(".ai.md") && name !== "README.ai.md",
    );

    if (humanReferenceDocs.length === 0) {
      addIssue(
        issues,
        "DOMAIN_REFERENCE_DOC_MISSING",
        `Domain '${domainId}' must include at least one reference contract in docs/architecture/domains/${domainId}/references/.`,
      );
    }

    const aiReferenceSet = new Set(aiReferenceDocs);
    const humanReferenceSet = new Set(humanReferenceDocs);
    for (const humanReference of humanReferenceDocs) {
      const expectedAiReference = humanReference.replace(/\.md$/, ".ai.md");
      if (!aiReferenceSet.has(expectedAiReference)) {
        addIssue(
          issues,
          "DOMAIN_REFERENCE_PAIR_MISSING",
          `Missing AI companion for domain reference: docs/architecture/domains/${domainId}/references/${expectedAiReference}`,
        );
      }
    }

    for (const aiReference of aiReferenceDocs) {
      const expectedHumanReference = aiReference.replace(/\.ai\.md$/, ".md");
      if (!humanReferenceSet.has(expectedHumanReference)) {
        addIssue(
          issues,
          "DOMAIN_REFERENCE_PAIR_MISSING",
          `Missing human companion for domain reference: docs/architecture/domains/${domainId}/references/${expectedHumanReference}`,
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

  const issues = validateArchitectureDomains(repoRoot);

  if (issues.length > 0) {
    process.stderr.write("Architecture domain validation failed.\n");
    for (const issue of issues) {
      process.stderr.write(`- [${issue.code}] ${issue.message}\n`);
    }
    process.stderr.write(`Total issues: ${issues.length}\n`);
    process.exit(1);
  }

  const expectedDomainIds = extractExpectedDomainIds(
    readFileSync(resolve(repoRoot, "docs/architecture/architecture-domain-taxonomy.md"), "utf8"),
  );
  process.stdout.write([
    "Architecture domain validation passed.",
    `Checked taxonomy-backed domains: ${expectedDomainIds.length}`,
    `Checked required domain files per domain: ${REQUIRED_DOMAIN_FILES.length}`,
    "Checked required overview/reference index links.",
    "Checked core markdown link targets in domain routers, overviews, and reference indexes.",
    "Checked domain reference .md/.ai.md companion pairing.",
  ].join("\n") + "\n");
}

main();
