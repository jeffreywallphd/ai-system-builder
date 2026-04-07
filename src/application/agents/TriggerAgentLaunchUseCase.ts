import type { AgentLaunchReadModel, AgentRunRequest, AgentRunTrigger } from "./contracts/AgentRunContracts";
import { AgentTriggerKinds } from "./contracts/AgentRunContracts";
import { AgentRuntimeInvalidRequestError } from "./AgentRuntimeErrors";
import { LaunchAgentUseCase } from "./LaunchAgentUseCase";

export interface TriggerAgentLaunchRequest {
  readonly agentId: string;
  readonly trigger: AgentRunTrigger;
  readonly input?: AgentRunRequest["input"];
  readonly contextOverrides?: AgentRunRequest["contextOverrides"];
  readonly metadata?: AgentRunRequest["metadata"];
}

export class TriggerAgentLaunchUseCase {
  constructor(private readonly launchUseCase: LaunchAgentUseCase) {}

  public async execute(request: TriggerAgentLaunchRequest): Promise<AgentLaunchReadModel> {
    if (!request.trigger) {
      throw new AgentRuntimeInvalidRequestError("Agent trigger launch request requires a trigger.");
    }
    if (!Object.values(AgentTriggerKinds).includes(request.trigger.kind)) {
      throw new AgentRuntimeInvalidRequestError(`Agent trigger kind '${String(request.trigger.kind)}' is not supported.`);
    }

    return this.launchUseCase.execute({
      agentId: request.agentId,
      trigger: request.trigger,
      input: request.input,
      contextOverrides: request.contextOverrides,
      metadata: request.metadata,
    });
  }
}
