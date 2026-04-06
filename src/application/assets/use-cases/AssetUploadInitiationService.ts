import { randomUUID } from "node:crypto";
import {
  AssetDomainError,
  AssetLifecycleStates,
  AssetVisibilities,
  createAsset,
  createAssetLocationRef,
  createAssetOwnershipMetadata,
  createAssetVersion,
  createContentDescriptor,
  createStorageInstanceRef,
} from "../../../domain/assets/AssetDomain";
import {
  StorageAccessModes,
  StorageLifecycleStates,
  type StorageInstance,
} from "../../../domain/storage/StorageDomain";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
} from "../../../domain/workspaces/WorkspaceDomain";
import type { IStorageInstanceRepository } from "../../storage/ports/IStorageInstanceRepository";
import {
  StoragePolicyActions,
  type IStoragePolicyEvaluationPort,
} from "../../storage/ports/StoragePolicyEvaluationPort";
import type { IWorkspaceAuthorizationReadRepository } from "../../workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type { IAssetRepository } from "../ports/IAssetRepository";
import type { AssetAuditSink } from "../ports/AssetAuditPort";
import {
  AssetServiceErrorCodes,
  validateBeginAssetUploadRequest,
  validateRegisterAssetRequest,
  type BeginAssetUploadRequest,
  type BeginAssetUploadResult,
  type RegisterAssetRequest,
  type RegisterAssetResult,
  type AssetServiceResult,
} from "./AssetServiceContracts";

export interface AssetUploadInitiationServiceDependencies {
  readonly repository: IAssetRepository;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly storageInstanceRepository: IStorageInstanceRepository;
  readonly storagePolicyEvaluationPort: IStoragePolicyEvaluationPort;
  readonly auditSink?: AssetAuditSink;
  readonly clock?: {
    now(): Date;
  };
  readonly idGenerator?: {
    nextId(): string;
  };
}

export class AssetUploadInitiationService {
  private readonly clock: { now(): Date };

  private readonly idGenerator: { nextId(): string };

  public constructor(private readonly dependencies: AssetUploadInitiationServiceDependencies) {
    this.clock = dependencies.clock ?? { now: () => new Date() };
    this.idGenerator = dependencies.idGenerator ?? { nextId: () => randomUUID() };
  }

  public async registerAsset(
    input: RegisterAssetRequest,
  ): Promise<AssetServiceResult<RegisterAssetResult>> {
    let request: RegisterAssetRequest;
    try {
      request = validateRegisterAssetRequest(input);
    } catch (error) {
      return this.invalidRequest(error);
    }

    try {
      const authorization = await this.resolveWorkspaceAuthorization(
        request.workspaceId,
        request.actorUserId,
        request.occurredAt,
      );
      if (!authorization.isAuthorized) {
        return this.failure(AssetServiceErrorCodes.accessDenied, "Asset registration requires active workspace membership.");
      }

      const ownerUserId = request.ownerUserId ?? request.actorUserId;
      if (
        ownerUserId !== request.actorUserId
        && !authorization.isWorkspaceAdmin
      ) {
        return this.failure(AssetServiceErrorCodes.accessDenied, "Only workspace administrators can register assets for another owner.");
      }

      const storageInstance = await this.requireStorageInstanceEligibility({
        storageInstanceId: request.storageInstanceId,
        workspaceId: request.workspaceId,
        actorUserIdentityId: request.actorUserId,
        expectedSizeBytes: request.initialVersion.content.sizeBytes,
        occurredAt: request.occurredAt,
      });
      if (!storageInstance.ok) {
        return storageInstance;
      }

      if (request.initialVersion.storageInstanceId !== request.storageInstanceId) {
        return this.failure(
          AssetServiceErrorCodes.invalidRequest,
          "initialVersion.storageInstanceId must match storageInstanceId.",
        );
      }

      const occurredAt = request.occurredAt ?? this.clock.now().toISOString();
      const asset = createAsset({
        id: request.assetId,
        kind: request.kind,
        ownership: createAssetOwnershipMetadata({
          workspaceId: request.workspaceId,
          ownerUserId,
          createdBy: request.actorUserId,
          createdAt: occurredAt,
          lastModifiedBy: request.actorUserId,
          lastModifiedAt: occurredAt,
        }),
        visibility: request.visibility,
        sharingPolicyRef: request.sharingPolicyRef,
        storageBinding: createStorageInstanceRef({
          storageInstanceId: request.storageInstanceId,
        }),
        initialVersion: createAssetVersion({
          versionId: request.initialVersion.versionId,
          revision: 1,
          location: createAssetLocationRef({
            storageInstance: { storageInstanceId: request.storageInstanceId },
            objectKey: request.initialVersion.objectKey,
            objectVersionId: request.initialVersion.objectVersionId,
            area: request.initialVersion.area,
          }),
          content: createContentDescriptor({
            mimeType: request.initialVersion.content.mimeType,
            sizeBytes: request.initialVersion.content.sizeBytes,
            checksum: request.initialVersion.content.checksum,
            originalFileName: request.initialVersion.content.originalFileName,
          }),
          createdBy: request.actorUserId,
          createdAt: occurredAt,
        }),
      });

      await this.dependencies.repository.createAsset(asset);
      await this.publishAuditEvent({
        type: "asset-registered",
        occurredAt,
        workspaceId: request.workspaceId,
        actorUserId: request.actorUserId,
        correlationId: request.correlationId,
        operationKey: request.operationKey,
        asset: {
          assetId: asset.id,
          kind: asset.kind,
          visibility: asset.visibility,
          lifecycleState: asset.lifecycle.state,
          versionId: asset.currentVersionId,
        },
      });

      return {
        ok: true,
        value: Object.freeze({ asset }),
      };
    } catch (error) {
      if (isAssetAlreadyExistsError(error)) {
        return this.failure(AssetServiceErrorCodes.conflict, "Asset already exists.");
      }
      if (error instanceof AssetDomainError) {
        return this.failure(AssetServiceErrorCodes.invalidRequest, error.message);
      }
      return this.failure(
        AssetServiceErrorCodes.internal,
        error instanceof Error ? error.message : "Asset registration failed.",
      );
    }
  }

