import { ROUTE_PATHS } from "../../routes/RouteConfig";

export function buildWorkflowStudioRunHistoryPath(): string {
  return ROUTE_PATHS.workflowStudioRuns;
}

export function buildWorkflowStudioRunDetailPath(runId: string): string {
  return ROUTE_PATHS.workflowStudioRunDetail.replace(":runId", encodeURIComponent(runId));
}

export function resolveWorkflowStudioRunRoute(input: {
  readonly runId?: string;
}): { readonly runId?: string; readonly isRunRoute: boolean } {
  const normalizedRunId = input.runId?.trim();
  return Object.freeze({
    runId: normalizedRunId && normalizedRunId.length > 0 ? normalizedRunId : undefined,
    isRunRoute: normalizedRunId !== undefined,
  });
}
