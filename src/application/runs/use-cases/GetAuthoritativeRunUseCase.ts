import type { IAuthoritativeRunPersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type { RunDetail } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import { toRunDetailFromPlatformRecord } from "./RunCreationPersistenceMapper";

export interface GetAuthoritativeRunRequest {
  readonly runId: string;
  readonly workspaceId?: string;
}

export class GetAuthoritativeRunUseCase {
  public constructor(private readonly runRepository: IAuthoritativeRunPersistenceRepository) {}

  public async execute(input: GetAuthoritativeRunRequest): Promise<RunDetail | undefined> {
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

    return toRunDetailFromPlatformRecord(record);
  }
}
