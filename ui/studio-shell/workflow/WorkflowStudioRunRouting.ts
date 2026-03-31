import { ROUTE_PATHS } from "../../routes/RouteConfig";

export interface WorkflowStudioRunRouteOptions {
  readonly workflowId?: string;
  readonly workflowStatus?: "draft" | "saved";
  readonly basePath?: string;
}

function appendQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  if (!query) {
    return path;
  }
  return `${path}?${query}`;
}

function toEntrySearchParams(options?: WorkflowStudioRunRouteOptions): URLSearchParams {
  const params = new URLSearchParams();
  const workflowId = options?.workflowId?.trim();
  if (!workflowId) {
    return params;
  }

  params.set("entryMode", "asset");
  params.set("workflowId", workflowId);
  params.set("assetId", workflowId);
  const workflowStatus = options?.workflowStatus === "draft" ? "draft" : "saved";
  params.set("workflowStatus", workflowStatus);
  params.set("workflowEntry", workflowStatus === "draft" ? "resume-draft" : "open-existing");
  return params;
}

export function buildWorkflowStudioRunHistoryPath(options?: WorkflowStudioRunRouteOptions): string {
  const basePath = options?.basePath ?? ROUTE_PATHS.workflowStudioRuns;
  return appendQuery(basePath, toEntrySearchParams(options));
}

export function buildWorkflowStudioRunDetailPath(runId: string, options?: WorkflowStudioRunRouteOptions): string {
  const basePath = (options?.basePath ?? ROUTE_PATHS.workflowStudioRunDetail).replace(":runId", encodeURIComponent(runId));
  return appendQuery(basePath, toEntrySearchParams(options));
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
