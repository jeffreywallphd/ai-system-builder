import { randomUUID } from "node:crypto";
import {
  ResourceVisibilities,
  type ResourceVisibility,
} from "@domain/authorization/AuthorizationDomain";
import {
  ImageAssetDomainError,
  ImageAssetOriginKinds,
  ImageAssetStatuses,
  createImageAsset,
} from "@domain/image-assets/ImageAssetDomain";
import {
  StorageAccessModes,
  StorageLifecycleStates,
  type StorageInstance,
} from "@domain/storage/StorageDomain";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
} from "@domain/workspaces/WorkspaceDomain";
import type { IAuthorizationPolicyDecisionEvaluator } from "@application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import {
  ImageAssetAccessActions,
  toImageAssetPolicyDecisionEvaluationRequest,
} from "@shared/contracts/assets/ImageAssetAuthorizationContracts";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type { IStorageInstanceRepository } from "@application/storage/ports/IStorageInstanceRepository";
import {
  StoragePolicyActions,
  type IStoragePolicyEvaluationPort,
} from "@application/storage/ports/StoragePolicyEvaluationPort";
import {
  ImageAssetStorageObjectAreas as StorageObjectAreas,
  type IImageAssetStoragePort,
} from "../ports/ImageAssetStoragePort";
import type { IImageAssetRepository } from "../ports/IImageAssetRepository";
import {
  ImageAssetCreationErrorCodes,
  validateInitiateImageAssetCreationRequest,
  type IInitiateImageAssetCreationUseCase,
  type ImageAssetCreationResult,
  type InitiateImageAssetCreationRequest,
  type InitiateImageAssetCreationSuccess,
} from "./ImageAssetCreationUseCaseContracts";

export interface InitiateImageAssetCreationUseCaseDependencies {
  readonly imageAssetRepository: IImageAssetRepository;
  readonly imageAssetStoragePort: IImageAssetStoragePort;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly storageInstanceRepository: IStorageInstanceRepository;
  readonly storagePolicyEvaluationPort: IStoragePolicyEvaluationPort;
  readonly authorizationPolicyDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  readonly idGenerator?: {
    nextAssetId(): string;
  };
  readonly clock?: {
    now(): Date;
  };
}

