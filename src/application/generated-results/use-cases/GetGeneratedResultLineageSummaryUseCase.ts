import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import type { IGeneratedResultPersistenceRepository } from "../ports/IGeneratedResultPersistenceRepository";
import { canViewGeneratedResultRecord } from "./GeneratedResultMetadataProjection";
import { toGeneratedResultLineageSummaryDto } from "./GeneratedResultLineageProjection";
import {
  GeneratedResultLineageReadErrorCodes,
  validateGetGeneratedResultLineageRequest,
  type GeneratedResultLineageReadResult,
  type GetGeneratedResultLineageRequest,
  type GetGeneratedResultLineageSummarySuccess,
  type IGetGeneratedResultLineageSummaryUseCase,
} from "./GeneratedResultLineageReadUseCaseContracts";

export interface GetGeneratedResultLineageSummaryUseCaseDependencies {
  readonly generatedResultRepository: IGeneratedResultPersistenceRepository;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly clock?: {
    now(): Date;
  };
}

export class GetGeneratedResultLineageSummaryUseCase implements IGetGeneratedResultLineageSummaryUseCase {
  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: GetGeneratedResultLineageSummaryUseCaseDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: GetGeneratedResultLineageRequest,
  ): Promise<GeneratedResultLineageReadResult<GetGeneratedResultLineageSummarySuccess>> {
    let request: GetGeneratedResultLineageRequest;
    try {
      request = validateGetGeneratedResultLineageRequest(input);
    } catch (error) {
      return this.failure(
        GeneratedResultLineageReadErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid generated-result lineage summary request.",
      );
    }

    const occurredAt = request.occurredAt ?? this.clock.now().toISOString();
    const workspaceAuthorization = await this.resolveWorkspaceAuthorization(
      request.workspaceId,
      request.actorUserId,
      occurredAt,
    );
    if (!workspaceAuthorization.isAuthorized) {
      return this.failure(
        GeneratedResultLineageReadErrorCodes.accessDenied,
        "Generated-result lineage summary lookup requires active workspace membership.",
      );
    }

    const record = await this.dependencies.generatedResultRepository.findResultById(request.resultAssetId);
    if (!record || record.workspaceId !== request.workspaceId) {
      return this.failure(
        GeneratedResultLineageReadErrorCodes.notFound,
        "Generated result was not found for the workspace.",
      );
    }
    if (!canViewGeneratedResultRecord({
      record,
      actorUserId: request.actorUserId,
      isWorkspaceAdmin: workspaceAuthorization.isWorkspaceAdmin,
    })) {
      return this.failure(
        GeneratedResultLineageReadErrorCodes.notFound,
        "Generated result was not found for the workspace.",
      );
    }

    const lineage = await this.dependencies.generatedResultRepository.getLineageByResultId(record.resultAssetId);
    return {
      ok: true,
      value: Object.freeze({
        lineage: toGeneratedResultLineageSummaryDto({
          record,
          lineage,
        }),
      }),
    };
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
    code: typeof GeneratedResultLineageReadErrorCodes[keyof typeof GeneratedResultLineageReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): GeneratedResultLineageReadResult<never> {
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
