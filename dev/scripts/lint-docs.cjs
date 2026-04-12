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

function writeFailureDetails(results) {
  const failedResults = results.filter((result) => result.status !== 0);
  if (failedResults.length === 0) {
    return;
  }

  for (const result of failedResults) {
    process.stderr.write(`\n## ${result.check.id}\n`);
    if (result.error) {
      process.stderr.write(`Spawn error: ${result.error.message}\n`);
    }
    if (result.signal) {
      process.stderr.write(`Signal: ${result.signal}\n`);
    }
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
