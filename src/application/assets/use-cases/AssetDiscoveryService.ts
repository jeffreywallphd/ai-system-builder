import {
  AssetLifecycleStates,
  AssetVisibilities,
  type Asset,
} from "@domain/assets/AssetDomain";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
} from "@domain/workspaces/WorkspaceDomain";
import type { IWorkspaceAuthorizationReadRepository } from "../../workspaces/ports/IWorkspaceAuthorizationReadRepository";
import {
  publishAssetAuditEventBestEffort,
  type AssetAuditSink,
} from "../ports/AssetAuditPort";
import type { IAssetRepository } from "../ports/IAssetRepository";
import {
  AssetServiceErrorCodes,
  validateListAssetsQuery,
  type AssetServiceResult,
  type ListAssetsQuery,
  type ListAssetsResult,
} from "./AssetServiceContracts";

export interface AssetDiscoveryServiceDependencies {
  readonly repository: IAssetRepository;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly auditSink?: AssetAuditSink;
  readonly clock?: {
    now(): Date;
  };
}

const DefaultListLimit = 25;
const MaxListLimit = 100;

export class AssetDiscoveryService {
  private readonly clock: { now(): Date };

  public constructor(private readonly dependencies: AssetDiscoveryServiceDependencies) {
    this.clock = dependencies.clock ?? { now: () => new Date() };
  }

  public async listAssets(input: ListAssetsQuery): Promise<AssetServiceResult<ListAssetsResult>> {
    let query: ListAssetsQuery;
    try {
      query = validateListAssetsQuery(input);
    } catch (error) {
      return this.failure(
        AssetServiceErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid request.",
      );
    }

    const authorization = await this.resolveWorkspaceAuthorization(
      query.workspaceId,
      query.actorUserId,
      query.occurredAt,
    );
    if (!authorization.isAuthorized) {
      return this.failure(AssetServiceErrorCodes.accessDenied, "Asset listing requires active workspace membership.");
    }

    const limit = clampLimit(query.limit);
    const offset = query.offset ?? 0;
    const targetVisibleCount = offset + limit + 1;
    const batchSize = clampLimit(Math.max(limit * 2, 50));
    let rawOffset = 0;
    const visible: Asset[] = [];

    while (visible.length < targetVisibleCount) {
      const batch = await this.dependencies.repository.listAssets(Object.freeze({
        workspaceId: query.workspaceId,
        ownerUserId: query.ownerUserId,
        createdByUserId: query.createdByUserId,
        storageInstanceId: query.storageInstanceId,
        assetKinds: query.assetKinds,
        visibilities: resolveVisibilityFilter(query.scope, query.actorUserId),
        lifecycleStates: query.lifecycleStates ?? Object.freeze([
          AssetLifecycleStates.active,
          AssetLifecycleStates.archived,
        ]),
        sourceAssetId: query.sourceAssetId,
        sourceAssetVersionId: query.sourceAssetVersionId,
        limit: batchSize,
        offset: rawOffset,
      }));
      if (batch.length < 1) {
        break;
      }

      rawOffset += batch.length;
      for (const asset of batch) {
        if (this.canViewAsset(asset, query.actorUserId, authorization.isWorkspaceAdmin)) {
          visible.push(asset);
        }
      }

      if (batch.length < batchSize) {
        break;
      }
    }

    const page = Object.freeze(visible.slice(offset, offset + limit));
    const hasMore = visible.length > (offset + limit);

    await this.publishAuditEvent({
      type: "asset-listed",
      occurredAt: query.occurredAt ?? this.clock.now().toISOString(),
      workspaceId: query.workspaceId,
      actorUserId: query.actorUserId,
      correlationId: query.correlationId,
      outcome: "success",
      asset: {
        assetId: "asset-list",
      },
      details: Object.freeze({
        scope: query.scope ?? "all",
        ownerUserId: query.ownerUserId,
        createdByUserId: query.createdByUserId,
        storageInstanceId: query.storageInstanceId,
        sourceAssetId: query.sourceAssetId,
        sourceAssetVersionId: query.sourceAssetVersionId,
        limit,
        offset,
        returned: page.length,
        hasMore,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        items: page,
        pagination: Object.freeze({
          limit,
          offset,
          returned: page.length,
          hasMore,
        }),
      }),
    };
  }

  private canViewAsset(asset: Asset, actorUserId: string, isWorkspaceAdmin: boolean): boolean {
    if (asset.lifecycle.state === AssetLifecycleStates.deleted) {
      return false;
    }
    if (asset.visibility === AssetVisibilities.private) {
      return asset.ownership.ownerUserId === actorUserId || isWorkspaceAdmin;
    }
    return true;
  }

  private async resolveWorkspaceAuthorization(
    workspaceId: string,
    actorUserIdentityId: string,
    occurredAt?: string,
  ): Promise<{ readonly isAuthorized: boolean; readonly isWorkspaceAdmin: boolean }> {
    const snapshot = await this.dependencies.workspaceAuthorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: occurredAt,
    });
    if (!snapshot) {
      return Object.freeze({ isAuthorized: false, isWorkspaceAdmin: false });
    }

    const isActiveMember = snapshot.isWorkspaceOwner
      || snapshot.membership?.status === WorkspaceMembershipStatuses.active;
    const isWorkspaceAdmin = snapshot.isWorkspaceOwner
      || snapshot.effectiveRoles.includes(WorkspaceRoles.owner)
      || snapshot.effectiveRoles.includes(WorkspaceRoles.admin);
    return Object.freeze({
      isAuthorized: isActiveMember,
      isWorkspaceAdmin,
    });
  }

  private failure(
    code: typeof AssetServiceErrorCodes[keyof typeof AssetServiceErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AssetServiceResult<never> {
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        details,
      }),
    };
  }

  private async publishAuditEvent(event: Parameters<AssetAuditSink["recordAssetEvent"]>[0]): Promise<void> {
    await publishAssetAuditEventBestEffort(this.dependencies.auditSink, event);
  }
}

function clampLimit(limit: number | undefined): number {
  if (Number.isInteger(limit) && (limit as number) > 0) {
    return Math.min(limit as number, MaxListLimit);
  }
  return DefaultListLimit;
}

function resolveVisibilityFilter(
  scope: ListAssetsQuery["scope"] | undefined,
  actorUserId: string,
): ReadonlyArray<(typeof AssetVisibilities)[keyof typeof AssetVisibilities]> | undefined {
  switch (scope) {
    case "private":
      return Object.freeze([AssetVisibilities.private]);
    case "workspace":
      return Object.freeze([
        AssetVisibilities.workspace,
        AssetVisibilities.shared,
        AssetVisibilities.published,
      ]);
    case "all":
      return Object.freeze([
        AssetVisibilities.private,
        AssetVisibilities.workspace,
        AssetVisibilities.shared,
        AssetVisibilities.published,
      ]);
    default:
      return actorUserId ? undefined : Object.freeze([
        AssetVisibilities.workspace,
        AssetVisibilities.shared,
        AssetVisibilities.published,
      ]);
  }
}

