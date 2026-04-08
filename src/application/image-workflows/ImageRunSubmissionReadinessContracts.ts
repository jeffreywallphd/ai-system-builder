export const ImageRunSubmissionReadinessStates = Object.freeze({
  ready: "ready",
  advisory: "advisory",
  blocked: "blocked",
});

export type ImageRunSubmissionReadinessState =
  typeof ImageRunSubmissionReadinessStates[keyof typeof ImageRunSubmissionReadinessStates];

export const ImageRunSubmissionReadinessIssueSeverities = Object.freeze({
  error: "error",
  warning: "warning",
  info: "info",
});

export type ImageRunSubmissionReadinessIssueSeverity =
  typeof ImageRunSubmissionReadinessIssueSeverities[keyof typeof ImageRunSubmissionReadinessIssueSeverities];

export const ImageRunSubmissionReadinessIssueCategories = Object.freeze({
  blocking: "blocking",
  advisory: "advisory",
  policyDenial: "policy-denial",
  assetBinding: "asset-binding",
  systemValidity: "system-validity",
  workflowValidity: "workflow-validity",
  backendReadinessDependency: "backend-readiness-dependency",
  compatibility: "compatibility",
});

export type ImageRunSubmissionReadinessIssueCategory =
  typeof ImageRunSubmissionReadinessIssueCategories[keyof typeof ImageRunSubmissionReadinessIssueCategories];

export interface ImageRunSubmissionReadinessIssue {
  readonly code: string;
  readonly summary: string;
  readonly category: ImageRunSubmissionReadinessIssueCategory;
  readonly severity: ImageRunSubmissionReadinessIssueSeverity;
  readonly blocking: boolean;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ImageRunSubmissionReadinessPolicyDenial {
  readonly policyId: string;
  readonly code: string;
  readonly summary: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ImageRunSubmissionAssetBindingCompleteness {
  readonly complete: boolean;
  readonly missingInputBindingIds: ReadonlyArray<string>;
  readonly missingOutputBindingIds: ReadonlyArray<string>;
  readonly unresolvedAssetReferences: ReadonlyArray<string>;
}

export interface ImageRunSubmissionDefinitionValidity {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<ImageRunSubmissionReadinessIssue>;
}

export const ImageRunSubmissionBackendAdapterHealthStates = Object.freeze({
  healthy: "healthy",
  degraded: "degraded",
  unavailable: "unavailable",
  unknown: "unknown",
});

export type ImageRunSubmissionBackendAdapterHealthState =
  typeof ImageRunSubmissionBackendAdapterHealthStates[keyof typeof ImageRunSubmissionBackendAdapterHealthStates];

export interface ImageRunSubmissionBackendReadinessDependency {
  readonly adapterHealth: ImageRunSubmissionBackendAdapterHealthState;
  readonly ready: boolean;
  readonly issues: ReadonlyArray<ImageRunSubmissionReadinessIssue>;
}

export interface ImageRunSubmissionCompatibilityFinding {
  readonly compatible: boolean;
  readonly issues: ReadonlyArray<ImageRunSubmissionReadinessIssue>;
}

export interface ImageRunSubmissionReadinessResult {
  readonly checkedAt: string;
  readonly state: ImageRunSubmissionReadinessState;
  readonly readyForQueueing: boolean;
  readonly summary: string;
  readonly issues: ReadonlyArray<ImageRunSubmissionReadinessIssue>;
  readonly blockingIssues: ReadonlyArray<ImageRunSubmissionReadinessIssue>;
  readonly advisoryIssues: ReadonlyArray<ImageRunSubmissionReadinessIssue>;
  readonly policyDenials: ReadonlyArray<ImageRunSubmissionReadinessPolicyDenial>;
  readonly assetBinding: ImageRunSubmissionAssetBindingCompleteness;
  readonly workflowValidity: ImageRunSubmissionDefinitionValidity;
  readonly systemValidity: ImageRunSubmissionDefinitionValidity;
  readonly backendReadinessDependency: ImageRunSubmissionBackendReadinessDependency;
  readonly compatibility: ImageRunSubmissionCompatibilityFinding;
}

export interface BuildImageRunSubmissionReadinessResultInput {
  readonly checkedAt: string;
  readonly issues: ReadonlyArray<ImageRunSubmissionReadinessIssue>;
  readonly policyDenials?: ReadonlyArray<ImageRunSubmissionReadinessPolicyDenial>;
  readonly assetBinding: ImageRunSubmissionAssetBindingCompleteness;
  readonly workflowValidity: ImageRunSubmissionDefinitionValidity;
  readonly systemValidity: ImageRunSubmissionDefinitionValidity;
  readonly backendReadinessDependency: ImageRunSubmissionBackendReadinessDependency;
  readonly compatibility: ImageRunSubmissionCompatibilityFinding;
}

export function buildImageRunSubmissionReadinessResult(
  input: BuildImageRunSubmissionReadinessResultInput,
): ImageRunSubmissionReadinessResult {
  const blockingIssues = Object.freeze(input.issues.filter((issue) => issue.blocking));
  const advisoryIssues = Object.freeze(input.issues.filter((issue) => !issue.blocking));

  const state = blockingIssues.length > 0
    ? ImageRunSubmissionReadinessStates.blocked
    : advisoryIssues.length > 0
    ? ImageRunSubmissionReadinessStates.advisory
    : ImageRunSubmissionReadinessStates.ready;

  const summary = resolveSubmissionReadinessSummary(state, blockingIssues.length, advisoryIssues.length);

  return Object.freeze({
    checkedAt: input.checkedAt,
    state,
    readyForQueueing: blockingIssues.length === 0,
    summary,
    issues: Object.freeze([...input.issues]),
    blockingIssues,
    advisoryIssues,
    policyDenials: Object.freeze([...(input.policyDenials ?? [])]),
    assetBinding: input.assetBinding,
    workflowValidity: input.workflowValidity,
    systemValidity: input.systemValidity,
    backendReadinessDependency: input.backendReadinessDependency,
    compatibility: input.compatibility,
  });
}

function resolveSubmissionReadinessSummary(
  state: ImageRunSubmissionReadinessState,
  blockingIssueCount: number,
  advisoryIssueCount: number,
): string {
  if (state === ImageRunSubmissionReadinessStates.blocked) {
    return `Run submission is blocked by ${blockingIssueCount} issue(s).`;
  }
  if (state === ImageRunSubmissionReadinessStates.advisory) {
    return `Run submission is queue-eligible with ${advisoryIssueCount} advisory issue(s).`;
  }
  return "Run submission is ready for queue admission.";
}
