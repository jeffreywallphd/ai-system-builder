import type { AgentReadModel } from "../../../src/domain/agents/Agent";
import type { AgentMemoryConfiguration } from "../../../src/domain/agents/AgentMemory";
import type { AgentToolAccessPolicy, AgentPolicy } from "../../../src/domain/agents/AgentPolicy";
import type { AgentPlanningStrategy } from "../../../src/domain/agents/Agent";
import type { AgentConfigurationValidationInput, AgentConfigurationValidationIssue, AgentConfigurationValidationResult } from "../../../application/agents/services/AgentConfigurationValidationService";
import type { CreateAgentRequest } from "../../../application/agents/CreateAgentUseCase";
import type { UpdateAgentRequest } from "../../../application/agents/UpdateAgentUseCase";
import type { ConfigureAgentGoalsRequest } from "../../../application/agents/ConfigureAgentGoalsUseCase";
import type { AgentRunControlRequest, AgentLaunchReadModel, AgentSessionDetailReadModel, AgentSessionSummaryReadModel, AgentRunRequest } from "../../../application/agents/contracts/AgentRunContracts";
import type { TriggerAgentLaunchRequest } from "../../../application/agents/TriggerAgentLaunchUseCase";
import type { IAgentRepository } from "../../../application/ports/interfaces/IAgentRepository";
import type { IAgentExecutionSessionRepository } from "../../../application/ports/interfaces/IAgentExecutionSessionRepository";
import type { AgentRunnerService } from "../../../application/agents/services/AgentRunnerService";
import { AgentAuthoringBackendApi, type AgentAuthoringApiReadModel, type AgentAuthoringApiResponse } from "./AgentAuthoringBackendApi";
import { AgentRuntimeError } from "../../../application/agents/AgentRuntimeErrors";
import { LaunchAgentUseCase } from "../../../application/agents/LaunchAgentUseCase";
import { TriggerAgentLaunchUseCase } from "../../../application/agents/TriggerAgentLaunchUseCase";
import { ListAgentSessionsUseCase } from "../../../application/agents/ListAgentSessionsUseCase";
import { GetAgentSessionDetailUseCase } from "../../../application/agents/GetAgentSessionDetailUseCase";
import { ControlAgentRunUseCase } from "../../../application/agents/ControlAgentRunUseCase";
import { CompositionAssetContractResolver } from "../../../application/contracts/CompositionAssetContractResolver";

export interface AgentStudioApiError {
  readonly code:
    | "not-found"
    | "conflict"
    | "invalid-request"
    | "validation-failed"
    | "unsupported-control"
    | "invalid-control-state"
    | "unsupported-operation"
    | "internal";
  readonly message: string;
  readonly validationIssues?: ReadonlyArray<AgentConfigurationValidationIssue>;
}

export interface AgentStudioApiResponse<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: AgentStudioApiError;
}

export interface AgentStudioSnapshotReadModel {
  readonly agent: AgentAuthoringApiReadModel;
  readonly sessions: ReadonlyArray<AgentSessionSummaryReadModel>;
  readonly latestSession?: AgentSessionDetailReadModel;
  readonly capabilities: {
    readonly launch: boolean;
    readonly triggerLaunch: boolean;
    readonly controls: ReadonlyArray<AgentRunControlRequest["action"]>;
  };
}

export class AgentStudioBackendApi {
  private readonly authoringApi: AgentAuthoringBackendApi;
  private readonly launchUseCase?: LaunchAgentUseCase;
  private readonly triggerLaunchUseCase?: TriggerAgentLaunchUseCase;
  private readonly listSessionsUseCase: ListAgentSessionsUseCase;
  private readonly getSessionUseCase: GetAgentSessionDetailUseCase;
  private readonly controlRunUseCase: ControlAgentRunUseCase;

  constructor(
    repository: IAgentRepository,
    sessionRepository: IAgentExecutionSessionRepository,
    runner?: AgentRunnerService,
  ) {
    this.authoringApi = new AgentAuthoringBackendApi(repository);
    this.listSessionsUseCase = new ListAgentSessionsUseCase(sessionRepository);
    this.getSessionUseCase = new GetAgentSessionDetailUseCase(
      sessionRepository,
      undefined,
      new CompositionAssetContractResolver({ agentRepository: repository }),
    );
    this.controlRunUseCase = new ControlAgentRunUseCase(
      sessionRepository,
      undefined,
      new CompositionAssetContractResolver({ agentRepository: repository }),
    );
    if (runner) {
      this.launchUseCase = new LaunchAgentUseCase(
        repository,
        runner,
        undefined,
        new CompositionAssetContractResolver({ agentRepository: repository }),
      );
      this.triggerLaunchUseCase = new TriggerAgentLaunchUseCase(this.launchUseCase);
    }
  }

