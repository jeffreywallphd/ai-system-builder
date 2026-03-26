import { CompositionAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import { CompositionTaxonomyClassifier } from "../taxonomy/CompositionTaxonomyClassifier";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";
import type { AgentRunnerService } from "./services/AgentRunnerService";
import {
  createAgentRuntimeBinding,
  toAgentLaunchReadModel,
  type AgentLaunchReadModel,
  type AgentRunRequest,
} from "./contracts/AgentRunContracts";
import {
  AgentRuntimeInvalidRequestError,
  AgentRuntimeNotFoundError,
} from "./AgentRuntimeErrors";

export class LaunchAgentUseCase {
  constructor(
    private readonly repository: IAgentRepository,
    private readonly runner: AgentRunnerService,
    private readonly taxonomyClassifier: CompositionTaxonomyClassifier = new CompositionTaxonomyClassifier(),
    private readonly contractResolver: CompositionAssetContractResolver = new CompositionAssetContractResolver(),
  ) {}

  public async execute(request: AgentRunRequest): Promise<AgentLaunchReadModel> {
    const agentId = request.agentId.trim();
    if (!agentId) {
      throw new AgentRuntimeInvalidRequestError("Agent run request agentId is required.");
    }

    const agent = await this.repository.get(agentId);
    if (!agent) {
      throw new AgentRuntimeNotFoundError("agent", agentId);
    }

    let binding;
    try {
      binding = createAgentRuntimeBinding({ agent, request });
    } catch (error) {
      throw new AgentRuntimeInvalidRequestError((error as Error).message);
    }

    const result = await this.runner.run({
      agent,
      onProgress: undefined,
    });

    return toAgentLaunchReadModel({
      binding,
      result,
      taxonomy: this.taxonomyClassifier.classifyAgent(agent),
      contract: this.contractResolver.resolveAgentContract(agent),
    });
  }
}
