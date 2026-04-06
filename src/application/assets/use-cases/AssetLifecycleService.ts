import {
  AssetDomainError,
  AssetLifecycleStates,
  transitionAssetLifecycle,
} from "../../../domain/assets/AssetDomain";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
} from "../../../domain/workspaces/WorkspaceDomain";
import type { IWorkspaceAuthorizationReadRepository } from "../../workspaces/ports/IWorkspaceAuthorizationReadRepository";
import {
  publishAssetAuditEventBestEffort,
  type AssetAuditSink,
} from "../ports/AssetAuditPort";
import type { IAssetRepository } from "../ports/IAssetRepository";
import {
  AssetServiceErrorCodes,
  validateArchiveAssetRequest,
  validateDeleteAssetRequest,
  type ArchiveAssetRequest,
  type AssetServiceResult,
  type DeleteAssetRequest,
  type RegisterAssetResult,
} from "./AssetServiceContracts";

export interface AssetLifecycleServiceDependencies {
  readonly repository: IAssetRepository;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly auditSink?: AssetAuditSink;
  readonly clock?: {
    now(): Date;
  };
}

export class AssetLifecycleService {
  private readonly clock: { now(): Date };

  public constructor(private readonly dependencies: AssetLifecycleServiceDependencies) {
    this.clock = dependencies.clock ?? { now: () => new Date() };
  }

  public async archiveAsset(input: ArchiveAssetRequest): Promise<AssetServiceResult<RegisterAssetResult>> {
    let request: ArchiveAssetRequest;
    try {
      request = validateArchiveAssetRequest(input);
    } catch (error) {
      return this.failure(
        AssetServiceErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid request.",
      );
    }

    return this.transitionLifecycle({
      request,
      action: "archive",
      nextState: AssetLifecycleStates.archived,
      eventType: "asset-archived",
    });
  }

  public async deleteAsset(input: DeleteAssetRequest): Promise<AssetServiceResult<RegisterAssetResult>> {
    let request: DeleteAssetRequest;
    try {
      request = validateDeleteAssetRequest(input);
    } catch (error) {
      return this.failure(
        AssetServiceErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid request.",
      );
    }

    return this.transitionLifecycle({
      request,
      action: "delete",
      nextState: AssetLifecycleStates.deleted,
      eventType: "asset-deleted",
    });
  }

  private async transitionLifecycle(input: {
    readonly request: ArchiveAssetRequest | DeleteAssetRequest;
    readonly action: "archive" | "delete";
    readonly nextState: typeof AssetLifecycleStates[keyof typeof AssetLifecycleStates];
    readonly eventType: "asset-archived" | "asset-deleted";
  }): Promise<AssetServiceResult<RegisterAssetResult>> {
    const occurredAt = input.request.occurredAt ?? this.clock.now().toISOString();
    const authorization = await this.resolveWorkspaceAuthorization(
      input.request.workspaceId,
      input.request.actorUserId,
      occurredAt,
    );
    if (!authorization.isAuthorized) {
      await this.publishLifecycleRejectedAuditEvent({
        request: input.request,
        eventType: input.eventType,
        occurredAt,
        reasonCode: AssetServiceErrorCodes.accessDenied,
      });
      return this.failure(
        AssetServiceErrorCodes.accessDenied,
        `Asset ${input.action} requires active workspace membership.`,
      );
    }

    const asset = await this.dependencies.repository.findAssetById(input.request.assetId);
    if (!asset || asset.ownership.workspaceId !== input.request.workspaceId) {
      await this.publishLifecycleRejectedAuditEvent({
        request: input.request,
        eventType: input.eventType,
        occurredAt,
        reasonCode: AssetServiceErrorCodes.notFound,
      });
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for the workspace.");
    }

    const canMutate = authorization.isWorkspaceAdmin || asset.ownership.ownerUserId === input.request.actorUserId;
    if (!canMutate) {
      await this.publishLifecycleRejectedAuditEvent({
        request: input.request,
        eventType: input.eventType,
        occurredAt,
        reasonCode: AssetServiceErrorCodes.accessDenied,
      });
      return this.failure(
        AssetServiceErrorCodes.accessDenied,
        `Asset ${input.action} requires asset ownership or workspace administrator permissions.`,
      );
    }

    if (asset.lifecycle.state === input.nextState) {
      await this.publishAuditEvent({
        type: input.eventType,
        occurredAt,
        workspaceId: input.request.workspaceId,
        actorUserId: input.request.actorUserId,
        correlationId: input.request.correlationId,
        operationKey: input.request.operationKey,
        outcome: "already-applied",
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
    }

    if (
      input.action === "archive"
      && asset.lifecycle.state !== AssetLifecycleStates.active
    ) {
      await this.publishLifecycleRejectedAuditEvent({
        request: input.request,
        eventType: input.eventType,
        occurredAt,
        reasonCode: AssetServiceErrorCodes.invalidState,
      });
      return this.failure(AssetServiceErrorCodes.invalidState, "Only active assets can be archived.");
    }

    try {
      const updatedAsset = transitionAssetLifecycle(asset, input.nextState, {
        actorUserId: input.request.actorUserId,
        occurredAt,
      });
      await this.dependencies.repository.saveAsset(updatedAsset);
      await this.publishAuditEvent({
        type: input.eventType,
        occurredAt,
        workspaceId: input.request.workspaceId,
        actorUserId: input.request.actorUserId,
        correlationId: input.request.correlationId,
        operationKey: input.request.operationKey,
        outcome: "success",
        asset: {
          assetId: updatedAsset.id,
          kind: updatedAsset.kind,
          visibility: updatedAsset.visibility,
          lifecycleState: updatedAsset.lifecycle.state,
          versionId: updatedAsset.currentVersionId,
        },
      });

      return {
        ok: true,
        value: Object.freeze({ asset: updatedAsset }),
      };
    } catch (error) {
      await this.publishLifecycleRejectedAuditEvent({
        request: input.request,
        eventType: input.eventType,
        occurredAt,
        reasonCode: AssetServiceErrorCodes.invalidState,
      });

      if (error instanceof AssetDomainError) {
        return this.failure(AssetServiceErrorCodes.invalidState, error.message);
      }
      return this.failure(
        AssetServiceErrorCodes.internal,
        error instanceof Error ? error.message : `Asset ${input.action} failed.`,
      );
    }
  }

  private async publishLifecycleRejectedAuditEvent(input: {
    readonly request: ArchiveAssetRequest | DeleteAssetRequest;
    readonly eventType: "asset-archived" | "asset-deleted";
    readonly occurredAt: string;
    readonly reasonCode: string;
  }): Promise<void> {
    await this.publishAuditEvent({
      type: input.eventType,
      occurredAt: input.occurredAt,
      workspaceId: input.request.workspaceId,
      actorUserId: input.request.actorUserId,
      correlationId: input.request.correlationId,
      operationKey: input.request.operationKey,
      outcome: "rejected",
      asset: {
        assetId: input.request.assetId,
      },
      details: Object.freeze({
        reasonCode: input.reasonCode,
      }),
    });
  }

  private async publishAuditEvent(event: Parameters<AssetAuditSink["recordAssetEvent"]>[0]): Promise<void> {
    await publishAssetAuditEventBestEffort(this.dependencies.auditSink, event);
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
}