  public createAgent(request: CreateAgentRequest): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> { return this.authoringApi.createAgent(request); }
  public updateAgent(request: UpdateAgentRequest): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> { return this.authoringApi.updateAgent(request); }
  public getAgent(agentId: string): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel | undefined>> { return this.authoringApi.getAgent(agentId); }
  public listAgents(includeArchived = true): Promise<AgentAuthoringApiResponse<ReadonlyArray<AgentAuthoringApiReadModel>>> { return this.authoringApi.listAgents(includeArchived); }
  public deleteAgent(agentId: string): Promise<AgentAuthoringApiResponse<{ readonly deleted: boolean }>> { return this.authoringApi.deleteAgent(agentId); }
  public archiveAgent(agentId: string): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> { return this.authoringApi.archiveAgent(agentId); }
  public configureGoals(request: ConfigureAgentGoalsRequest): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> { return this.authoringApi.configureGoals(request); }
  public configurePolicy(agentId: string, policy: AgentPolicy): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> { return this.authoringApi.configurePolicy(agentId, policy); }
  public configureTools(agentId: string, toolAccess: AgentToolAccessPolicy): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> { return this.authoringApi.configureTools(agentId, toolAccess); }
  public configureMemory(agentId: string, memory: AgentMemoryConfiguration): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> { return this.authoringApi.configureMemory(agentId, memory); }
  public configureStrategy(agentId: string, planningStrategy: AgentPlanningStrategy): Promise<AgentAuthoringApiResponse<AgentAuthoringApiReadModel>> { return this.authoringApi.configureStrategy(agentId, planningStrategy); }
  public validateConfiguration(request: AgentConfigurationValidationInput): Promise<AgentAuthoringApiResponse<AgentConfigurationValidationResult>> { return this.authoringApi.validateConfiguration(request); }

  public async launchAgent(request: AgentRunRequest): Promise<AgentStudioApiResponse<AgentLaunchReadModel>> {
    if (!this.launchUseCase) {
      return this.unsupportedOperation("Agent launch is not configured in this host runtime.");
    }
    return this.wrap(() => this.launchUseCase!.execute(request));
  }

  public async triggerLaunch(request: TriggerAgentLaunchRequest): Promise<AgentStudioApiResponse<AgentLaunchReadModel>> {
    if (!this.triggerLaunchUseCase) {
      return this.unsupportedOperation("Trigger launch is not configured in this host runtime.");
    }
    return this.wrap(() => this.triggerLaunchUseCase!.execute(request));
  }

  public async listSessions(agentId: string): Promise<AgentStudioApiResponse<ReadonlyArray<AgentSessionSummaryReadModel>>> {
    return this.wrap(() => this.listSessionsUseCase.execute(agentId));
  }

  public async getSessionDetail(sessionId: string): Promise<AgentStudioApiResponse<AgentSessionDetailReadModel>> {
    return this.wrap(() => this.getSessionUseCase.execute(sessionId));
  }

  public async controlRun(request: AgentRunControlRequest): Promise<AgentStudioApiResponse<AgentSessionSummaryReadModel>> {
    return this.wrap(() => this.controlRunUseCase.execute(request));
  }

  public async getStudioSnapshot(agentId: string): Promise<AgentStudioApiResponse<AgentStudioSnapshotReadModel>> {
    const agentResponse = await this.getAgent(agentId);
    if (!agentResponse.ok) {
      return Object.freeze({ ok: false, error: agentResponse.error });
    }
    if (!agentResponse.data) {
      return Object.freeze({ ok: false, error: { code: "not-found", message: `Agent '${agentId}' was not found.` } });
    }
    const sessions = await this.listSessions(agentId);
    if (!sessions.ok) {
      return Object.freeze({ ok: false, error: sessions.error });
    }
    const latestSession = sessions.data && sessions.data.length > 0
      ? await this.getSessionDetail(sessions.data[0]!.sessionId)
      : undefined;
    if (latestSession && !latestSession.ok) {
      return Object.freeze({ ok: false, error: latestSession.error });
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        agent: agentResponse.data,
        sessions: sessions.data ?? Object.freeze([]),
        latestSession: latestSession?.data,
        capabilities: Object.freeze({
          launch: Boolean(this.launchUseCase),
          triggerLaunch: Boolean(this.triggerLaunchUseCase),
          controls: Object.freeze(["cancel"]),
        }),
      }),
    });
  }

  private unsupportedOperation<T>(message: string): AgentStudioApiResponse<T> {
    return Object.freeze({ ok: false, error: Object.freeze({ code: "unsupported-operation", message }) });
  }

  private async wrap<T>(action: () => Promise<T>): Promise<AgentStudioApiResponse<T>> {
    try {
      return Object.freeze({ ok: true, data: await action() });
    } catch (error) {
      return Object.freeze({ ok: false, error: this.toApiError(error) });
    }
  }

  private toApiError(error: unknown): AgentStudioApiError {
    if (error instanceof AgentRuntimeError) {
      switch (error.code) {
        case "agent-runtime-invalid-request":
          return Object.freeze({ code: "invalid-request", message: error.message });
        case "agent-runtime-not-found":
          return Object.freeze({ code: "not-found", message: error.message });
        case "agent-runtime-unsupported-control":
          return Object.freeze({ code: "unsupported-control", message: error.message });
        case "agent-runtime-invalid-control-state":
          return Object.freeze({ code: "invalid-control-state", message: error.message });
      }
    }
    const message = error instanceof Error ? error.message : "Unexpected backend error.";
    return Object.freeze({ code: "internal", message });
  }
}
