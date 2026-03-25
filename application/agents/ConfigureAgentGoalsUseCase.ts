import { toAgentReadModel, updateAgent, type AgentReadModel } from "../../domain/agents/Agent";
import {
  applyAgentGoalConfiguration,
  type AgentGoalConfigurationOperation,
} from "../../domain/agents/AgentGoalConfiguration";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";
import {
  AgentConfigurationValidationService,
  toAgentConfigurationValidationInput,
} from "./services/AgentConfigurationValidationService";

export interface ConfigureAgentGoalsRequest {
  readonly agentId: string;
  readonly operations: ReadonlyArray<AgentGoalConfigurationOperation>;
}

export class ConfigureAgentGoalsUseCase {
  constructor(
    private readonly repository: IAgentRepository,
    private readonly validationService: AgentConfigurationValidationService = new AgentConfigurationValidationService(),
  ) {}

  public async execute(request: ConfigureAgentGoalsRequest): Promise<AgentReadModel> {
    const agentId = request.agentId.trim();
    const current = await this.repository.get(agentId);
    if (!current) {
      throw new Error(`Agent '${agentId}' was not found.`);
    }

    const goals = applyAgentGoalConfiguration(current.goals, request.operations);
    this.validationService.assertValidForUpdate(current.id, {
      ...toAgentConfigurationValidationInput(current),
      goals,
    });
    const saved = await this.repository.save(updateAgent(current, { goals }));
    return toAgentReadModel(saved);
  }
}
