const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

const CHECK_CATALOG = [
  {
    id: "foundation",
    description: "Validate documentation foundation contracts and core structure.",
    scriptPath: "dev/scripts/validate-docs-foundation.cjs",
  },
  {
    id: "registry",
    description: "Validate documentation registry shape and cross-reference integrity.",
    scriptPath: "dev/scripts/validate-documentation-registry.cjs",
  },
  {
    id: "adr",
    description: "Validate ADR records, registry, and cross-link integrity.",
    scriptPath: "dev/scripts/validate-adr-records.cjs",
  },
  {
    id: "architecture-domains",
    description: "Validate architecture domain folder and router contracts.",
    scriptPath: "dev/scripts/validate-architecture-domains.cjs",
  },
  {
    id: "segmentation",
    description: "Validate docs segmentation and supersession rules.",
    scriptPath: "dev/scripts/validate-docs-segmentation.cjs",
  },
  {
    id: "cross-references",
    description: "Validate high-value docs internal links and cross-reference integrity.",
    scriptPath: "dev/scripts/validate-docs-cross-references.cjs",
  },
  {
    id: "category-compliance",
    description: "Validate category-specific doc placement and lifecycle compliance rules.",
    scriptPath: "dev/scripts/validate-docs-category-compliance.cjs",
  },
];

const ISSUE_LINE_PATTERN = /^\s*-\s+\[([A-Z0-9_-]+)\]\s+(.+)$/;
const IMPORTANT_ISSUE_CODE_PATTERNS = [
  /^READ-\d+$/,
];

const CHECK_GUIDANCE = {
  foundation: {
    quickFix: "Repair required docs structure, metadata headers, and context/ADR foundation contracts.",
    guidePaths: [
      "docs/contributors/docs-foundation-validation.ai.md",
      "docs/context/governance/documentation-quality-standard.ai.md",
    ],
  },
  registry: {
    quickFix: "Repair registry entry shape, enums, and cross-reference consistency.",
    guidePaths: [
      "docs/context/documentation-registry.ai.md",
      "docs/contributors/documentation-quality-enforced-standards-guide.ai.md",
    ],
  },
  adr: {
    quickFix: "Repair ADR frontmatter/section contracts and ADR cross-reference integrity.",
    guidePaths: [
      "docs/adr/records/authoring-guide.ai.md",
      "docs/contributors/docs-foundation-validation.ai.md",
    ],
  },
  "architecture-domains": {
    quickFix: "Repair architecture domain taxonomy alignment, required files, and overview/reference links.",
    guidePaths: [
      "docs/contributors/architecture-domain-navigation-worked-examples.ai.md",
      "docs/contributors/docs-foundation-validation.ai.md",
    ],
  },
  segmentation: {
    quickFix: "Repair status signaling, supersession redirects, and active-path routing links.",
    guidePaths: [
      "docs/context/documentation-supersession-and-redirect-conventions.ai.md",
      "docs/contributors/documentation-quality-enforced-standards-guide.ai.md",
    ],
  },
  "cross-references": {
    quickFix: "Repair broken docs links and synchronize routing/index/registry cross-references.",
    guidePaths: [
      "docs/contributors/documentation-quality-enforced-standards-guide.ai.md",
      "docs/contributors/docs-foundation-validation.ai.md",
    ],
  },
  "category-compliance": {
    quickFix: "Repair category placement, lifecycle status/authority, and routing-to-active-doc expectations.",
    guidePaths: [
      "docs/contributors/documentation-quality-enforced-standards-guide.ai.md",
      "docs/context/governance/documentation-quality-standard.ai.md",
    ],
  },
};

function parseCheckIds(rawValue) {
  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseArgs(argv) {
  let repoRoot = process.cwd();
  let lintRoot = null;
  let listChecks = false;
  const selectedCheckIds = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--root") {
      const nextArg = argv[index + 1];
      if (!nextArg) {
        throw new Error("Missing value for --root");
      }
      lintRoot = resolve(nextArg);
      index += 1;
      continue;
    }

    if (arg === "--checks") {
      const nextArg = argv[index + 1];
      if (!nextArg) {
        throw new Error("Missing value for --checks");
      }
      selectedCheckIds.push(...parseCheckIds(nextArg));
      index += 1;
      continue;
    }

    if (arg === "--check") {
      const nextArg = argv[index + 1];
      if (!nextArg) {
        throw new Error("Missing value for --check");
      }
      selectedCheckIds.push(nextArg.trim());
      index += 1;
      continue;
    }

    if (arg === "--list-checks") {
      listChecks = true;
      continue;
    }

    throw new Error(`Unknown argument '${arg}'.`);
  }

  return {
    repoRoot,
    lintRoot,
    listChecks,
    selectedCheckIds,
  };
}

