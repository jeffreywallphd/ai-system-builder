import type { Agent, AgentReadModel } from "../../../domain/agents/Agent";
import type { AgentMemoryConfiguration } from "../../../domain/agents/AgentMemory";
import type { AgentToolAccessPolicy, AgentPolicy } from "../../../domain/agents/AgentPolicy";
import type { IAgentRepository } from "../../../application/ports/interfaces/IAgentRepository";
import { CreateAgentUseCase, type CreateAgentRequest } from "../../../application/agents/CreateAgentUseCase";
import { UpdateAgentUseCase, type UpdateAgentRequest } from "../../../application/agents/UpdateAgentUseCase";
import { GetAgentUseCase } from "../../../application/agents/GetAgentUseCase";
import { ListAgentsUseCase } from "../../../application/agents/ListAgentsUseCase";
import { DeleteAgentUseCase } from "../../../application/agents/DeleteAgentUseCase";
import { ArchiveAgentUseCase } from "../../../application/agents/ArchiveAgentUseCase";
import { ConfigureAgentGoalsUseCase, type ConfigureAgentGoalsRequest } from "../../../application/agents/ConfigureAgentGoalsUseCase";
import { ConfigureAgentPolicyUseCase } from "../../../application/agents/ConfigureAgentPolicyUseCase";
import { ConfigureAgentToolsUseCase } from "../../../application/agents/ConfigureAgentToolsUseCase";
import { ConfigureAgentMemoryUseCase } from "../../../application/agents/ConfigureAgentMemoryUseCase";
import { ConfigureAgentStrategyUseCase } from "../../../application/agents/ConfigureAgentStrategyUseCase";
import { ValidateAgentConfigurationUseCase } from "../../../application/agents/ValidateAgentConfigurationUseCase";
import { AgentAuthoringError } from "../../../application/agents/AgentAuthoringErrors";
import {
  AgentConfigurationValidationService,
  type AgentConfigurationValidationInput,
  type AgentConfigurationValidationIssue,
  type AgentConfigurationValidationResult,
} from "../../../application/agents/services/AgentConfigurationValidationService";
import { AgentConfigurationValidationError } from "../../../application/agents/services/AgentConfigurationValidationError";
import type { AgentPlanningStrategy } from "../../../domain/agents/Agent";
import type { CompositionTaxonomyDescriptor } from "../../../domain/taxonomy/CompositionTaxonomy";
import type { AssetContractDescriptor } from "../../../domain/contracts/AssetContract";
import { CompositionTaxonomyClassifier } from "../../../application/taxonomy/CompositionTaxonomyClassifier";
import { CompositionAssetContractResolver } from "../../../application/contracts/CompositionAssetContractResolver";

export interface AgentAuthoringApiError {
  readonly code: "not-found" | "conflict" | "invalid-request" | "validation-failed" | "internal";
  readonly message: string;
  readonly validationIssues?: ReadonlyArray<AgentConfigurationValidationIssue>;
}

export interface AgentAuthoringApiResponse<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: AgentAuthoringApiError;
}

export interface AgentAuthoringApiReadModel {
  readonly agent: AgentReadModel;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly contract?: AssetContractDescriptor;
}

export class AgentAuthoringBackendApi {
  private readonly repository: IAgentRepository;
  private readonly createUseCase: CreateAgentUseCase;
  private readonly updateUseCase: UpdateAgentUseCase;
  private readonly getUseCase: GetAgentUseCase;
  private readonly listUseCase: ListAgentsUseCase;
  private readonly deleteUseCase: DeleteAgentUseCase;
  private readonly archiveUseCase: ArchiveAgentUseCase;
  private readonly configureGoalsUseCase: ConfigureAgentGoalsUseCase;
  private readonly configurePolicyUseCase: ConfigureAgentPolicyUseCase;
  private readonly configureToolsUseCase: ConfigureAgentToolsUseCase;
  private readonly configureMemoryUseCase: ConfigureAgentMemoryUseCase;
  private readonly configureStrategyUseCase: ConfigureAgentStrategyUseCase;
  private readonly validateUseCase: ValidateAgentConfigurationUseCase;
  private readonly taxonomyClassifier: CompositionTaxonomyClassifier;
  private readonly contractResolver: CompositionAssetContractResolver;

  constructor(repository: IAgentRepository) {
    this.repository = repository;
    const validationService = new AgentConfigurationValidationService();
    this.taxonomyClassifier = new CompositionTaxonomyClassifier();
    this.contractResolver = new CompositionAssetContractResolver({ agentRepository: repository });
    this.createUseCase = new CreateAgentUseCase(repository, validationService);
    this.updateUseCase = new UpdateAgentUseCase(repository, validationService);
    this.getUseCase = new GetAgentUseCase(repository);
    this.listUseCase = new ListAgentsUseCase(repository);
    this.deleteUseCase = new DeleteAgentUseCase(repository);
    this.archiveUseCase = new ArchiveAgentUseCase(repository);
    this.configureGoalsUseCase = new ConfigureAgentGoalsUseCase(repository, validationService);
    this.configurePolicyUseCase = new ConfigureAgentPolicyUseCase(repository, validationService);
    this.configureToolsUseCase = new ConfigureAgentToolsUseCase(repository, validationService);
    this.configureMemoryUseCase = new ConfigureAgentMemoryUseCase(repository, validationService);
    this.configureStrategyUseCase = new ConfigureAgentStrategyUseCase(repository, validationService);
    this.validateUseCase = new ValidateAgentConfigurationUseCase(validationService);
  }

