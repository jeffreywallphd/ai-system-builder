export const ValidationIssueSeverities = Object.freeze({
  error: "error",
  warning: "warning",
} as const);

export type ValidationIssueSeverity = typeof ValidationIssueSeverities[keyof typeof ValidationIssueSeverities];

export interface ValidationIssue {
  readonly rowId: string;
  readonly fieldName: string;
  readonly rule: string;
  readonly message: string;
  readonly severity: ValidationIssueSeverity;
}

export interface ValidationSummary {
  readonly totalRows: number;
  readonly validRows: number;
  readonly invalidRows: number;
  readonly issueCount: number;
  readonly warningCount: number;
  readonly errorCount: number;
}

export function summarizeValidationIssues(
  totalRows: number,
  invalidRowIds: ReadonlySet<string>,
  issues: ReadonlyArray<ValidationIssue>,
): ValidationSummary {
  const warningCount = issues.filter((issue) => issue.severity === ValidationIssueSeverities.warning).length;
  const errorCount = issues.length - warningCount;
  return Object.freeze({
    totalRows,
    validRows: Math.max(0, totalRows - invalidRowIds.size),
    invalidRows: invalidRowIds.size,
    issueCount: issues.length,
    warningCount,
    errorCount,
  });
}

export function countIssuesByField(
  issues: ReadonlyArray<ValidationIssue>,
): ReadonlyArray<Readonly<{ fieldName: string; issueCount: number; warningCount: number; errorCount: number }>> {
  const counts = new Map<string, { issueCount: number; warningCount: number; errorCount: number }>();
  for (const issue of issues) {
    const summary = counts.get(issue.fieldName) ?? { issueCount: 0, warningCount: 0, errorCount: 0 };
    summary.issueCount += 1;
    if (issue.severity === ValidationIssueSeverities.warning) {
      summary.warningCount += 1;
    } else {
      summary.errorCount += 1;
    }
    counts.set(issue.fieldName, summary);
  }

  return Object.freeze(
    [...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([fieldName, summary]) => Object.freeze({
        fieldName,
        issueCount: summary.issueCount,
        warningCount: summary.warningCount,
        errorCount: summary.errorCount,
      })),
  );
}