function resolveSelectedChecks(selectedCheckIds) {
  if (selectedCheckIds.length === 0) {
    return CHECK_CATALOG;
  }

  const checkById = new Map(CHECK_CATALOG.map((check) => [check.id, check]));
  const uniqueRequestedIds = [...new Set(selectedCheckIds)];
  const unknownIds = uniqueRequestedIds.filter((id) => !checkById.has(id));
  if (unknownIds.length > 0) {
    throw new Error(
      `Unknown docs lint check id(s): ${unknownIds.join(", ")}. Run with --list-checks to see valid ids.`,
    );
  }

  return uniqueRequestedIds.map((id) => checkById.get(id));
}

function runCheck({ repoRoot, lintRoot, check }) {
  const absoluteScriptPath = resolve(repoRoot, check.scriptPath);
  const args = [absoluteScriptPath];
  if (lintRoot) {
    args.push("--root", lintRoot);
  }

  const startTime = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const elapsedMs = Date.now() - startTime;

  return {
    check,
    elapsedMs,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    signal: result.signal ?? null,
    error: result.error ?? null,
  };
}

function writeListChecks() {
  process.stdout.write("Available docs lint checks:\n");
  for (const check of CHECK_CATALOG) {
    process.stdout.write(`- ${check.id}: ${check.description}\n`);
  }
  process.stdout.write("Run all checks: node dev/scripts/lint-docs.cjs\n");
  process.stdout.write("Run selected checks: node dev/scripts/lint-docs.cjs --checks <id1,id2>\n");
}

function writeResultSummary({ results, lintFailed }) {
  const destination = lintFailed ? process.stderr : process.stdout;
  destination.write(lintFailed ? "Docs lint failed.\n" : "Docs lint passed.\n");
  for (const result of results) {
    const statusLabel = result.status === 0 ? "PASS" : "FAIL";
    destination.write(`- [${statusLabel}] ${result.check.id} (${result.elapsedMs}ms)\n`);
  }
}

function inferSeverityFromIssueCode(issueCode) {
  if (IMPORTANT_ISSUE_CODE_PATTERNS.some((pattern) => pattern.test(issueCode))) {
    return "important";
  }
  return "critical";
}

