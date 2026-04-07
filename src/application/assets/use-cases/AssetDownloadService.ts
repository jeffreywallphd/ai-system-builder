import {
  AssetKinds,
  AssetLifecycleStates,
  AssetVisibilities,
  type Asset,
} from "@domain/assets/AssetDomain";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
} from "@domain/workspaces/WorkspaceDomain";
import { StorageLogicalAccessOperationIntents } from "../../storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import type { IStorageLogicalAccessResolutionService } from "../../storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import type { IWorkspaceAuthorizationReadRepository } from "../../workspaces/ports/IWorkspaceAuthorizationReadRepository";
import {
  publishAssetAuditEventBestEffort,
  type AssetAuditSink,
} from "../ports/AssetAuditPort";
import type { IAssetContentCipherPort } from "../ports/AssetContentCipherPort";
import type { IAssetDownloadGrantPort } from "../ports/AssetDownloadGrantPort";
import type { IAssetRepository } from "../ports/IAssetRepository";
import type { IEncryptionPolicyEvaluationService } from "../../security/use-cases/EncryptionPolicyEvaluationServiceContracts";
import { ProtectedDataClasses } from "@domain/security/EncryptionAtRestPolicyDomain";
import {
  publishEncryptionEnforcementEventBestEffort,
  type IEncryptionEnforcementObservabilityPort,
} from "../../security/ports/EncryptionEnforcementObservabilityPorts";
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
  readonly encryptionPolicyEvaluationService: IEncryptionPolicyEvaluationService;
  readonly assetContentCipherPort: IAssetContentCipherPort;
  readonly encryptionObservabilityPort?: IEncryptionEnforcementObservabilityPort;
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
      await this.publishAuditEvent({
        type: "asset-download-authorized",
        occurredAt,
        workspaceId: request.workspaceId,
        actorUserId: request.actorUserId,
        correlationId: request.correlationId,
        outcome: "rejected",
        asset: {
          assetId: request.assetId,
        },
        details: Object.freeze({
          reasonCode: AssetServiceErrorCodes.accessDenied,
          purpose: request.purpose,
        }),
      });
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

    const encryptionPolicy = await this.resolveAssetContentPolicy({
      workspaceId: request.workspaceId,
      storageInstanceId: targetVersion.location.storageInstance.storageInstanceId,
      occurredAt,
    });
    if (!encryptionPolicy.ok) {
      return encryptionPolicy;
    }

    const contentIsEncrypted = Boolean(targetVersion.content.encryption);
    if (!contentIsEncrypted && encryptionPolicy.value.contentEncryptionRequired) {
      await this.publishEncryptionEvent({
        event: "asset-content.decryption-access-authorized",
        outcome: "denied",
        occurredAt,
        actorUserId: request.actorUserId,
        workspaceId: request.workspaceId,
        storageInstanceId: targetVersion.location.storageInstance.storageInstanceId,
        dataClass: ProtectedDataClasses.assetContent,
        correlationId: request.correlationId,
        details: Object.freeze({
          purpose: request.purpose,
          contentIsEncrypted,
          contentEncryptionRequired: encryptionPolicy.value.contentEncryptionRequired,
          reasonCode: "encrypted-content-required",
        }),
      });
      await this.publishAuditEvent({
        type: "asset-download-authorized",
        occurredAt,
        workspaceId: request.workspaceId,
        actorUserId: request.actorUserId,
        correlationId: request.correlationId,
        outcome: "rejected",
        asset: {
          assetId: asset.id,
          kind: asset.kind,
          visibility: asset.visibility,
          lifecycleState: asset.lifecycle.state,
          versionId: targetVersion.versionId,
        },
        details: Object.freeze({
          reasonCode: "encrypted-content-required",
          purpose: request.purpose,
          storageInstanceId: targetVersion.location.storageInstance.storageInstanceId,
        }),
      });
      return this.failure(
        AssetServiceErrorCodes.policyViolation,
        "Asset content is not encrypted, but effective policy requires scoped-content encryption.",
        Object.freeze({
          assetId: asset.id,
          versionId: targetVersion.versionId,
          storageInstanceId: targetVersion.location.storageInstance.storageInstanceId,
        }),
      );
    }

    const decryptionAuthorization = evaluateDecryptionAuthorization({
      storageInstance: plan.value.storageInstance,
      purpose: request.purpose,
      contentIsEncrypted,
      policyAllowPreviewDecryption: encryptionPolicy.value.allowPreviewDecryption,
      policyAllowWorkerDecryption: encryptionPolicy.value.allowWorkerDecryption,
    });
    if (!decryptionAuthorization.allowed) {
      await this.publishEncryptionEvent({
        event: "asset-content.decryption-access-authorized",
        outcome: "denied",
        occurredAt,
        actorUserId: request.actorUserId,
        workspaceId: request.workspaceId,
        storageInstanceId: plan.value.storageInstance.id,
        dataClass: ProtectedDataClasses.assetContent,
        correlationId: request.correlationId,
        details: Object.freeze({
          purpose: request.purpose,
          contentIsEncrypted,
          contentEncryptionRequired: encryptionPolicy.value.contentEncryptionRequired,
          storageAllowsPreviewDecryption: plan.value.storageInstance.policy.security.allowPreviewDecryption,
          storageAllowsWorkerDecryption: plan.value.storageInstance.policy.security.allowWorkerDecryption,
          policyAllowsPreviewDecryption: encryptionPolicy.value.allowPreviewDecryption,
          policyAllowsWorkerDecryption: encryptionPolicy.value.allowWorkerDecryption,
          decryptionScope: decryptionAuthorization.scope,
          reasonCode: decryptionAuthorization.reasonCode,
        }),
      });
      await this.publishAuditEvent({
        type: "asset-download-authorized",
        occurredAt,
        workspaceId: request.workspaceId,
        actorUserId: request.actorUserId,
        correlationId: request.correlationId,
        outcome: "rejected",
        asset: {
          assetId: asset.id,
          kind: asset.kind,
          visibility: asset.visibility,
          lifecycleState: asset.lifecycle.state,
          versionId: targetVersion.versionId,
        },
        details: Object.freeze({
          reasonCode: decryptionAuthorization.reasonCode,
          purpose: request.purpose,
          decryptionScope: decryptionAuthorization.scope,
          storageInstanceId: plan.value.storageInstance.id,
        }),
      });
      return this.failure(
        AssetServiceErrorCodes.policyViolation,
        "Storage security policy denies decryption for this download purpose.",
        Object.freeze({
          purpose: request.purpose,
          reasonCode: decryptionAuthorization.reasonCode,
          storageInstanceId: plan.value.storageInstance.id,
        }),
      );
    }
    await this.publishEncryptionEvent({
      event: "asset-content.decryption-access-authorized",
      outcome: "succeeded",
      occurredAt,
      actorUserId: request.actorUserId,
      workspaceId: request.workspaceId,
      storageInstanceId: plan.value.storageInstance.id,
      dataClass: ProtectedDataClasses.assetContent,
      correlationId: request.correlationId,
      details: Object.freeze({
        purpose: request.purpose,
        contentIsEncrypted,
        contentEncryptionRequired: encryptionPolicy.value.contentEncryptionRequired,
        decryptionScope: decryptionAuthorization.scope,
      }),
    });

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
      outcome: "success",
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
      await this.publishAuditEvent({
        type: "asset-download-opened",
        occurredAt,
        workspaceId: request.workspaceId,
        actorUserId: request.actorUserId,
        correlationId: request.correlationId,
        outcome: "rejected",
        asset: {
          assetId: request.assetId,
        },
        details: Object.freeze({
          reasonCode: AssetServiceErrorCodes.accessDenied,
        }),
      });
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
      await this.publishAuditEvent({
        type: "asset-download-opened",
        occurredAt,
        workspaceId: request.workspaceId,
        actorUserId: request.actorUserId,
        correlationId: request.correlationId,
        outcome: "rejected",
        asset: {
          assetId: request.assetId,
        },
        details: Object.freeze({
          reasonCode: "invalid-download-grant",
        }),
      });
      return this.failure(
        AssetServiceErrorCodes.accessDenied,
        "Download authorization token is invalid or expired.",
      );
    }
    if (!isDownloadGrantScopedToRequest(grant, request)) {
      await this.publishAuditEvent({
        type: "asset-download-opened",
        occurredAt,
        workspaceId: request.workspaceId,
        actorUserId: request.actorUserId,
        correlationId: request.correlationId,
        outcome: "rejected",
        asset: {
          assetId: request.assetId,
        },
        details: Object.freeze({
          reasonCode: "invalid-download-grant-scope",
        }),
      });
      return this.failure(
        AssetServiceErrorCodes.accessDenied,
        "Download authorization token scope is invalid.",
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

    const encryptionPolicy = await this.resolveAssetContentPolicy({
      workspaceId: request.workspaceId,
      storageInstanceId: targetVersion.location.storageInstance.storageInstanceId,
      occurredAt,
    });
    if (!encryptionPolicy.ok) {
      return encryptionPolicy;
    }

    const contentIsEncrypted = Boolean(targetVersion.content.encryption);
    if (!contentIsEncrypted && encryptionPolicy.value.contentEncryptionRequired) {
      await this.publishEncryptionEvent({
        event: "asset-content.decryption-access-opened",
        outcome: "denied",
        occurredAt,
        actorUserId: request.actorUserId,
        workspaceId: request.workspaceId,
        storageInstanceId: targetVersion.location.storageInstance.storageInstanceId,
        dataClass: ProtectedDataClasses.assetContent,
        correlationId: request.correlationId,
        details: Object.freeze({
          purpose: grant.purpose,
          contentIsEncrypted,
          contentEncryptionRequired: encryptionPolicy.value.contentEncryptionRequired,
          reasonCode: "encrypted-content-required",
        }),
      });
      await this.publishAuditEvent({
        type: "asset-download-opened",
        occurredAt,
        workspaceId: request.workspaceId,
        actorUserId: request.actorUserId,
        correlationId: request.correlationId,
        outcome: "rejected",
        asset: {
          assetId: asset.id,
          kind: asset.kind,
          visibility: asset.visibility,
          lifecycleState: asset.lifecycle.state,
          versionId: targetVersion.versionId,
        },
        details: Object.freeze({
          reasonCode: "encrypted-content-required",
          purpose: grant.purpose,
          storageInstanceId: targetVersion.location.storageInstance.storageInstanceId,
        }),
      });
      return this.failure(
        AssetServiceErrorCodes.policyViolation,
        "Asset content is not encrypted, but effective policy requires scoped-content encryption.",
        Object.freeze({
          assetId: asset.id,
          versionId: targetVersion.versionId,
          storageInstanceId: targetVersion.location.storageInstance.storageInstanceId,
        }),
      );
    }

    const decryptionAuthorization = evaluateDecryptionAuthorization({
      storageInstance: plan.value.storageInstance,
      purpose: grant.purpose,
      contentIsEncrypted,
      policyAllowPreviewDecryption: encryptionPolicy.value.allowPreviewDecryption,
      policyAllowWorkerDecryption: encryptionPolicy.value.allowWorkerDecryption,
    });
    if (!decryptionAuthorization.allowed) {
      await this.publishEncryptionEvent({
        event: "asset-content.decryption-access-opened",
        outcome: "denied",
        occurredAt,
        actorUserId: request.actorUserId,
        workspaceId: request.workspaceId,
        storageInstanceId: plan.value.storageInstance.id,
        dataClass: ProtectedDataClasses.assetContent,
        correlationId: request.correlationId,
        details: Object.freeze({
          purpose: grant.purpose,
          contentIsEncrypted,
          contentEncryptionRequired: encryptionPolicy.value.contentEncryptionRequired,
          storageAllowsPreviewDecryption: plan.value.storageInstance.policy.security.allowPreviewDecryption,
          storageAllowsWorkerDecryption: plan.value.storageInstance.policy.security.allowWorkerDecryption,
          policyAllowsPreviewDecryption: encryptionPolicy.value.allowPreviewDecryption,
          policyAllowsWorkerDecryption: encryptionPolicy.value.allowWorkerDecryption,
          decryptionScope: decryptionAuthorization.scope,
          reasonCode: decryptionAuthorization.reasonCode,
        }),
      });
      await this.publishAuditEvent({
        type: "asset-download-opened",
        occurredAt,
        workspaceId: request.workspaceId,
        actorUserId: request.actorUserId,
        correlationId: request.correlationId,
        outcome: "rejected",
        asset: {
          assetId: asset.id,
          kind: asset.kind,
          visibility: asset.visibility,
          lifecycleState: asset.lifecycle.state,
          versionId: targetVersion.versionId,
        },
        details: Object.freeze({
          reasonCode: decryptionAuthorization.reasonCode,
          purpose: grant.purpose,
          decryptionScope: decryptionAuthorization.scope,
          storageInstanceId: plan.value.storageInstance.id,
        }),
      });
      return this.failure(
        AssetServiceErrorCodes.policyViolation,
        "Storage security policy denies decryption for this download purpose.",
        Object.freeze({
          purpose: grant.purpose,
          reasonCode: decryptionAuthorization.reasonCode,
          storageInstanceId: plan.value.storageInstance.id,
        }),
      );
    }

    try {
      const encryptedStream = await plan.value.objectPort.openObjectReadStream({
        storageInstance: plan.value.storageInstance,
        objectKey: grant.objectKey,
      });
      const stream = targetVersion.content.encryption
        ? await this.dependencies.assetContentCipherPort.beginDecryption({
          ciphertext: encryptedStream,
          descriptor: targetVersion.content.encryption,
          aad: buildAssetContentAad({
            workspaceId: request.workspaceId,
            storageInstanceId: targetVersion.location.storageInstance.storageInstanceId,
            assetId: asset.id,
            versionId: targetVersion.versionId,
            objectKey: targetVersion.location.objectKey,
            area: targetVersion.location.area,
          }),
        })
        : encryptedStream;

      const contentDisposition = grant.purpose === AssetDownloadPurposes.inlinePreview
        ? "inline"
        : "attachment";
      await this.publishAuditEvent({
        type: "asset-download-opened",
        occurredAt,
        workspaceId: request.workspaceId,
        actorUserId: request.actorUserId,
        correlationId: request.correlationId,
        outcome: "success",
        asset: {
          assetId: asset.id,
          kind: asset.kind,
          visibility: asset.visibility,
          lifecycleState: asset.lifecycle.state,
          versionId: targetVersion.versionId,
        },
        details: Object.freeze({
          purpose: grant.purpose,
          contentDisposition,
        }),
      });
      await this.publishEncryptionEvent({
        event: "asset-content.decryption-access-opened",
        outcome: "succeeded",
        occurredAt,
        actorUserId: request.actorUserId,
        workspaceId: request.workspaceId,
        storageInstanceId: plan.value.storageInstance.id,
        dataClass: ProtectedDataClasses.assetContent,
        correlationId: request.correlationId,
        details: Object.freeze({
          purpose: grant.purpose,
          contentIsEncrypted,
          contentEncryptionRequired: encryptionPolicy.value.contentEncryptionRequired,
          decryptionScope: decryptionAuthorization.scope,
          contentDisposition,
        }),
      });

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
      await this.publishEncryptionEvent({
        event: "asset-content.decryption-access-opened",
        outcome: "failed",
        occurredAt,
        actorUserId: request.actorUserId,
        workspaceId: request.workspaceId,
        storageInstanceId: grant.storageInstanceId,
        dataClass: ProtectedDataClasses.assetContent,
        correlationId: request.correlationId,
        details: Object.freeze({
          purpose: grant.purpose,
          reasonCode: "content-stream-unavailable",
        }),
      });
      return this.failure(
        AssetServiceErrorCodes.contentUnavailable,
        "Asset content stream is unavailable.",
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

  private async resolveAssetContentPolicy(input: {
    readonly workspaceId: string;
    readonly storageInstanceId: string;
    readonly occurredAt: string;
  }): Promise<AssetServiceResult<{
      readonly contentEncryptionRequired: boolean;
      readonly allowPreviewDecryption: boolean;
      readonly allowWorkerDecryption: boolean;
    }>> {
    const policy = await this.dependencies.encryptionPolicyEvaluationService.evaluateEffectivePolicy({
      dataClass: ProtectedDataClasses.assetContent,
      workspaceId: input.workspaceId,
      storageInstanceId: input.storageInstanceId,
      occurredAt: input.occurredAt,
    });
    if (!policy.ok) {
      return this.failureFromEncryptionPolicy(policy.error.code, policy.error.message);
    }

    return {
      ok: true,
      value: Object.freeze({
        contentEncryptionRequired: policy.value.contentEncryptionRequired,
        allowPreviewDecryption: policy.value.allowPreviewDecryption,
        allowWorkerDecryption: policy.value.allowWorkerDecryption,
      }),
    };
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

  private failureFromEncryptionPolicy(
    code: string,
    message: string,
  ): AssetServiceResult<never> {
    switch (code) {
      case "encryption-policy-invalid-request":
        return this.failure(AssetServiceErrorCodes.invalidRequest, message);
      case "encryption-policy-violation":
        return this.failure(AssetServiceErrorCodes.policyViolation, message);
      case "encryption-policy-resolution-failed":
        return this.failure(AssetServiceErrorCodes.invalidState, message);
      default:
        return this.failure(AssetServiceErrorCodes.internal, message);
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
    await publishAssetAuditEventBestEffort(this.dependencies.auditSink, event);
  }

  private async publishEncryptionEvent(
    event: Parameters<typeof publishEncryptionEnforcementEventBestEffort>[1],
  ): Promise<void> {
    await publishEncryptionEnforcementEventBestEffort(this.dependencies.encryptionObservabilityPort, event);
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

function evaluateDecryptionAuthorization(input: {
  readonly storageInstance: {
    readonly policy: {
      readonly security: {
        readonly allowPreviewDecryption: boolean;
        readonly allowWorkerDecryption: boolean;
      };
    };
  };
  purpose: typeof AssetDownloadPurposes[keyof typeof AssetDownloadPurposes],
  readonly contentIsEncrypted: boolean;
  readonly policyAllowPreviewDecryption: boolean;
  readonly policyAllowWorkerDecryption: boolean;
}): {
    readonly allowed: boolean;
    readonly scope: "not-required" | "download" | "inline-preview" | "worker-process";
    readonly reasonCode?: "preview-decryption-not-allowed" | "worker-decryption-not-allowed";
  } {
  if (!input.contentIsEncrypted) {
    return Object.freeze({
      allowed: true,
      scope: "not-required",
    });
  }

  if (input.purpose === AssetDownloadPurposes.inlinePreview) {
    if (
      input.storageInstance.policy.security.allowPreviewDecryption
      && input.policyAllowPreviewDecryption
    ) {
      return Object.freeze({
        allowed: true,
        scope: "inline-preview",
      });
    }
    return Object.freeze({
      allowed: false,
      scope: "inline-preview",
      reasonCode: "preview-decryption-not-allowed",
    });
  }
  if (input.purpose === AssetDownloadPurposes.workerProcess) {
    if (
      input.storageInstance.policy.security.allowWorkerDecryption
      && input.policyAllowWorkerDecryption
    ) {
      return Object.freeze({
        allowed: true,
        scope: "worker-process",
      });
    }
    return Object.freeze({
      allowed: false,
      scope: "worker-process",
      reasonCode: "worker-decryption-not-allowed",
    });
  }
  return Object.freeze({
    allowed: true,
    scope: "download",
  });
}

function isDownloadGrantScopedToRequest(
  grant: NonNullable<Awaited<ReturnType<IAssetDownloadGrantPort["resolveDownloadGrant"]>>>,
  request: OpenAuthorizedAssetDownloadStreamRequest,
): boolean {
  return grant.workspaceId === request.workspaceId
    && grant.actorUserId === request.actorUserId
    && grant.assetId === request.assetId;
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

function buildAssetContentAad(input: {
  readonly workspaceId: string;
  readonly storageInstanceId: string;
  readonly assetId: string;
  readonly versionId: string;
  readonly objectKey: string;
  readonly area: string;
}): string {
  return [
    "asset-content-encryption/v1",
    `workspace=${input.workspaceId}`,
    `storage=${input.storageInstanceId}`,
    `asset=${input.assetId}`,
    `version=${input.versionId}`,
    `area=${input.area}`,
    `object=${input.objectKey}`,
  ].join(";");
}


