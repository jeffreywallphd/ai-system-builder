import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import type { IGeneratedResultPersistenceRepository } from "../ports/IGeneratedResultPersistenceRepository";
import {
  canViewGeneratedResultRecord,
  toGeneratedResultMetadataDetail,
} from "./GeneratedResultMetadataProjection";
import {
  GeneratedResultMetadataReadErrorCodes,
  validateGetGeneratedResultMetadataRequest,
  type GeneratedResultMetadataReadResult,
  type GetGeneratedResultMetadataRequest,
  type GetGeneratedResultMetadataSuccess,
  type IGetGeneratedResultMetadataUseCase,
} from "./GeneratedResultMetadataReadUseCaseContracts";

export interface GetGeneratedResultMetadataUseCaseDependencies {
  readonly generatedResultRepository: IGeneratedResultPersistenceRepository;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly clock?: {
    now(): Date;
  };
}

export class GetGeneratedResultMetadataUseCase implements IGetGeneratedResultMetadataUseCase {
  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: GetGeneratedResultMetadataUseCaseDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: GetGeneratedResultMetadataRequest,
  ): Promise<GeneratedResultMetadataReadResult<GetGeneratedResultMetadataSuccess>> {
    let request: GetGeneratedResultMetadataRequest;
    try {
      request = validateGetGeneratedResultMetadataRequest(input);
    } catch (error) {
      return this.failure(
        GeneratedResultMetadataReadErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid generated-result metadata request.",
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
        GeneratedResultMetadataReadErrorCodes.accessDenied,
        "Generated-result metadata lookup requires active workspace membership.",
      );
    }

    const result = await this.dependencies.generatedResultRepository.findResultById(request.resultAssetId);
    if (!result || result.workspaceId !== request.workspaceId) {
      return this.failure(
        GeneratedResultMetadataReadErrorCodes.notFound,
        "Generated result was not found for the workspace.",
      );
    }

    if (!canViewGeneratedResultRecord({
      record: result,
      actorUserId: request.actorUserId,
      isWorkspaceAdmin: workspaceAuthorization.isWorkspaceAdmin,
    })) {
      return this.failure(
        GeneratedResultMetadataReadErrorCodes.notFound,
        "Generated result was not found for the workspace.",
      );
    }

    const [previews, lineage] = await Promise.all([
      this.dependencies.generatedResultRepository.listPreviewsByResultId(result.resultAssetId),
      this.dependencies.generatedResultRepository.getLineageByResultId(result.resultAssetId),
    ]);

    return {
      ok: true,
      value: Object.freeze({
        result: toGeneratedResultMetadataDetail({
          record: result,
          previews,
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
    code: typeof GeneratedResultMetadataReadErrorCodes[keyof typeof GeneratedResultMetadataReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): GeneratedResultMetadataReadResult<never> {
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