  public async beginAssetUpload(
    input: BeginAssetUploadRequest,
  ): Promise<AssetServiceResult<BeginAssetUploadResult>> {
    let request: BeginAssetUploadRequest;
    try {
      request = validateBeginAssetUploadRequest(input);
    } catch (error) {
      return this.invalidRequest(error);
    }

    try {
      const authorization = await this.resolveWorkspaceAuthorization(
        request.workspaceId,
        request.actorUserId,
        request.occurredAt,
      );
      if (!authorization.isAuthorized) {
        return this.failure(AssetServiceErrorCodes.accessDenied, "Asset upload initiation requires active workspace membership.");
      }

      const asset = await this.dependencies.repository.findAssetById(request.assetId);
      if (!asset || asset.ownership.workspaceId !== request.workspaceId) {
        return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
      }
      if (asset.lifecycle.state !== AssetLifecycleStates.active) {
        return this.failure(AssetServiceErrorCodes.invalidState, "Upload can only be initiated for active assets.");
      }
      if (asset.storageBinding.storageInstanceId !== request.storageInstanceId) {
        return this.failure(AssetServiceErrorCodes.invalidRequest, "Asset storage binding does not match requested storage instance.");
      }
      if (
        asset.visibility === AssetVisibilities.private
        && asset.ownership.ownerUserId !== request.actorUserId
        && !authorization.isWorkspaceAdmin
      ) {
        return this.failure(AssetServiceErrorCodes.accessDenied, "Private assets can only be uploaded by the owner or workspace administrator.");
      }
      if (
        asset.ownership.ownerUserId
        && asset.ownership.ownerUserId !== request.actorUserId
        && !authorization.isWorkspaceAdmin
      ) {
        return this.failure(AssetServiceErrorCodes.accessDenied, "Asset upload initiation requires asset ownership or workspace administrator permissions.");
      }

      const storageInstance = await this.requireStorageInstanceEligibility({
        storageInstanceId: request.storageInstanceId,
        workspaceId: request.workspaceId,
        actorUserIdentityId: request.actorUserId,
        expectedSizeBytes: request.sizeBytes,
        occurredAt: request.occurredAt,
      });
      if (!storageInstance.ok) {
        return storageInstance;
      }

      const sessionId = `asset-upload-session:${this.idGenerator.nextId()}`;
      const now = request.occurredAt ?? this.clock.now().toISOString();
      const expiresInSeconds = request.expiresInSeconds ?? 900;
      const expiresAt = new Date(new Date(now).getTime() + (expiresInSeconds * 1000)).toISOString();
      const objectKey = buildUploadObjectKey(
        request.workspaceId,
        request.assetId,
        sessionId,
        request.fileName,
        request.area ?? "input",
      );

      await this.publishAuditEvent({
        type: "asset-upload-initiated",
        occurredAt: now,
        workspaceId: request.workspaceId,
        actorUserId: request.actorUserId,
        correlationId: request.correlationId,
        operationKey: request.operationKey,
        asset: {
          assetId: asset.id,
          kind: asset.kind,
          visibility: asset.visibility,
          lifecycleState: asset.lifecycle.state,
          versionId: asset.currentVersionId,
        },
        details: {
          storageInstanceId: request.storageInstanceId,
          objectKey,
          fileName: request.fileName,
          mimeType: request.mimeType,
          sizeBytes: request.sizeBytes,
          area: request.area ?? "input",
          uploadSessionId: sessionId,
        },
      });

      return {
        ok: true,
        value: Object.freeze({
          asset,
          upload: Object.freeze({
            uploadSessionId: sessionId,
            assetId: asset.id,
            workspaceId: request.workspaceId,
            storageInstanceId: request.storageInstanceId,
            objectKey,
            area: request.area ?? "input",
            uploadEndpoint: `/api/v1/assets/upload-sessions/${encodeURIComponent(sessionId)}/content`,
            uploadMethod: "POST",
            expected: Object.freeze({
              fileName: request.fileName,
              mimeType: request.mimeType,
              sizeBytes: request.sizeBytes,
            }),
            expiresAt,
          }),
        }),
      };
    } catch (error) {
      return this.failure(
        AssetServiceErrorCodes.internal,
        error instanceof Error ? error.message : "Upload initiation failed.",
      );
    }
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

  private async requireStorageInstanceEligibility(input: {
    readonly storageInstanceId: string;
    readonly workspaceId: string;
    readonly actorUserIdentityId: string;
    readonly expectedSizeBytes: number;
    readonly occurredAt?: string;
  }): Promise<AssetServiceResult<never> | { readonly ok: true; readonly value: StorageInstance }> {
    const storageInstance = await this.dependencies.storageInstanceRepository.findStorageInstanceById(
      input.storageInstanceId,
    );
    if (!storageInstance || storageInstance.ownership.workspaceId !== input.workspaceId) {
      return this.failure(AssetServiceErrorCodes.notFound, "Storage instance was not found for the workspace.");
    }
    if (storageInstance.lifecycleState !== StorageLifecycleStates.active) {
      return this.failure(AssetServiceErrorCodes.invalidState, "Storage instance must be active for uploads.");
    }
    if (storageInstance.access.mode === StorageAccessModes.readOnly) {
      return this.failure(AssetServiceErrorCodes.invalidState, "Storage instance is read-only and cannot be used for uploads.");
    }

    const policyDecision = await this.dependencies.storagePolicyEvaluationPort.evaluateStorageAction({
      action: StoragePolicyActions.useForAssets,
      actorUserIdentityId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      storageInstance,
      occurredAt: input.occurredAt,
    });
    if (!policyDecision.allowed) {
      return this.failure(
        AssetServiceErrorCodes.policyViolation,
        policyDecision.message ?? "Storage policy denied asset upload usage.",
        Object.freeze({
          reasonCode: policyDecision.reasonCode,
          occurredAt: policyDecision.occurredAt,
          ...(policyDecision.details ?? {}),
        }),
      );
    }

    const maxObjectBytes = storageInstance.policy.maxObjectBytes;
    if (typeof maxObjectBytes === "number" && input.expectedSizeBytes > maxObjectBytes) {
      return this.failure(
        AssetServiceErrorCodes.policyViolation,
        "Asset size exceeds storage policy maxObjectBytes.",
        Object.freeze({
          maxObjectBytes,
          requestedSizeBytes: input.expectedSizeBytes,
        }),
      );
    }

    return {
      ok: true,
      value: storageInstance,
    };
  }

  private invalidRequest(error: unknown): AssetServiceResult<never> {
    return this.failure(
      AssetServiceErrorCodes.invalidRequest,
      error instanceof Error ? error.message : "Invalid request.",
    );
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

function isAssetAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.toLowerCase().includes("already exists");
}

function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  return trimmed.replace(/[^a-z0-9._-]/g, "-");
}

function sanitizeSegment(segment: string): string {
  return segment.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-");
}

function buildUploadObjectKey(
  workspaceId: string,
  assetId: string,
  uploadSessionId: string,
  fileName: string,
  area: string,
): string {
  return [
    "workspaces",
    sanitizeSegment(workspaceId),
    "assets",
    sanitizeSegment(assetId),
    sanitizeSegment(area),
    sanitizeSegment(uploadSessionId),
    sanitizeFileName(fileName),
  ].join("/");
}
