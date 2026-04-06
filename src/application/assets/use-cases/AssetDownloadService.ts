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
import { StorageLogicalAccessOperationIntents } from "../../storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import type { IStorageLogicalAccessResolutionService } from "../../storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import type { IWorkspaceAuthorizationReadRepository } from "../../workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type { AssetAuditSink } from "../ports/AssetAuditPort";
import type { IAssetDownloadGrantPort } from "../ports/AssetDownloadGrantPort";
import type { IAssetRepository } from "../ports/IAssetRepository";
import {
  AssetDownloadPurposes,
  AssetServiceErrorCodes,
  validateAuthorizeAssetDownloadRequest,
  validateOpenAuthorizedAssetDownloadStreamRequest,
  type AssetDownloadAuthorization,
  type AssetServiceResult,
  type AuthorizeAssetDownloadRequest,
  type OpenAuthorizedAssetDownloadStreamRequest,
  type OpenAuthorizedAssetDownloadStreamResult,
} from "./AssetServiceContracts";

export interface AssetDownloadServiceDependencies {
  readonly repository: IAssetRepository;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly storageLogicalAccessResolutionService: IStorageLogicalAccessResolutionService;
  readonly downloadGrantPort: IAssetDownloadGrantPort;
  readonly auditSink?: AssetAuditSink;
  readonly clock?: {
    now(): Date;
  };
}

export class AssetDownloadService {
  private readonly clock: { now(): Date };

  public constructor(private readonly dependencies: AssetDownloadServiceDependencies) {
    this.clock = dependencies.clock ?? { now: () => new Date() };
  }