export class InitiateImageAssetCreationUseCase implements IInitiateImageAssetCreationUseCase {
  private readonly idGenerator: { nextAssetId(): string };

  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: InitiateImageAssetCreationUseCaseDependencies,
  ) {
    this.idGenerator = dependencies.idGenerator ?? {
      nextAssetId: () => `image-asset:${randomUUID()}`,
    };
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: InitiateImageAssetCreationRequest,
  ): Promise<ImageAssetCreationResult<InitiateImageAssetCreationSuccess>> {
    let request: InitiateImageAssetCreationRequest;
    try {
      request = validateInitiateImageAssetCreationRequest(input);
    } catch (error) {
      return this.failure(
        ImageAssetCreationErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid image asset create request.",
      );
    }

    try {
      const occurredAt = request.occurredAt ?? this.clock.now().toISOString();
      const authorization = await this.resolveWorkspaceAuthorization(
        request.workspaceId,
        request.actorUserId,
        occurredAt,
      );
      if (!authorization.isAuthorized) {
        return this.failure(
          ImageAssetCreationErrorCodes.accessDenied,
          "Image asset creation requires active workspace membership.",
        );
      }

      if (
        request.ownerUserId
        && request.ownerUserId !== request.actorUserId
        && !authorization.isWorkspaceAdmin
      ) {
        return this.failure(
          ImageAssetCreationErrorCodes.accessDenied,
          "Only workspace administrators can create image assets for another owner.",
        );
      }

      const resolvedVisibility = this.resolveVisibility(request.visibility, request.ownerUserId);
      const ownerUserId = request.ownerUserId
        ?? (resolvedVisibility === ResourceVisibilities.private ? request.actorUserId : undefined);

      const createDecision = await this.evaluateCreatePolicy(request, occurredAt);
      if (!createDecision.allowed) {
        return this.failure(
          ImageAssetCreationErrorCodes.accessDenied,
          createDecision.message ?? "Image asset creation denied by authorization policy.",
          Object.freeze({
            reasonCode: createDecision.reasonCode,
            evaluatedAt: createDecision.evaluatedAt,
          }),
        );
      }

      const storageResolution = await this.resolveStorageInstance({
        requestedStorageInstanceId: request.storageInstanceId,
        workspaceId: request.workspaceId,
        actorUserId: request.actorUserId,
        sizeBytes: request.sizeBytes,
        occurredAt,
      });
      if (!storageResolution.ok) {
        return storageResolution;
      }

      const storageInstance = storageResolution.value;
      const assetId = request.assetId ?? this.idGenerator.nextAssetId();
      const imageAsset = createImageAsset({
        assetId,
        workspaceId: request.workspaceId,
        ownerUserId,
        storageInstanceId: storageInstance.id,
        storageBindingReference: `storage-instance://${storageInstance.id}/image-assets`,
        originKind: request.originKind ?? ImageAssetOriginKinds.uploadedSource,
        mediaType: request.mediaType,
        originalFilename: request.originalFilename,
        normalizedFilename: request.normalizedFilename ?? request.originalFilename,
        sizeBytes: request.sizeBytes,
        fingerprint: request.fingerprint,
        visibility: resolvedVisibility,
        sharingPolicy: request.sharingPolicy,
        createdBy: request.actorUserId,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        lastModifiedBy: request.actorUserId,
        lifecycleStatus: ImageAssetStatuses.ingesting,
        lineage: request.lineage,
      });

      const created = await this.dependencies.imageAssetRepository.createImageAsset(imageAsset, {
        operationKey: request.operationKey,
        actorUserId: request.actorUserId,
        occurredAt,
        correlationId: request.correlationId,
      });

      const reservation = await this.dependencies.imageAssetStoragePort.reserveStorageLocation({
        workspaceId: request.workspaceId,
        assetId: created.imageAsset.assetId,
        actorUserId: request.actorUserId,
        storageInstanceId: created.imageAsset.storageInstanceId,
        area: request.uploadArea ?? StorageObjectAreas.original,
        normalizedFileName: created.imageAsset.normalizedFilename,
        mediaType: created.imageAsset.mediaType,
        contentDigest: created.imageAsset.fingerprint.digest,
        occurredAt,
      });

      return {
        ok: true,
        value: Object.freeze({
          imageAsset: created.imageAsset,
          upload: Object.freeze({
            status: "upload-pending" as const,
            reservation,
          }),
        }),
      };
    } catch (error) {
      if (isDuplicateError(error)) {
        return this.failure(
          ImageAssetCreationErrorCodes.conflict,
          "Image asset already exists.",
        );
      }
      if (error instanceof ImageAssetDomainError) {
        return this.failure(
          ImageAssetCreationErrorCodes.invalidRequest,
          error.message,
        );
      }
      return this.failure(
        ImageAssetCreationErrorCodes.internal,
        error instanceof Error ? error.message : "Image asset creation failed.",
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

  private resolveVisibility(
    requestedVisibility: ResourceVisibility | undefined,
    ownerUserId: string | undefined,
  ): ResourceVisibility {
    if (requestedVisibility) {
      return requestedVisibility;
    }
    return ownerUserId ? ResourceVisibilities.private : ResourceVisibilities.workspace;
  }

  private async evaluateCreatePolicy(
    request: InitiateImageAssetCreationRequest,
    occurredAt: string,
  ): Promise<{ readonly allowed: boolean; readonly reasonCode: string; readonly evaluatedAt: string; readonly message?: string }> {
    const evaluator = this.dependencies.authorizationPolicyDecisionEvaluator;
    if (!evaluator) {
      return {
        allowed: true,
        reasonCode: "image-asset-create-policy-evaluator-not-configured",
        evaluatedAt: occurredAt,
      };
    }

    const decision = await evaluator.evaluateDecision(
      toImageAssetPolicyDecisionEvaluationRequest({
        action: ImageAssetAccessActions.create,
        actor: {
          actorUserIdentityId: request.actorUserId,
          activeWorkspaceId: request.workspaceId,
        },
        workspaceId: request.workspaceId,
        asOf: occurredAt,
      }),
    );

    return {
      allowed: decision.decision.isAllowed,
      reasonCode: decision.decision.reasonCode,
      evaluatedAt: decision.decision.evaluatedAt,
      message: decision.decision.reason,
    };
  }

  private async resolveStorageInstance(input: {
    readonly requestedStorageInstanceId?: string;
    readonly workspaceId: string;
    readonly actorUserId: string;
    readonly sizeBytes: number;
    readonly occurredAt: string;
  }): Promise<ImageAssetCreationResult<never> | { readonly ok: true; readonly value: StorageInstance }> {
    if (input.requestedStorageInstanceId) {
      const specific = await this.dependencies.storageInstanceRepository.findStorageInstanceById(
        input.requestedStorageInstanceId,
      );
      if (!specific || specific.ownership.workspaceId !== input.workspaceId) {
        return this.failure(
          ImageAssetCreationErrorCodes.notFound,
          "Storage instance was not found for the workspace.",
        );
      }
      const eligibility = await this.assertStorageEligibility(specific, input);
      if (!eligibility.ok) {
        return eligibility;
      }
      return { ok: true, value: specific };
    }

    const candidates = await this.dependencies.storageInstanceRepository.listStorageInstances({
      workspaceId: input.workspaceId,
      lifecycleStates: [StorageLifecycleStates.active],
      accessModes: [StorageAccessModes.readWrite, StorageAccessModes.appendOnly],
    });

    const sortedCandidates = [...candidates].sort((left, right) => left.id.localeCompare(right.id));

    for (const candidate of sortedCandidates) {
      const eligibility = await this.assertStorageEligibility(candidate, input);
      if (eligibility.ok) {
        return {
          ok: true,
          value: candidate,
        };
      }
    }

    if (sortedCandidates.length === 0) {
      return this.failure(
        ImageAssetCreationErrorCodes.notFound,
        "No active storage instance is available for this workspace.",
      );
    }

    return this.failure(
      ImageAssetCreationErrorCodes.policyViolation,
      "No eligible storage instance allows image asset ingestion for this request.",
    );
  }

  private async assertStorageEligibility(
    storageInstance: StorageInstance,
    input: {
      readonly workspaceId: string;
      readonly actorUserId: string;
      readonly sizeBytes: number;
      readonly occurredAt: string;
    },
  ): Promise<ImageAssetCreationResult<never> | { readonly ok: true }> {
    if (storageInstance.ownership.workspaceId !== input.workspaceId) {
      return this.failure(
        ImageAssetCreationErrorCodes.notFound,
        "Storage instance was not found for the workspace.",
      );
    }
    if (storageInstance.lifecycleState !== StorageLifecycleStates.active) {
      return this.failure(
        ImageAssetCreationErrorCodes.invalidState,
        "Storage instance must be active.",
      );
    }
    if (storageInstance.access.mode === StorageAccessModes.readOnly) {
      return this.failure(
        ImageAssetCreationErrorCodes.invalidState,
        "Storage instance is read-only.",
      );
    }

    const policyDecision = await this.dependencies.storagePolicyEvaluationPort.evaluateStorageAction({
      action: StoragePolicyActions.useForAssets,
      actorUserIdentityId: input.actorUserId,
      workspaceId: input.workspaceId,
      storageInstance,
      occurredAt: input.occurredAt,
    });

    if (!policyDecision.allowed) {
      return this.failure(
        ImageAssetCreationErrorCodes.policyViolation,
        policyDecision.message ?? "Storage policy denied image asset ingestion usage.",
        Object.freeze({
          reasonCode: policyDecision.reasonCode,
          occurredAt: policyDecision.occurredAt,
          ...(policyDecision.details ?? {}),
        }),
      );
    }

    const maxObjectBytes = storageInstance.policy.maxObjectBytes;
    if (typeof maxObjectBytes === "number" && input.sizeBytes > maxObjectBytes) {
      return this.failure(
        ImageAssetCreationErrorCodes.policyViolation,
        "Image size exceeds storage policy maxObjectBytes.",
        Object.freeze({
          maxObjectBytes,
          requestedSizeBytes: input.sizeBytes,
        }),
      );
    }

    return { ok: true };
  }

  private failure(
    code: typeof ImageAssetCreationErrorCodes[keyof typeof ImageAssetCreationErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ImageAssetCreationResult<never> {
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        details,
      }),
    };
  }
}

function isDuplicateError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const normalized = error.message.toLowerCase();
  return normalized.includes("already exists") || normalized.includes("duplicate") || normalized.includes("conflict");
}
