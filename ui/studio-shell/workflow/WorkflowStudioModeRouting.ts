import { isWorkflowStudioModeId, type WorkflowStudioModeId } from "./WorkflowStudioModes";

export interface WorkflowStudioModeRouteResolution {
  readonly requestedModeId?: WorkflowStudioModeId;
  readonly invalidModeId?: string;
  readonly source: "route-param" | "query-param" | "none";
}

function normalizeModeInput(modeInput?: string | null): string | undefined {
  const normalized = modeInput?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function resolveWorkflowStudioModeRoute(input: {
  readonly routeModeId?: string;
  readonly search?: string;
}): WorkflowStudioModeRouteResolution {
  const routeModeId = normalizeModeInput(input.routeModeId);
  if (routeModeId) {
    if (isWorkflowStudioModeId(routeModeId)) {
      return Object.freeze({
        requestedModeId: routeModeId,
        source: "route-param",
      });
    }

    return Object.freeze({
      invalidModeId: routeModeId,
      source: "route-param",
    });
  }

  const queryModeId = normalizeModeInput(new URLSearchParams(input.search).get("mode"));
  if (!queryModeId) {
    return Object.freeze({
      source: "none",
    });
  }

  if (isWorkflowStudioModeId(queryModeId)) {
    return Object.freeze({
      requestedModeId: queryModeId,
      source: "query-param",
    });
  }

  return Object.freeze({
    invalidModeId: queryModeId,
    source: "query-param",
  });
}
