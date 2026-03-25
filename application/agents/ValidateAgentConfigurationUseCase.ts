import {
  AgentConfigurationValidationService,
  type AgentConfigurationValidationInput,
  type AgentConfigurationValidationResult,
} from "./services/AgentConfigurationValidationService";

export class ValidateAgentConfigurationUseCase {
  constructor(
    private readonly validationService: AgentConfigurationValidationService = new AgentConfigurationValidationService(),
  ) {}

  public async execute(input: AgentConfigurationValidationInput): Promise<AgentConfigurationValidationResult> {
    return this.validationService.validate(input);
  }
}
