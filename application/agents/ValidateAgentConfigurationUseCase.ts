import {
  type AgentConfigurationValidationOptions,
  AgentConfigurationValidationService,
  type AgentConfigurationValidationInput,
  type AgentConfigurationValidationResult,
} from "./services/AgentConfigurationValidationService";

export class ValidateAgentConfigurationUseCase {
  constructor(
    private readonly validationService: AgentConfigurationValidationService = new AgentConfigurationValidationService(),
  ) {}

  public async execute(
    input: AgentConfigurationValidationInput,
    options?: AgentConfigurationValidationOptions,
  ): Promise<AgentConfigurationValidationResult> {
    return this.validationService.validate(input, options);
  }
}