  public async authorizeAssetDownload(
    input: AuthorizeAssetDownloadRequest,
  ): Promise<AssetServiceResult<AssetDownloadAuthorization>> {
    let request: AuthorizeAssetDownloadRequest;
    try {
      request = validateAuthorizeAssetDownloadRequest(input);
    } catch (error) {
      return this.failure(
        AssetServiceErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid request.",
      );
    }

    const occurredAt = request.occurredAt ?? this.clock.now().toISOString();
    const authorization = await this.resolveWorkspaceAuthorization(
      request.workspaceId,
      request.actorUserId,
      occurredAt,
    );
    if (!authorization.isAuthorized) {
      return this.failure(
        AssetServiceErrorCodes.accessDenied,
        "Asset download authorization requires active workspace membership.",
      );
    }

    const asset = await this.dependencies.repository.findAssetById(request.assetId);
    if (!asset || asset.ownership.workspaceId !== request.workspaceId) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
    }
    if (asset.lifecycle.state === AssetLifecycleStates.deleted) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
    }
    if (!this.canViewAsset(asset, request.actorUserId, authorization.isWorkspaceAdmin)) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
    }

    const targetVersion = resolveAssetVersion(asset, request.versionId);
    if (!targetVersion) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset version was not found.");
    }

    if (request.purpose === AssetDownloadPurposes.inlinePreview && !isPreviewableMimeType(targetVersion.content.mimeType)) {
      return this.failure(
        AssetServiceErrorCodes.invalidRequest,
        "Inline preview downloads require a preview-compatible content type.",
      );
    }
    if (request.purpose === AssetDownloadPurposes.workerProcess && !isWorkerProcessAllowedKind(asset.kind)) {
      return this.failure(
        AssetServiceErrorCodes.policyViolation,
        "Worker-process downloads are restricted for this asset kind.",
      );
    }

    const plan = await this.dependencies.storageLogicalAccessResolutionService.resolveLogicalAccessPlan({
      actorUserIdentityId: request.actorUserId,
      workspaceId: request.workspaceId,
      storageInstanceId: targetVersion.location.storageInstance.storageInstanceId,
      intent: StorageLogicalAccessOperationIntents.openObjectReadStream,
      occurredAt,
    });
    if (!plan.ok) {
      return this.failureFromLogicalAccessResolution(plan.error.code, plan.error.message, plan.error.details);
    }

    if (!isPurposeAllowedByStoragePolicy(plan.value.storageInstance, request.purpose)) {
      return this.failure(
        AssetServiceErrorCodes.policyViolation,
        "Storage security policy denies this download purpose.",
        Object.freeze({
          purpose: request.purpose,
          storageInstanceId: plan.value.storageInstance.id,
        }),
      );
    }

    const expiresInSeconds = clampDownloadExpirySeconds(request.expiresInSeconds);
    const contentDispositionFileName = request.fileNameHint
      || targetVersion.content.originalFileName
      || buildDefaultDownloadFileName(asset.id, targetVersion.versionId, targetVersion.content.mimeType);
    const grant = await this.dependencies.downloadGrantPort.issueDownloadGrant({
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      assetId: asset.id,
      versionId: targetVersion.versionId,
      storageInstanceId: targetVersion.location.storageInstance.storageInstanceId,
      objectKey: targetVersion.location.objectKey,
      objectVersionId: targetVersion.location.objectVersionId,
      area: targetVersion.location.area,
      mimeType: targetVersion.content.mimeType,
      sizeBytes: targetVersion.content.sizeBytes,
      contentDispositionFileName,
      purpose: request.purpose,
      expiresInSeconds,
      correlationId: request.correlationId,
      occurredAt,
    });

    await this.publishAuditEvent({
      type: "asset-download-authorized",
      occurredAt,
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      correlationId: request.correlationId,
      asset: {
        assetId: asset.id,
        kind: asset.kind,
        visibility: asset.visibility,
        lifecycleState: asset.lifecycle.state,
        versionId: targetVersion.versionId,
      },
      details: Object.freeze({
        purpose: request.purpose,
        expiresAt: grant.expiresAt,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        assetId: asset.id,
        versionId: targetVersion.versionId,
        workspaceId: request.workspaceId,
        storageInstanceId: targetVersion.location.storageInstance.storageInstanceId,
        objectKey: targetVersion.location.objectKey,
        objectVersionId: targetVersion.location.objectVersionId,
        mimeType: targetVersion.content.mimeType,
        sizeBytes: targetVersion.content.sizeBytes,
        contentToken: grant.contentToken,
        expiresAt: grant.expiresAt,
        contentDispositionFileName,
      }),
    };
  }

  public async openAuthorizedAssetDownloadStream(
    input: OpenAuthorizedAssetDownloadStreamRequest,
  ): Promise<AssetServiceResult<OpenAuthorizedAssetDownloadStreamResult>> {
    let request: OpenAuthorizedAssetDownloadStreamRequest;
    try {
      request = validateOpenAuthorizedAssetDownloadStreamRequest(input);
    } catch (error) {
      return this.failure(
        AssetServiceErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid request.",
      );
    }

    const occurredAt = request.occurredAt ?? this.clock.now().toISOString();
    const authorization = await this.resolveWorkspaceAuthorization(
      request.workspaceId,
      request.actorUserId,
      occurredAt,
    );
    if (!authorization.isAuthorized) {
      return this.failure(
        AssetServiceErrorCodes.accessDenied,
        "Asset download requires active workspace membership.",
      );
    }

    const grant = await this.dependencies.downloadGrantPort.resolveDownloadGrant({
      contentToken: request.contentToken,
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      assetId: request.assetId,
      occurredAt,
    });
    if (!grant) {
      return this.failure(
        AssetServiceErrorCodes.accessDenied,
        "Download authorization token is invalid or expired.",
      );
    }

    const asset = await this.dependencies.repository.findAssetById(grant.assetId);
    if (!asset || asset.ownership.workspaceId !== request.workspaceId) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
    }
    if (asset.lifecycle.state === AssetLifecycleStates.deleted) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
    }
    if (!this.canViewAsset(asset, request.actorUserId, authorization.isWorkspaceAdmin)) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
    }

    const targetVersion = resolveAssetVersion(asset, grant.versionId);
    if (!targetVersion) {
      return this.failure(AssetServiceErrorCodes.notFound, "Asset version was not found.");
    }

    const plan = await this.dependencies.storageLogicalAccessResolutionService.resolveLogicalAccessPlan({
      actorUserIdentityId: request.actorUserId,
      workspaceId: request.workspaceId,
      storageInstanceId: grant.storageInstanceId,
      intent: StorageLogicalAccessOperationIntents.openObjectReadStream,
      occurredAt,
    });
    if (!plan.ok) {
      return this.failureFromLogicalAccessResolution(plan.error.code, plan.error.message, plan.error.details);
    }
    if (!isPurposeAllowedByStoragePolicy(plan.value.storageInstance, grant.purpose)) {
      return this.failure(
        AssetServiceErrorCodes.policyViolation,
        "Storage security policy denies this download purpose.",
        Object.freeze({
          purpose: grant.purpose,
          storageInstanceId: plan.value.storageInstance.id,
        }),
      );
    }

    try {
      const stream = await plan.value.objectPort.openObjectReadStream({
        storageInstance: plan.value.storageInstance,
        objectKey: grant.objectKey,
      });

      const contentDisposition = grant.purpose === AssetDownloadPurposes.inlinePreview
        ? "inline"
        : "attachment";

      return {
        ok: true,
        value: Object.freeze({
          assetId: asset.id,
          versionId: targetVersion.versionId,
          mimeType: targetVersion.content.mimeType,
          sizeBytes: targetVersion.content.sizeBytes,
          contentDisposition,
          contentDispositionFileName: grant.contentDispositionFileName
            || targetVersion.content.originalFileName
            || undefined,
          stream,
        }),
      };
    } catch (error) {
      return this.failure(
        AssetServiceErrorCodes.contentUnavailable,
        error instanceof Error ? error.message : "Asset content stream is unavailable.",
      );
    }
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

  private failureFromLogicalAccessResolution(
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AssetServiceResult<never> {
    switch (code) {
      case "storage-logical-access-invalid-request":
        return this.failure(AssetServiceErrorCodes.invalidRequest, message, details);
      case "storage-logical-access-not-found":
        return this.failure(AssetServiceErrorCodes.notFound, message, details);
      case "storage-logical-access-policy-violation":
        return this.failure(AssetServiceErrorCodes.policyViolation, message, details);
      case "storage-logical-access-capability-unsupported":
        return this.failure(AssetServiceErrorCodes.invalidState, message, details);
      default:
        return this.failure(AssetServiceErrorCodes.internal, message, details);
    }
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

function isPreviewableMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return normalized.startsWith("image/")
    || normalized.startsWith("video/")
    || normalized.startsWith("audio/")
    || normalized.startsWith("text/")
    || normalized === "application/pdf";
}

function isWorkerProcessAllowedKind(kind: Asset["kind"]): boolean {
  return kind === AssetKinds.generatedOutput
    || kind === AssetKinds.derived
    || kind === AssetKinds.preview;
}

function isPurposeAllowedByStoragePolicy(
  storageInstance: { readonly policy: { readonly security: { readonly allowPreviewDecryption: boolean; readonly allowWorkerDecryption: boolean } } },
  purpose: typeof AssetDownloadPurposes[keyof typeof AssetDownloadPurposes],
): boolean {
  if (purpose === AssetDownloadPurposes.inlinePreview) {
    return storageInstance.policy.security.allowPreviewDecryption;
  }
  if (purpose === AssetDownloadPurposes.workerProcess) {
    return storageInstance.policy.security.allowWorkerDecryption;
  }
  return true;
}

function clampDownloadExpirySeconds(expiresInSeconds: number | undefined): number {
  const requested = expiresInSeconds ?? 300;
  return Math.min(Math.max(requested, 30), 3600);
}

function buildDefaultDownloadFileName(assetId: string, versionId: string, mimeType: string): string {
  const extension = resolveMimeTypeExtension(mimeType);
  return `${assetId}-${versionId}${extension}`;
}

function resolveMimeTypeExtension(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();
  switch (normalized) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    case "application/json":
      return ".json";
    case "text/plain":
      return ".txt";
    default:
      return "";
  }
}

