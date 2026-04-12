import type { IAuthoritativeRunPersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type {
  AuthoritativeRunReadAuthorizationActor,
  IAuthoritativeRunQueryAuthorizationPort,
} from "@application/runs/ports/RunQueryAuthorizationPorts";
import { toRunDetailWithHistoryHints, type RunDetailWithHistoryHints } from "./RunQueryHistoryProjection";

export interface GetAuthoritativeRunRequest {
  readonly runId: string;
  readonly workspaceId?: string;
  readonly authorization?: AuthoritativeRunReadAuthorizationActor;
}

export class GetAuthoritativeRunUseCase {
  public constructor(
    private readonly runRepository: IAuthoritativeRunPersistenceRepository,
    private readonly dependencies: {
      readonly authorization?: IAuthoritativeRunQueryAuthorizationPort;
    } = {},
  ) {}

  public async execute(input: GetAuthoritativeRunRequest): Promise<RunDetailWithHistoryHints | undefined> {
    const runId = input.runId.trim();
    if (!runId) {
      return undefined;
    }

    const record = await this.runRepository.findRunById(runId);
    if (!record) {
      return undefined;
    }

    if (input.workspaceId && record.workspaceId !== input.workspaceId) {
      return undefined;
    }

    if (this.dependencies.authorization) {
      const actorUserIdentityId = input.authorization?.actorUserIdentityId?.trim();
      if (!actorUserIdentityId) {
        return undefined;
      }

      const allowed = await this.dependencies.authorization.canReadRun({
        runId: record.runId,
        workspaceId: record.workspaceId,
        actor: Object.freeze({
          actorUserIdentityId,
          activeWorkspaceId: input.authorization?.activeWorkspaceId?.trim() || input.workspaceId?.trim(),
          authenticatedAt: input.authorization?.authenticatedAt?.trim() || undefined,
        }),
      });
      if (!allowed) {
        return undefined;
      }
    }

    return toRunDetailWithHistoryHints(record);
  }
}
