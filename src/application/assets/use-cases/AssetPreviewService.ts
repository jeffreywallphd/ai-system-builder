import {
  AssetKinds,
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
import type { IAssetPreviewPort } from "../ports/AssetPreviewPort";
import type { IAssetRepository } from "../ports/IAssetRepository";
import {
  AssetServiceErrorCodes,
  validateResolveAssetPreviewQuery,
  type AssetPreviewResolution,
  type AssetServiceResult,
  type ResolveAssetPreviewQuery,
} from "./AssetServiceContracts";

export interface AssetPreviewServiceDependencies {
  readonly repository: IAssetRepository;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly previewPort?: IAssetPreviewPort;
  readonly auditSink?: AssetAuditSink;
  readonly clock?: {
    now(): Date;
  };
}

const PREVIEWABLE_MIME_PREFIXES = Object.freeze(["image/", "video/", "audio/", "text/"]);

export class AssetPreviewService {
  private readonly clock: { now(): Date };

  public constructor(private readonly dependencies: AssetPreviewServiceDependencies) {
    this.clock = dependencies.clock ?? { now: () => new Date() };
  }

  public async resolveAssetPreview(
    input: ResolveAssetPreviewQuery,
  ): Promise<AssetServiceResult<AssetPreviewResolution>> {
    let query: ResolveAssetPreviewQuery;
    try {
      query = validateResolveAssetPreviewQuery(input);
    } catch (error) {
      return this.failure(
        AssetServiceErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid request.",
      );
    }

    const occurredAt = query.occurredAt ?? this.clock.now().toISOString();
    const authorization = await this.resolveWorkspaceAuthorization(
      query.workspaceId,
      query.actorUserId,
      occurredAt,
    );
    if (!authorization.isAuthorized) {
      return this.failure(
        AssetServiceErrorCodes.accessDenied,
        "Asset preview lookup requires active workspace membership.",
      );
    }

    const sourceAsset = await this.dependencies.repository.findAssetById(query.assetId);
    if (!sourceAsset || sourceAsset.ownership.workspaceId !== query.workspaceId) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
    }
    if (sourceAsset.lifecycle.state === AssetLifecycleStates.deleted) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
    }
    if (!this.canViewAsset(sourceAsset, query.actorUserId, authorization.isWorkspaceAdmin)) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
    }

    const sourceVersion = resolveAssetVersion(sourceAsset, query.versionId);
    if (!sourceVersion) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset version was not found.");
    }

    const preferredMimeTypes = normalizePreferredMimeTypes(query.preferredMimeTypes);
    const derivedPreview = await this.resolveDerivedPreviewAsset({
      sourceAsset,
      sourceVersionId: sourceVersion.versionId,
      actorUserId: query.actorUserId,
      isWorkspaceAdmin: authorization.isWorkspaceAdmin,
      preferredMimeTypes,
    });

    const resolved = derivedPreview
      ?? await this.resolvePreviewPortCandidate({
        sourceAsset,
        sourceVersionId: sourceVersion.versionId,
        actorUserId: query.actorUserId,
        isWorkspaceAdmin: authorization.isWorkspaceAdmin,
        workspaceId: query.workspaceId,
        occurredAt,
        preferredMimeTypes,
      })
      ?? buildInlinePreviewResolution(sourceAsset, sourceVersion);

    if (!resolved) {
      return this.failure(AssetServiceErrorCodes.notFound, "No preview is available for the requested asset.");
    }

    await this.publishAuditEvent({
      type: "asset-preview-resolved",
      occurredAt,
      workspaceId: query.workspaceId,
      actorUserId: query.actorUserId,
      correlationId: query.correlationId,
      asset: {
        assetId: sourceAsset.id,
        kind: sourceAsset.kind,
        visibility: sourceAsset.visibility,
        lifecycleState: sourceAsset.lifecycle.state,
        versionId: sourceVersion.versionId,
      },
      details: Object.freeze({
        previewAssetId: resolved.previewAssetId,
        previewVersionId: resolved.previewVersionId,
        previewMimeType: resolved.previewMimeType,
      }),
    });

    return {
      ok: true,
      value: resolved,
    };
  }

  private async resolveDerivedPreviewAsset(input: {
    readonly sourceAsset: Asset;
    readonly sourceVersionId: string;
    readonly actorUserId: string;
    readonly isWorkspaceAdmin: boolean;
    readonly preferredMimeTypes: ReadonlyArray<string>;
  }): Promise<AssetPreviewResolution | undefined> {
    const candidates = await this.dependencies.repository.listAssets({
      workspaceId: input.sourceAsset.ownership.workspaceId,
      sourceAssetId: input.sourceAsset.id,
      sourceAssetVersionId: input.sourceVersionId,
      assetKinds: [AssetKinds.preview, AssetKinds.derived],
      lifecycleStates: [AssetLifecycleStates.active],
    });

    const visibleCandidates = candidates.filter((asset) => (
      asset.lifecycle.state === AssetLifecycleStates.active
      && this.canViewAsset(asset, input.actorUserId, input.isWorkspaceAdmin)
    ));

    const resolved = selectPreviewCandidate(visibleCandidates, input.preferredMimeTypes);
    if (!resolved) {
      return undefined;
    }

    return Object.freeze({
      assetId: input.sourceAsset.id,
      versionId: input.sourceVersionId,
      previewAssetId: resolved.asset.id,
      previewVersionId: resolved.version.versionId,
      previewMimeType: resolved.version.content.mimeType,
      previewStorageInstanceId: resolved.version.location.storageInstance.storageInstanceId,
      previewObjectKey: resolved.version.location.objectKey,
    });
  }

  private async resolvePreviewPortCandidate(input: {
    readonly sourceAsset: Asset;
    readonly sourceVersionId: string;
    readonly actorUserId: string;
    readonly isWorkspaceAdmin: boolean;
    readonly workspaceId: string;
    readonly occurredAt: string;
    readonly preferredMimeTypes: ReadonlyArray<string>;
  }): Promise<AssetPreviewResolution | undefined> {
    if (!this.dependencies.previewPort) {
      return undefined;
    }

    const candidate = await this.dependencies.previewPort.resolvePreviewForAsset({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      assetId: input.sourceAsset.id,
      versionId: input.sourceVersionId,
      preferredMimeTypes: input.preferredMimeTypes,
      occurredAt: input.occurredAt,
    });
    if (!candidate) {
      return undefined;
    }

    const previewAsset = await this.dependencies.repository.findAssetById(candidate.assetId);
    if (!previewAsset) {
      return undefined;
    }
    if (previewAsset.ownership.workspaceId !== input.workspaceId) {
      return undefined;
    }
    if (previewAsset.lifecycle.state === AssetLifecycleStates.deleted) {
      return undefined;
    }
    if (
      previewAsset.kind !== AssetKinds.preview
      && previewAsset.kind !== AssetKinds.derived
    ) {
      return undefined;
    }
    if (!this.canViewAsset(previewAsset, input.actorUserId, input.isWorkspaceAdmin)) {
      return undefined;
    }

    const previewVersion = previewAsset.versions.find((version) => version.versionId === candidate.versionId);
    if (!previewVersion) {
      return undefined;
    }

    if (
      input.preferredMimeTypes.length > 0
      && !input.preferredMimeTypes.includes(previewVersion.content.mimeType.toLowerCase())
    ) {
      return undefined;
    }

    return Object.freeze({
      assetId: input.sourceAsset.id,
      versionId: input.sourceVersionId,
      previewAssetId: previewAsset.id,
      previewVersionId: previewVersion.versionId,
      previewMimeType: previewVersion.content.mimeType,
      previewStorageInstanceId: previewVersion.location.storageInstance.storageInstanceId,
      previewObjectKey: previewVersion.location.objectKey,
    });
  }

  private canViewAsset(asset: Asset, actorUserId: string, isWorkspaceAdmin: boolean): boolean {
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

function resolveAssetVersion(asset: Asset, versionId: string | undefined): Asset["versions"][number] | undefined {
  const resolvedVersionId = versionId?.trim() || asset.currentVersionId;
  return asset.versions.find((entry) => entry.versionId === resolvedVersionId);
}

function normalizePreferredMimeTypes(
  preferredMimeTypes: ReadonlyArray<string> | undefined,
): ReadonlyArray<string> {
  if (!preferredMimeTypes || preferredMimeTypes.length < 1) {
    return Object.freeze([]);
  }
  return Object.freeze(preferredMimeTypes.map((value) => value.toLowerCase()));
}

function buildInlinePreviewResolution(
  sourceAsset: Asset,
  sourceVersion: Asset["versions"][number],
): AssetPreviewResolution | undefined {
  if (!isPreviewableMimeType(sourceVersion.content.mimeType)) {
    return undefined;
  }

  return Object.freeze({
    assetId: sourceAsset.id,
    versionId: sourceVersion.versionId,
    previewAssetId: sourceAsset.id,
    previewVersionId: sourceVersion.versionId,
    previewMimeType: sourceVersion.content.mimeType,
    previewStorageInstanceId: sourceVersion.location.storageInstance.storageInstanceId,
    previewObjectKey: sourceVersion.location.objectKey,
  });
}

function selectPreviewCandidate(
  candidates: ReadonlyArray<Asset>,
  preferredMimeTypes: ReadonlyArray<string>,
): { readonly asset: Asset; readonly version: Asset["versions"][number] } | undefined {
  const normalizedPreferred = preferredMimeTypes.map((value) => value.toLowerCase());

  let selected:
    | { readonly asset: Asset; readonly version: Asset["versions"][number]; readonly rank: number }
    | undefined;

  for (const candidate of candidates) {
    const currentVersion = resolveAssetVersion(candidate, undefined);
    if (!currentVersion) {
      continue;
    }

    const mimeType = currentVersion.content.mimeType.toLowerCase();
    if (!isPreviewableMimeType(mimeType)) {
      continue;
    }

    const preferredIndex = normalizedPreferred.indexOf(mimeType);
    const mimeRank = preferredIndex >= 0 ? preferredIndex : normalizedPreferred.length;
    const kindRank = candidate.kind === AssetKinds.preview ? 0 : 1;
    const rank = (mimeRank * 10) + kindRank;

    if (!selected || rank < selected.rank) {
      selected = {
        asset: candidate,
        version: currentVersion,
        rank,
      };
    }
  }

  return selected
    ? Object.freeze({
      asset: selected.asset,
      version: selected.version,
    })
    : undefined;
}

function isPreviewableMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "application/pdf") {
    return true;
  }
  return PREVIEWABLE_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
