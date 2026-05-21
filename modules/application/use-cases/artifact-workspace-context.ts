import { createContractError, createFailureResult, type ContractResult } from "../../contracts/shared";
import { isWorkspaceId, type WorkspaceId } from "../../contracts/workspace";
import type { ApplicationRequestContext } from "../ports";
import type { WorkspaceRepository } from "../ports/workspace";

export type ArtifactWorkspaceFailureCode = "validation" | "not-found" | "unavailable";

export async function resolveArtifactWorkspaceContext(
  context: ApplicationRequestContext | undefined,
  workspaceRepository?: Pick<WorkspaceRepository, "readWorkspace">,
): Promise<ContractResult<{ workspaceId: WorkspaceId }>> {
  const requestContext = {
    requestId: context?.requestId,
    correlationId: context?.correlationId,
    workspaceId: context?.workspaceId,
  };

  if (context?.workspaceId === undefined || context.workspaceId === null || context.workspaceId === "") {
    return createFailureResult(
      createContractError("validation", "Workspace id is required for artifact operations.", {
        ...requestContext,
        details: { code: "workspace-required" },
      }),
      requestContext,
    );
  }

  if (!isWorkspaceId(context.workspaceId)) {
    return createFailureResult(
      createContractError("validation", "Workspace id is invalid for artifact operations.", {
        ...requestContext,
        details: { code: "workspace-invalid" },
      }),
      requestContext,
    );
  }

  if (workspaceRepository) {
    const workspace = await workspaceRepository.readWorkspace(context.workspaceId);
    if (!workspace) {
      return createFailureResult(
        createContractError("not-found", "Workspace was not found for artifact operations.", {
          ...requestContext,
          details: { code: "workspace-not-found" },
        }),
        requestContext,
      );
    }
    if (workspace.status !== "active") {
      return createFailureResult(
        createContractError("unavailable", "Workspace is unavailable for artifact operations.", {
          ...requestContext,
          details: { code: "workspace-unavailable" },
        }),
        requestContext,
      );
    }
  }

  return { ok: true, value: { workspaceId: context.workspaceId }, ...requestContext };
}