  public async createAgent(request: CreateAgentRequest): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> {
    return this.wrap(async () => this.toApiReadModel(await this.createUseCase.execute(request)));
  }

  public async updateAgent(request: UpdateAgentRequest): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> {
    return this.wrap(async () => this.toApiReadModel(await this.updateUseCase.execute(request)));
  }

  public async getAgent(agentId: string): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel | undefined>> {
    return this.wrap(async () => {
      const readModel = await this.getUseCase.execute(agentId);
      return readModel ? this.toApiReadModel(readModel) : undefined;
    });
  }

  public async listAgents(includeArchived = true): Promise<AgentAuthoringApiResponse<ReadonlyArray<AgentAuthoringApiReadModel>>> {
    return this.wrap(async () => {
      const readModels = await this.listUseCase.execute({ includeArchived });
      return Object.freeze(await Promise.all(readModels.map((readModel) => this.toApiReadModel(readModel))));
    });
  }

  public async deleteAgent(agentId: string): Promise<AgentAuthoringApiResponse<{ readonly deleted: boolean }>> {
    return this.wrap(async () => Object.freeze({ deleted: await this.deleteUseCase.execute(agentId) }));
  }

  public async archiveAgent(agentId: string): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> {
    return this.wrap(async () => this.toApiReadModel(await this.archiveUseCase.execute(agentId)));
  }

  public async configureGoals(request: ConfigureAgentGoalsRequest): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> {
    return this.wrap(async () => this.toApiReadModel(await this.configureGoalsUseCase.execute(request)));
  }

  public async configurePolicy(
    agentId: string,
    policy: AgentPolicy,
  ): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> {
    return this.wrap(async () => this.toApiReadModel(await this.configurePolicyUseCase.execute(agentId, policy)));
  }

  public async configureTools(
    agentId: string,
    toolAccess: AgentToolAccessPolicy,
  ): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> {
    return this.wrap(async () => this.toApiReadModel(await this.configureToolsUseCase.execute(agentId, toolAccess)));
  }

  public async configureMemory(
    agentId: string,
    memory: AgentMemoryConfiguration,
  ): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> {
    return this.wrap(async () => this.toApiReadModel(await this.configureMemoryUseCase.execute(agentId, memory)));
  }

  public async configureStrategy(
    agentId: string,
    planningStrategy: AgentPlanningStrategy,
  ): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> {
    return this.wrap(async () => this.toApiReadModel(await this.configureStrategyUseCase.execute(agentId, planningStrategy)));
  }

  public async validateConfiguration(
    request: AgentConfigurationValidationInput,
  ): Promise<AgentAuthoringApiResponse<AgentConfigurationValidationResult>> {
    return this.wrap(() => this.validateUseCase.execute(request));
  }

  private async wrap<T>(action: () => Promise<T>): Promise<AgentAuthoringApiResponse<T>> {
    try {
      return Object.freeze({
        ok: true,
        data: await action(),
      });
    } catch (error) {
      return Object.freeze({
        ok: false,
        error: this.toApiError(error),
      });
    }
  }

  private toApiError(error: unknown): AgentAuthoringApiError {
    if (error instanceof AgentConfigurationValidationError) {
      return Object.freeze({
        code: "validation-failed",
        message: error.message,
        validationIssues: error.issues,
      });
    }
    if (error instanceof AgentAuthoringError) {
      if (error.code === "agent-conflict") {
        return Object.freeze({ code: "conflict", message: error.message });
      }
      if (error.code === "agent-not-found") {
        return Object.freeze({ code: "not-found", message: error.message });
      }
      if (error.code === "agent-invalid-request") {
        return Object.freeze({ code: "invalid-request", message: error.message });
      }
    }
    const message = error instanceof Error ? error.message : "Unexpected backend error.";
    if (message.includes("not found") || message.includes("was not found")) {
      return Object.freeze({ code: "not-found", message });
    }
    if (message.includes("required") || message.includes("malformed") || message.includes("invalid")) {
      return Object.freeze({ code: "invalid-request", message });
    }
    return Object.freeze({ code: "internal", message });
  }

  private async toApiReadModel(readModel: AgentReadModel): Promise<AgentAuthoringApiReadModel> {
    const agent = await this.repository.get(readModel.id);
    const taxonomy = this.taxonomyClassifier.classifyAgent(this.requireAgentForProjection(readModel.id, agent));
    const contract = await this.contractResolver.resolveAgentContractById(readModel.id);
    return Object.freeze({
      agent: readModel,
      taxonomy,
      contract,
    });
  }

  private requireAgentForProjection(agentId: string, agent: Agent | undefined): Agent {
    if (agent) {
      return agent;
    }
    throw new Error(`Agent '${agentId}' was not found while building API projection.`);
  }
}
