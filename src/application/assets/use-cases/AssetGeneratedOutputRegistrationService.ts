import {
  AssetDomainError,
  AssetKinds,
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
import type { AssetAuditSink } from "../ports/AssetAuditPort";
import type { IAssetRepository } from "../ports/IAssetRepository";
import {
  AssetServiceErrorCodes,
  validateRegisterGeneratedOutputRequest,
  type RegisterGeneratedOutputRequest,
  type RegisterGeneratedOutputResult,
  type AssetServiceResult,
} from "./AssetServiceContracts";

export interface AssetGeneratedOutputRegistrationServiceDependencies {
  readonly repository: IAssetRepository;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly storageInstanceRepository: IStorageInstanceRepository;
  readonly storagePolicyEvaluationPort: IStoragePolicyEvaluationPort;
  readonly auditSink?: AssetAuditSink;
  readonly clock?: {
    now(): Date;
  };
}

export class AssetGeneratedOutputRegistrationService {
  private readonly clock: { now(): Date };

  public constructor(private readonly dependencies: AssetGeneratedOutputRegistrationServiceDependencies) {
    this.clock = dependencies.clock ?? { now: () => new Date() };
  }

  public async registerGeneratedOutput(
    input: RegisterGeneratedOutputRequest,
  ): Promise<AssetServiceResult<RegisterGeneratedOutputResult>> {
    let request: RegisterGeneratedOutputRequest;
    try {
      request = validateRegisterGeneratedOutputRequest(input);
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
        return this.failure(
          AssetServiceErrorCodes.accessDenied,
          "Generated output registration requires active workspace membership.",
        );
      }

      if (request.outputVersion.storageInstanceId !== request.storageInstanceId) {
        return this.failure(
          AssetServiceErrorCodes.invalidRequest,
          "outputVersion.storageInstanceId must match storageInstanceId.",
        );
      }

      const ownerUserId = request.ownerUserId;
      if (
        ownerUserId
        && ownerUserId !== request.actorUserId
        && !authorization.isWorkspaceAdmin
      ) {
        return this.failure(
          AssetServiceErrorCodes.accessDenied,
          "Only workspace administrators can register generated outputs for another owner.",
        );
      }

      const storageInstance = await this.requireStorageInstanceEligibility({
        storageInstanceId: request.storageInstanceId,
        workspaceId: request.workspaceId,
        actorUserIdentityId: request.actorUserId,
        expectedSizeBytes: request.outputVersion.content.sizeBytes,
        occurredAt: request.occurredAt,
      });
      if (!storageInstance.ok) {
        return storageInstance;
      }

      const occurredAt = request.occurredAt ?? this.clock.now().toISOString();
      const asset = createAsset({
        id: request.assetId,
        kind: AssetKinds.generatedOutput,
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
          versionId: request.outputVersion.versionId,
          revision: 1,
          location: createAssetLocationRef({
            storageInstance: { storageInstanceId: request.storageInstanceId },
            objectKey: request.outputVersion.objectKey,
            objectVersionId: request.outputVersion.objectVersionId,
            area: request.outputVersion.area,
          }),
          content: createContentDescriptor({
            mimeType: request.outputVersion.content.mimeType,
            sizeBytes: request.outputVersion.content.sizeBytes,
            checksum: request.outputVersion.content.checksum,
            originalFileName: request.outputVersion.content.originalFileName,
            encryption: request.outputVersion.content.encryption,
          }),
          createdBy: request.actorUserId,
          createdAt: occurredAt,
        }),
      });

      await this.dependencies.repository.createAsset(asset);
      await this.dependencies.repository.replaceAssetLineage(asset.id, request.lineage);
      if (typeof this.dependencies.repository.replaceAssetGeneratedOutputSource === "function") {
        await this.dependencies.repository.replaceAssetGeneratedOutputSource(asset.id, request.source);
      }

      await this.publishAuditEvent({
        type: "asset-generated-output-registered",
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
        details: Object.freeze({
          lineageCount: request.lineage.length,
          source: request.source,
        }),
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
        error instanceof Error ? error.message : "Generated output registration failed.",
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
      return this.failure(AssetServiceErrorCodes.invalidState, "Storage instance must be active for generated outputs.");
    }
    if (storageInstance.access.mode === StorageAccessModes.readOnly) {
      return this.failure(AssetServiceErrorCodes.invalidState, "Storage instance is read-only and cannot accept generated outputs.");
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
        policyDecision.message ?? "Storage policy denied generated output usage.",
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
        "Generated output size exceeds storage policy maxObjectBytes.",
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