function normalizeDetectedPath(pathValue) {
  if (typeof pathValue !== "string") {
    return "";
  }
  return pathValue.replace(/[),.;:'"]+$/g, "");
}

function detectFileReference(message) {
  if (typeof message !== "string" || message.trim().length === 0) {
    return "";
  }

  const docsPathMatch = message.match(/(docs\/[a-zA-Z0-9._\-/]+(?:\.[a-zA-Z0-9._-]+)?)/);
  if (docsPathMatch) {
    return normalizeDetectedPath(docsPathMatch[1]);
  }

  const sourcePathMatch = message.match(/(src\/[a-zA-Z0-9._\-/]+(?:\.[a-zA-Z0-9._-]+)?)/);
  if (sourcePathMatch) {
    return normalizeDetectedPath(sourcePathMatch[1]);
  }

  return "";
}

function parseCheckIssues(result) {
  const issues = [];
  const extraContextLines = [];
  const combinedLines = `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of combinedLines) {
    const issueMatch = line.match(ISSUE_LINE_PATTERN);
    if (issueMatch) {
      const issueCode = issueMatch[1];
      const message = issueMatch[2];
      issues.push({
        code: issueCode,
        message,
        severity: inferSeverityFromIssueCode(issueCode),
        filePath: detectFileReference(message),
      });
      continue;
    }

    if (
      line.startsWith("Total issues:")
      || line.startsWith("Argument error:")
      || line.endsWith("validation failed.")
      || line === "stdout:"
      || line === "stderr:"
    ) {
      continue;
    }

    extraContextLines.push(line);
  }

  return {
    issues,
    extraContextLines,
  };
}

function countSeverities(issues) {
  const counts = {
    critical: 0,
    important: 0,
    advisory: 0,
  };

  for (const issue of issues) {
    if (issue.severity === "important") {
      counts.important += 1;
      continue;
    }
    if (issue.severity === "advisory") {
      counts.advisory += 1;
      continue;
    }
    counts.critical += 1;
  }

  return counts;
}

function writeFailureDetails(results) {
  const failedResults = results.filter((result) => result.status !== 0);
  if (failedResults.length === 0) {
    return;
  }

  const parsedByCheck = failedResults.map((result) => ({
    result,
    parsed: parseCheckIssues(result),
  }));

  const allIssues = parsedByCheck.flatMap((entry) => entry.parsed.issues);
  const severityCounts = countSeverities(allIssues);
  process.stderr.write([
    "",
    "Actionable findings by check:",
    `Severity summary: critical=${severityCounts.critical}, important=${severityCounts.important}, advisory=${severityCounts.advisory}`,
  ].join("\n") + "\n");

  for (const result of failedResults) {
    const parsed = parsedByCheck.find((entry) => entry.result === result)?.parsed || {
      issues: [],
      extraContextLines: [],
    };
    const guidance = CHECK_GUIDANCE[result.check.id] || {
      quickFix: "Review validator output and repair the referenced contract issue.",
      guidePaths: ["docs/contributors/docs-foundation-validation.ai.md"],
    };

    process.stderr.write(`\n## ${result.check.id}\n`);
    process.stderr.write(`Description: ${result.check.description}\n`);
    process.stderr.write(`Quick fix: ${guidance.quickFix}\n`);
    process.stderr.write(`Guides: ${guidance.guidePaths.join(", ")}\n`);

    if (result.error) {
      process.stderr.write(`Spawn error: ${result.error.message}\n`);
    }
    if (result.signal) {
      process.stderr.write(`Signal: ${result.signal}\n`);
    }

    if (parsed.issues.length > 0) {
      process.stderr.write("Issues:\n");
      for (const issue of parsed.issues) {
        process.stderr.write(`- [${issue.severity.toUpperCase()}] [${issue.code}] ${issue.message}\n`);
        if (issue.filePath) {
          process.stderr.write(`  file: ${issue.filePath}\n`);
        }
      }
    } else {
      process.stderr.write("Issues:\n");
      process.stderr.write("- [CRITICAL] [UNPARSED_VALIDATOR_FAILURE] Validator failed without parseable issue lines.\n");
    }

    if (parsed.extraContextLines.length > 0) {
      process.stderr.write("Additional context:\n");
      for (const line of parsed.extraContextLines) {
        process.stderr.write(`- ${line}\n`);
      }
    }

    if (result.stdout.trim().length > 0 || result.stderr.trim().length > 0) {
      process.stderr.write("Raw validator output:\n");
      if (result.stdout.trim().length > 0) {
        process.stderr.write("stdout:\n");
        process.stderr.write(result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`);
      }
      if (result.stderr.trim().length > 0) {
        process.stderr.write("stderr:\n");
        process.stderr.write(result.stderr.endsWith("\n") ? result.stderr : `${result.stderr}\n`);
      }
    }
  }
}

function main() {
  let parsedArgs;
  try {
    parsedArgs = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Argument error: ${error.message}\n`);
    process.exit(2);
  }

  if (parsedArgs.listChecks) {
    writeListChecks();
    return;
  }

  let selectedChecks;
  try {
    selectedChecks = resolveSelectedChecks(parsedArgs.selectedCheckIds);
  } catch (error) {
    process.stderr.write(`Argument error: ${error.message}\n`);
    process.exit(2);
  }

  const results = selectedChecks.map((check) => runCheck({
    repoRoot: parsedArgs.repoRoot,
    lintRoot: parsedArgs.lintRoot,
    check,
  }));
  const lintFailed = results.some((result) => result.status !== 0);

  writeResultSummary({ results, lintFailed });

  if (lintFailed) {
    writeFailureDetails(results);
    process.exit(1);
  }
}

main();
