import {
  AssetLifecycleStates,
  AssetVisibilities,
  type Asset,
} from "../../../domain/assets/AssetDomain";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
} from "../../../domain/workspaces/WorkspaceDomain";
import type { IWorkspaceAuthorizationReadRepository } from "../../workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type { AssetAuditSink } from "../ports/AssetAuditPort";
import type { IAssetRepository } from "../ports/IAssetRepository";
import {
  AssetServiceErrorCodes,
  validateGetAssetByIdQuery,
  type AssetDetailMetadata,
  type AssetLineageHook,
  type AssetServiceResult,
  type GetAssetByIdQuery,
  type GetAssetByIdResult,
} from "./AssetServiceContracts";

interface AssetLineageReadRepository {
  listAssetLineage(assetId: string): Promise<ReadonlyArray<{
    readonly sourceAssetId: string;
    readonly sourceAssetVersionId?: string;
    readonly relation?: string;
  }>>;
}

export interface AssetDetailServiceDependencies {
  readonly repository: IAssetRepository;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly auditSink?: AssetAuditSink;
  readonly clock?: {
    now(): Date;
  };
}

export class AssetDetailService {
  private readonly clock: { now(): Date };

  public constructor(private readonly dependencies: AssetDetailServiceDependencies) {
    this.clock = dependencies.clock ?? { now: () => new Date() };
  }

  public async getAssetById(input: GetAssetByIdQuery): Promise<AssetServiceResult<GetAssetByIdResult>> {
    let query: GetAssetByIdQuery;
    try {
      query = validateGetAssetByIdQuery(input);
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
      return this.failure(
        AssetServiceErrorCodes.accessDenied,
        "Asset detail lookup requires active workspace membership.",
      );
    }

    const asset = await this.dependencies.repository.findAssetById(query.assetId);
    if (!asset || asset.ownership.workspaceId !== query.workspaceId) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
    }

    if (!query.includeDeleted && asset.lifecycle.state === AssetLifecycleStates.deleted) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
    }

    if (!this.canViewAsset(asset, query.actorUserId, authorization.isWorkspaceAdmin)) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
    }

    const metadata = await this.resolveAssetMetadata(
      asset,
      query.actorUserId,
      authorization.isWorkspaceAdmin,
      query.workspaceId,
    );
    await this.publishAuditEvent({
      type: "asset-looked-up",
      occurredAt: query.occurredAt ?? this.clock.now().toISOString(),
      workspaceId: query.workspaceId,
      actorUserId: query.actorUserId,
      correlationId: query.correlationId,
      asset: {
        assetId: asset.id,
        kind: asset.kind,
        visibility: asset.visibility,
        lifecycleState: asset.lifecycle.state,
        versionId: asset.currentVersionId,
      },
      details: Object.freeze({
        includeDeleted: query.includeDeleted ?? false,
        previewAvailable: metadata.previewAvailable,
        uploadState: metadata.uploadState,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        asset,
        metadata,
      }),
    };
  }

  private async resolveAssetMetadata(
    asset: Asset,
    actorUserId: string,
    isWorkspaceAdmin: boolean,
    workspaceId: string,
  ): Promise<AssetDetailMetadata> {
    const isOwnedByActor = asset.ownership.ownerUserId === actorUserId;
    const canMutateLifecycle = isOwnedByActor || isWorkspaceAdmin;
    const lifecycleState = asset.lifecycle.state;
    const lineage = await this.resolveAssetLineage(asset.id);

    return Object.freeze({
      isOwnedByActor,
      uploadState: mapUploadState(lifecycleState),
      previewAvailable: isPreviewMimeType(asset),
      previewMimeTypeHint: isPreviewMimeType(asset) ? asset.versions[asset.versions.length - 1]?.content.mimeType : undefined,
      allowedActions: Object.freeze({
        canInitiateUpload: lifecycleState === AssetLifecycleStates.active && canMutateLifecycle,
        canAuthorizeDownload: lifecycleState !== AssetLifecycleStates.deleted,
        canResolvePreview: lifecycleState !== AssetLifecycleStates.deleted,
        canArchive: lifecycleState === AssetLifecycleStates.active && canMutateLifecycle,
        canDelete: lifecycleState !== AssetLifecycleStates.deleted && canMutateLifecycle,
      }),
      links: Object.freeze({
        self: `/api/v1/assets/${encodeURIComponent(asset.id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
        list: `/api/v1/assets?workspaceId=${encodeURIComponent(workspaceId)}`,
        initiateUpload: `/api/v1/assets/${encodeURIComponent(asset.id)}/uploads/initiate?workspaceId=${encodeURIComponent(workspaceId)}`,
        authorizeDownload: `/api/v1/assets/${encodeURIComponent(asset.id)}/downloads/authorize?workspaceId=${encodeURIComponent(workspaceId)}`,
        resolvePreview: `/api/v1/assets/${encodeURIComponent(asset.id)}/preview?workspaceId=${encodeURIComponent(workspaceId)}`,
        listGeneratedOutputsBySource: `/api/v1/assets?workspaceId=${encodeURIComponent(workspaceId)}&sourceAssetId=${encodeURIComponent(asset.id)}`,
      }),
      lineage: Object.freeze({
        sources: lineage,
      }),
    });
  }

  private canViewAsset(asset: Asset, actorUserId: string, isWorkspaceAdmin: boolean): boolean {
    if (asset.visibility === AssetVisibilities.private) {
      return asset.ownership.ownerUserId === actorUserId || isWorkspaceAdmin;
    }
    return true;
  }

  private async resolveAssetLineage(assetId: string): Promise<ReadonlyArray<AssetLineageHook>> {
    const lineageRepository = this.dependencies.repository as IAssetRepository & Partial<AssetLineageReadRepository>;
    if (typeof lineageRepository.listAssetLineage !== "function") {
      return Object.freeze([]);
    }

    const links = await lineageRepository.listAssetLineage(assetId);
    return Object.freeze(links.map((entry) => Object.freeze({
      sourceAssetId: entry.sourceAssetId,
      sourceAssetVersionId: entry.sourceAssetVersionId,
      relation: entry.relation,
    })));
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
    if (!this.dependencies.auditSink) {
      return;
    }
    try {
      await this.dependencies.auditSink.recordAssetEvent(event);
    } catch {
      // best effort
    }
  }
}

function mapUploadState(
  state: Asset["lifecycle"]["state"],
): "ready" | "archived" | "deleted" {
  if (state === AssetLifecycleStates.archived) {
    return "archived";
  }
  if (state === AssetLifecycleStates.deleted) {
    return "deleted";
  }
  return "ready";
}

function isPreviewMimeType(asset: Asset): boolean {
  const current = asset.versions.find((version) => version.versionId === asset.currentVersionId);
  if (!current) {
    return false;
  }
  const mimeType = current.content.mimeType.toLowerCase();
  return mimeType.startsWith("image/")
    || mimeType.startsWith("video/")
    || mimeType.startsWith("audio/")
    || mimeType.startsWith("text/")
    || mimeType === "application/pdf";
}

