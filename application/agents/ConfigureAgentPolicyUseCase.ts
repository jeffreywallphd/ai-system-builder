import { toAgentReadModel, updateAgent, type AgentReadModel } from "../../domain/agents/Agent";
import {
  applyAgentPolicyConfiguration,
  type AgentPolicyConfigurationOperation,
} from "../../domain/agents/AgentPolicyConfiguration";
import type { AgentPolicy } from "../../domain/agents/AgentPolicy";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";
import { AgentInvalidRequestError, AgentNotFoundError } from "./AgentAuthoringErrors";
import {
  AgentConfigurationValidationService,
  toAgentConfigurationValidationInput,
} from "./services/AgentConfigurationValidationService";

export interface ConfigureAgentPolicyRequest {
  readonly agentId: string;
  readonly policy?: AgentPolicy;
  readonly operations?: ReadonlyArray<AgentPolicyConfigurationOperation>;
}

export class ConfigureAgentPolicyUseCase {
  constructor(
    private readonly repository: IAgentRepository,
    private readonly validationService: AgentConfigurationValidationService = new AgentConfigurationValidationService(),
  ) {}

  public async execute(requestOrAgentId: ConfigureAgentPolicyRequest | string, policy?: AgentPolicy): Promise<AgentReadModel> {
    const request = this.normalizeRequest(requestOrAgentId, policy);
    const normalizedAgentId = request.agentId.trim();
    if (!normalizedAgentId) {
      throw new AgentInvalidRequestError("Agent id is required.");
    }
    const current = await this.repository.get(normalizedAgentId);
    if (!current) {
      throw new AgentNotFoundError(normalizedAgentId);
    }

    const nextPolicy = request.policy ?? applyAgentPolicyConfiguration(current.policy, request.operations ?? []);
    this.validationService.assertValidForUpdate(current.id, {
      ...toAgentConfigurationValidationInput(current),
      policy: nextPolicy,
    });
    const saved = await this.repository.save(updateAgent(current, { policy: nextPolicy }));
    return toAgentReadModel(saved);
  }

  private normalizeRequest(requestOrAgentId: ConfigureAgentPolicyRequest | string, policy?: AgentPolicy): ConfigureAgentPolicyRequest {
    if (typeof requestOrAgentId === "string") {
      if (!policy) {
        throw new AgentInvalidRequestError("Configure policy requires a policy payload.");
      }
      return Object.freeze({ agentId: requestOrAgentId, policy });
    }

    const hasPolicy = requestOrAgentId.policy !== undefined;
    const hasOperations = (requestOrAgentId.operations?.length ?? 0) > 0;
    if (hasPolicy === hasOperations) {
      throw new AgentInvalidRequestError("Configure policy request must include exactly one of policy or operations.");
    }

    return requestOrAgentId;
  }
}
