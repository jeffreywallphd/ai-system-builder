const metricPattern =
  /^(?:\W+)?\s*(tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\s+(.+)$/;

export const buildNonBrowserNodeTestRunOptions = ({ files, cwd }) => ({
  cwd,
  files: [...files],
  isolation: "none",
});

const formatSerializedError = (error) => {
  if (!error || typeof error !== "object") {
    return "Unknown error";
  }

  if (typeof error.stack === "string" && error.stack.trim().length > 0) {
    return error.stack.trim();
  }

  const name =
    typeof error.name === "string" && error.name.length > 0
      ? error.name
      : "Error";
  const message =
    typeof error.message === "string" && error.message.length > 0
      ? error.message
      : "No error message was provided.";
  return `${name}: ${message}`;
};

export const formatNonBrowserFailureSummary = ({
  failures = [],
  startupError = null,
} = {}) => {
  const lines = [];

  if (startupError) {
    lines.push("Non-browser test runner startup failed:");
    lines.push(formatSerializedError(startupError));
  }

  if (failures.length > 0) {
    lines.push(`Non-browser test failures (${failures.length}):`);
    for (const failure of failures) {
      const name =
        typeof failure?.name === "string" && failure.name.length > 0
          ? failure.name
          : "Unnamed test";
      const file =
        typeof failure?.file === "string" && failure.file.length > 0
          ? failure.file
          : "";
      const position = [failure?.line, failure?.column]
        .filter(Number.isFinite)
        .join(":");
      const location = file ? `${file}${position ? `:${position}` : ""}` : "";
      lines.push(`- ${name}${location ? ` (${location})` : ""}`);
      lines.push(formatSerializedError(failure?.details?.error));
    }
  }

  return lines.join("\n");
};

export const applyDiagnosticSummaryMetric = (summary, diagnosticMessage) => {
  const message =
    typeof diagnosticMessage === "string" ? diagnosticMessage.trim() : "";
  const match = metricPattern.exec(message);

  if (!match) {
    return false;
  }

  const [, metricName, rawValue] = match;
  const numericValue = Number(rawValue);

  switch (metricName) {
    case "tests":
      summary.counts.tests = numericValue;
      return true;
    case "suites":
      summary.counts.suites = numericValue;
      return true;
    case "pass":
      summary.counts.passed = numericValue;
      return true;
    case "fail":
      summary.counts.failed = numericValue;
      return true;
    case "cancelled":
      summary.counts.cancelled = numericValue;
      return true;
    case "skipped":
      summary.counts.skipped = numericValue;
      return true;
    case "todo":
      summary.counts.todo = numericValue;
      return true;
    case "duration_ms":
      summary.durationMs = numericValue;
      return true;
    default:
      return false;
  }
};

export const isIgnorableRunnerSpawnFailure = ({
  event,
  sourceFile,
  runnerRelativePath,
}) => {
  if (!event || typeof event !== "object") {
    return false;
  }

  const file = typeof sourceFile === "string" ? sourceFile : "";
  const errorCode = event.details?.error?.code;
  const causeCode = event.details?.error?.cause?.code;

  return (
    file === runnerRelativePath &&
    errorCode === "ERR_TEST_FAILURE" &&
    causeCode === "EPERM"
  );
};

export const applyIgnoredFailureAdjustments = (
  summary,
  ignoredFailureCount,
) => {
  if (!Number.isFinite(ignoredFailureCount) || ignoredFailureCount <= 0) {
    return;
  }

  summary.counts.failed = Math.max(
    0,
    summary.counts.failed - ignoredFailureCount,
  );
  summary.counts.tests = Math.max(
    0,
    summary.counts.tests - ignoredFailureCount,
  );
};
