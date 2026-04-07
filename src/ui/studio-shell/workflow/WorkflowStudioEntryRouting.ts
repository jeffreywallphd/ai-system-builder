import { StudioEntryModes } from "@application/studio-entry/StudioEntryContracts";
import { ROUTE_PATHS } from "../../routes/RouteConfig";

export const WorkflowStudioEntryPaths = Object.freeze({
  default: "default",
  new: "new",
  openExisting: "open-existing",
  resumeDraft: "resume-draft",
  duplicate: "duplicate",
});

export type WorkflowStudioEntryPath = typeof WorkflowStudioEntryPaths[keyof typeof WorkflowStudioEntryPaths];

export interface WorkflowStudioEntryRouteResolution {
  readonly resolvedEntryPath: WorkflowStudioEntryPath;
  readonly workflowId?: string;
  readonly invalidEntryPath?: string;
}

function normalizeOptional(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveEntryPath(rawEntryPath: string | undefined): {
  readonly resolved: WorkflowStudioEntryPath;
  readonly invalid?: string;
} {
  if (!rawEntryPath) {
    return Object.freeze({
      resolved: WorkflowStudioEntryPaths.default,
    });
  }

  if (rawEntryPath === WorkflowStudioEntryPaths.new) {
    return Object.freeze({ resolved: WorkflowStudioEntryPaths.new });
  }
  if (rawEntryPath === WorkflowStudioEntryPaths.openExisting) {
    return Object.freeze({ resolved: WorkflowStudioEntryPaths.openExisting });
  }
  if (rawEntryPath === WorkflowStudioEntryPaths.resumeDraft) {
    return Object.freeze({ resolved: WorkflowStudioEntryPaths.resumeDraft });
  }
  if (rawEntryPath === WorkflowStudioEntryPaths.duplicate) {
    return Object.freeze({ resolved: WorkflowStudioEntryPaths.duplicate });
  }

  return Object.freeze({
    resolved: WorkflowStudioEntryPaths.default,
    invalid: rawEntryPath,
  });
}

export function resolveWorkflowStudioEntryRoute(search: string): WorkflowStudioEntryRouteResolution {
  const searchParams = new URLSearchParams(search);
  const workflowId = normalizeOptional(searchParams.get("workflowId"))
    ?? normalizeOptional(searchParams.get("assetId"));
  const explicitEntryPath = normalizeOptional(searchParams.get("workflowEntry"));
  const entryMode = normalizeOptional(searchParams.get("entryMode"));
  const initSource = normalizeOptional(searchParams.get("initSource"));
  const status = normalizeOptional(searchParams.get("workflowStatus"));

  if (!explicitEntryPath && entryMode === StudioEntryModes.new) {
    return Object.freeze({
      resolvedEntryPath: WorkflowStudioEntryPaths.new,
      workflowId,
    });
  }

  if (
    !explicitEntryPath
    && workflowId
    && (entryMode === StudioEntryModes.asset || initSource === "asset" || Boolean(status))
  ) {
    return Object.freeze({
      resolvedEntryPath: status === "draft"
        ? WorkflowStudioEntryPaths.resumeDraft
        : WorkflowStudioEntryPaths.openExisting,
      workflowId,
    });
  }

  const resolvedEntry = resolveEntryPath(explicitEntryPath);
  return Object.freeze({
    resolvedEntryPath: resolvedEntry.resolved,
    workflowId,
    invalidEntryPath: resolvedEntry.invalid,
  });
}

function buildWorkflowStudioEntryPath(input: {
  readonly entryPath: Exclude<WorkflowStudioEntryPath, "default">;
  readonly workflowId?: string;
  readonly workflowStatus?: string;
}): string {
  const searchParams = new URLSearchParams();
  if (input.entryPath === WorkflowStudioEntryPaths.new) {
    searchParams.set("entryMode", StudioEntryModes.new);
  } else {
    searchParams.set("entryMode", StudioEntryModes.asset);
    if (input.workflowId) {
      searchParams.set("workflowId", input.workflowId);
      searchParams.set("assetId", input.workflowId);
    }
  }
  searchParams.set("workflowEntry", input.entryPath);
  if (input.workflowStatus) {
    searchParams.set("workflowStatus", input.workflowStatus);
  }
  return `${ROUTE_PATHS.workflowStudio}?${searchParams.toString()}`;
}

export function buildWorkflowStudioCreateNewPath(): string {
  return buildWorkflowStudioEntryPath({
    entryPath: WorkflowStudioEntryPaths.new,
  });
}

export function buildWorkflowStudioOpenExistingPath(workflowId: string): string {
  return buildWorkflowStudioEntryPath({
    entryPath: WorkflowStudioEntryPaths.openExisting,
    workflowId,
  });
}

export function buildWorkflowStudioResumeDraftPath(workflowId: string): string {
  return buildWorkflowStudioEntryPath({
    entryPath: WorkflowStudioEntryPaths.resumeDraft,
    workflowId,
    workflowStatus: "draft",
  });
}

export function buildWorkflowStudioDuplicatePath(workflowId: string): string {
  return buildWorkflowStudioEntryPath({
    entryPath: WorkflowStudioEntryPaths.duplicate,
    workflowId,
  });
}

