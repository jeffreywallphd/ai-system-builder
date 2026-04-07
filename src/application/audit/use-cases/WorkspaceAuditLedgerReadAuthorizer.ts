import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import { AuditEventThinSafeCategories } from "@shared/contracts/audit/AuditEventContracts";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type {
  AuditLedgerQueryAuthorizer,
  AuditLedgerQueryReadScope,
} from "./AuditLedgerQueryService";
import type { AuditLedgerListQueryDto } from "@shared/dto/audit/AuditEventDtos";

export interface WorkspaceAuditLedgerReadAuthorizerDependencies {
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly clock?: {
    now(): Date;
  };
}

export class WorkspaceAuditLedgerReadAuthorizer implements AuditLedgerQueryAuthorizer {
  private readonly clock: { now(): Date };

  public constructor(private readonly dependencies: WorkspaceAuditLedgerReadAuthorizerDependencies) {
    this.clock = dependencies.clock ?? { now: () => new Date() };
  }

  public async authorizeAuditLedgerRead(input: {
    readonly requesterId: string;
    readonly query: AuditLedgerListQueryDto;
  }): Promise<{
    readonly allowed: boolean;
    readonly scope?: AuditLedgerQueryReadScope;
    readonly reason?: string;
  }> {
    const requesterId = normalizeOptionalString(input.requesterId);
    if (!requesterId) {
      return deny("requesterId is required.");
    }

    const workspaceIds = collectRequestedWorkspaceIds(input.query);
    if (workspaceIds.length !== 1) {
      return deny("Audit ledger reads require exactly one workspace scope.");
    }
    const workspaceId = workspaceIds[0];

    const snapshot = await this.dependencies.workspaceAuthorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: requesterId,
      asOf: this.clock.now().toISOString(),
    });

    if (!snapshot) {
      return deny("Requester is not authorized for workspace audit access.");
    }

    const isActiveMember = snapshot.isWorkspaceOwner
      || snapshot.membership?.status === WorkspaceMembershipStatuses.active;
    if (!isActiveMember) {
      return deny("Requester must have active workspace membership.");
    }

    const isWorkspaceAdmin = snapshot.isWorkspaceOwner
      || snapshot.effectiveRoles.includes(WorkspaceRoles.owner)
      || snapshot.effectiveRoles.includes(WorkspaceRoles.admin);
    if (isWorkspaceAdmin) {
      return allow({
        workspaceIds: [workspaceId],
        canReadProtectedData: true,
        detailVisibility: "admin",
      });
    }

    return allow({
      workspaceIds: [workspaceId],
      enforceThinSafeOnly: true,
      canReadProtectedData: false,
      allowedCategories: AuditEventThinSafeCategories,
      detailVisibility: "user-safe",
    });
  }
}

function collectRequestedWorkspaceIds(query: AuditLedgerListQueryDto): ReadonlyArray<string> {
  const normalized = new Set<string>();
  const queryWorkspaceId = normalizeOptionalString(query.workspaceId);
  if (queryWorkspaceId) {
    normalized.add(queryWorkspaceId);
  }

  for (const workspaceId of query.filters?.workspaceIds ?? []) {
    const value = normalizeOptionalString(workspaceId);
    if (value) {
      normalized.add(value);
    }
  }

  return Object.freeze([...normalized]);
}

function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function deny(reason: string): {
  readonly allowed: false;
  readonly reason: string;
} {
  return Object.freeze({
    allowed: false,
    reason,
  });
}

function allow(scope: AuditLedgerQueryReadScope): {
  readonly allowed: true;
  readonly scope: AuditLedgerQueryReadScope;
} {
  return Object.freeze({
    allowed: true,
    scope: Object.freeze(scope),
  });
}
