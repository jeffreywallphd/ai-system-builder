import type { IExecutionNodeRepository } from "../ports/ExecutionNodeManagementPorts";
import type { ExecutionNodeManagementAuthorizationHook } from "../ports/ExecutionNodeManagementAuthorizationPorts";
import {
  ExecutionNodeManagementUseCaseErrorCodes,
  type ExecutionNodeManagementUseCaseClock,
  type ExecutionNodeManagementUseCaseOutcome,
  normalizeRequired,
  toExecutionNodeInternalDetail,
  toExecutionNodeManagementFailure,
} from "./ExecutionNodeManagementUseCaseShared";

export interface GetExecutionNodeDetailUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
}

export interface GetExecutionNodeDetailUseCaseResponse {
  readonly node: ReturnType<typeof toExecutionNodeInternalDetail>;
  readonly asOf: string;
}

interface GetExecutionNodeDetailUseCaseDependencies {
  readonly nodeRepository: IExecutionNodeRepository;
  readonly authorizationHook?: ExecutionNodeManagementAuthorizationHook;
  readonly clock?: ExecutionNodeManagementUseCaseClock;
}

export class GetExecutionNodeDetailUseCase {
  private readonly clock: ExecutionNodeManagementUseCaseClock;

  public constructor(private readonly dependencies: GetExecutionNodeDetailUseCaseDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: GetExecutionNodeDetailUseCaseRequest,
  ): Promise<ExecutionNodeManagementUseCaseOutcome<GetExecutionNodeDetailUseCaseResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const nodeId = normalizeRequired(request.nodeId);
    if (!nodeId) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
        "nodeId is required.",
      );
    }

    try {
      await this.dependencies.authorizationHook?.assertCanGetExecutionNodeDetail?.({
        actorUserIdentityId,
        nodeId,
      });
    } catch (error) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to read execution-node detail.",
      );
    }

    const node = await this.dependencies.nodeRepository.findExecutionNodeById(nodeId);
    if (!node) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.notFound,
        `Execution node '${nodeId}' was not found.`,
      );
    }

    return {
      ok: true,
      value: Object.freeze({
        node: toExecutionNodeInternalDetail(node),
        asOf: this.clock.now().toISOString(),
      }),
    };
  }
}
