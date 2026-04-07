import type { WorkspaceOwnershipMetadata, WorkspaceVisibility } from "../../shared/workspaces/WorkspaceOwnership";
import {
  createWorkspaceOwnershipMetadata,
  rehydrateWorkspaceOwnershipMetadata,
  WorkspaceOwnershipError,
} from "../../shared/workspaces/WorkspaceOwnership";
import type { WorkflowPersistenceOwnershipContext } from "../../domain/workflow-studio/WorkflowPersistenceDomain";
import { WorkflowPersistenceInvalidRequestError } from "./WorkflowPersistenceErrors";

export interface ProtectedResourceActorContext {
  readonly actorUserId?: string;
}

export interface WorkspaceScopingInput {
  readonly workspaceId?: string;
  readonly ownerUserId?: string;
  readonly visibility?: WorkspaceVisibility;
}

export interface WorkflowWorkspaceScopingRequest {
  readonly ownershipContext?: WorkflowPersistenceOwnershipContext;
  readonly actorContext?: ProtectedResourceActorContext;
  readonly workspace?: WorkspaceScopingInput;
  readonly now?: Date;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveConsistentWorkspaceId(input: {
  readonly fromOwnershipWorkspaceId?: string;
  readonly fromWorkspaceOwnership?: string;
  readonly fromWorkspaceInput?: string;
  readonly fromTenantId?: string;
}): string | undefined {
  const candidates = [
    input.fromWorkspaceInput,
    input.fromOwnershipWorkspaceId,
    input.fromWorkspaceOwnership,
    input.fromTenantId,
  ].filter((value): value is string => Boolean(value));
  if (candidates.length === 0) {
    return undefined;
  }

  const first = candidates[0]!;
  if (candidates.some((value) => value !== first)) {
    throw new WorkflowPersistenceInvalidRequestError(
      "Workspace scoping inputs are inconsistent: workspaceId, ownership workspaceId, and tenantId must match.",
    );
  }
  return first;
}

function assertOwnerMatchesWorkspaceOwnership(input: {
  readonly ownerId?: string;
  readonly workspaceOwnerId: string;
}): void {
  if (input.ownerId && input.ownerId !== input.workspaceOwnerId) {
    throw new WorkflowPersistenceInvalidRequestError(
      "ownershipContext.ownerId must match ownershipContext.workspaceOwnership.ownerUserId when both are provided.",
    );
  }
}

export function resolveWorkflowWorkspaceScoping(
  input: WorkflowWorkspaceScopingRequest,
): WorkflowPersistenceOwnershipContext | undefined {
  try {
    const ownershipContext = input.ownershipContext;
    const ownerId = normalizeOptional(ownershipContext?.ownerId);
    const tenantId = normalizeOptional(ownershipContext?.tenantId);
    const studioId = normalizeOptional(ownershipContext?.studioId);
    const sessionId = normalizeOptional(ownershipContext?.sessionId);
    const workspaceIdFromOwnership = normalizeOptional(ownershipContext?.workspaceId);
    const workspaceIdFromRequest = normalizeOptional(input.workspace?.workspaceId);
    const actorUserId = normalizeOptional(input.actorContext?.actorUserId);
    const workspaceOwnerIdFromRequest = normalizeOptional(input.workspace?.ownerUserId);
    const workspaceOwnershipFromContext = ownershipContext?.workspaceOwnership
      ? rehydrateWorkspaceOwnershipMetadata(ownershipContext.workspaceOwnership)
      : undefined;
    const workspaceId = resolveConsistentWorkspaceId({
      fromOwnershipWorkspaceId: workspaceIdFromOwnership,
      fromWorkspaceOwnership: workspaceOwnershipFromContext?.workspaceId,
      fromWorkspaceInput: workspaceIdFromRequest,
      fromTenantId: tenantId,
    });

    let workspaceOwnership: WorkspaceOwnershipMetadata | undefined = workspaceOwnershipFromContext;
    const workspaceOwnerId = workspaceOwnerIdFromRequest ?? workspaceOwnershipFromContext?.ownerUserId ?? ownerId ?? actorUserId;
    if (workspaceId && workspaceOwnerId) {
      const requestedVisibility = input.workspace?.visibility ?? workspaceOwnershipFromContext?.visibility;
      workspaceOwnership = workspaceOwnershipFromContext
        && workspaceOwnershipFromContext.workspaceId === workspaceId
        && workspaceOwnershipFromContext.ownerUserId === workspaceOwnerId
        && (!requestedVisibility || workspaceOwnershipFromContext.visibility === requestedVisibility)
        ? workspaceOwnershipFromContext
        : createWorkspaceOwnershipMetadata({
          workspaceId,
          ownerUserId: workspaceOwnerId,
          visibility: requestedVisibility,
          createdBy: workspaceOwnerId,
          now: input.now,
        });
    }

    if (workspaceOwnership) {
      assertOwnerMatchesWorkspaceOwnership({
        ownerId,
        workspaceOwnerId: workspaceOwnership.ownerUserId,
      });
    }

    const resolvedOwnerId = ownerId ?? workspaceOwnership?.ownerUserId ?? workspaceOwnerId;
    const resolvedTenantId = tenantId ?? workspaceId;
    const resolvedWorkspaceId = workspaceId ?? workspaceOwnership?.workspaceId;

    if (!resolvedOwnerId && !resolvedTenantId && !studioId && !sessionId && !resolvedWorkspaceId && !workspaceOwnership) {
      return undefined;
    }

    return Object.freeze({
      ownerId: resolvedOwnerId,
      tenantId: resolvedTenantId,
      studioId,
      sessionId,
      workspaceId: resolvedWorkspaceId,
      workspaceOwnership,
    });
  } catch (error) {
    if (error instanceof WorkflowPersistenceInvalidRequestError) {
      throw error;
    }
    if (error instanceof WorkspaceOwnershipError || error instanceof Error) {
      throw new WorkflowPersistenceInvalidRequestError(error.message);
    }
    throw new WorkflowPersistenceInvalidRequestError("Invalid workspace scoping input.");
  }
}

