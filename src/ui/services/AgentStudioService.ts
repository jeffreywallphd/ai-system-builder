import type { AgentPlanningStrategy } from "@domain/agents/Agent";
import type { AgentMemoryConfiguration } from "@domain/agents/AgentMemory";
import type { AgentToolAccessPolicy, AgentPolicy } from "@domain/agents/AgentPolicy";
import type { ConfigureAgentGoalsRequest } from "@application/agents/ConfigureAgentGoalsUseCase";
import type {
  AgentLaunchReadModel,
  AgentRunControlAction,
  AgentRunRequest,
  AgentSessionDetailReadModel,
  AgentSessionSummaryReadModel,
} from "@application/agents/contracts/AgentRunContracts";
import type { CreateAgentRequest } from "@application/agents/CreateAgentUseCase";
import { resolveDesktopAgentBridge } from "../composition/DesktopAgentBridgeAdapter";
import type { AgentAuthoringApiReadModel } from "@infrastructure/api/agents/AgentAuthoringBackendApi";
import type { AgentStudioApiResponse, AgentStudioSnapshotReadModel } from "@infrastructure/api/agents/AgentStudioBackendApi";
import type { TriggerAgentLaunchRequest } from "@application/agents/TriggerAgentLaunchUseCase";

export class AgentStudioService {
  private requireBridge() {
    const bridge = resolveDesktopAgentBridge();
    if (!bridge) {
      throw new Error("Desktop agent bridge is unavailable in this runtime.");
    }
    return bridge;
  }

  public async listAgents(includeArchived = true): Promise<AgentStudioApiResponse<ReadonlyArray<AgentAuthoringApiReadModel>>> {
    const raw = await this.requireBridge().listAgents(includeArchived);
    return JSON.parse(raw) as AgentStudioApiResponse<ReadonlyArray<AgentAuthoringApiReadModel>>;
  }

  public async createAgent(request: CreateAgentRequest): Promise<AgentStudioApiResponse<AgentAuthoringApiReadModel>> {
    const raw = await this.requireBridge().createAgent(JSON.stringify(request));
    return JSON.parse(raw) as AgentStudioApiResponse<AgentAuthoringApiReadModel>;
  }

  public async getStudioSnapshot(agentId: string): Promise<AgentStudioApiResponse<AgentStudioSnapshotReadModel>> {
    const raw = await this.requireBridge().getStudioSnapshot(agentId);
    return JSON.parse(raw) as AgentStudioApiResponse<AgentStudioSnapshotReadModel>;
  }

  public async launchAgent(request: AgentRunRequest): Promise<AgentStudioApiResponse<AgentLaunchReadModel>> {
    const raw = await this.requireBridge().launchAgent(JSON.stringify(request));
    return JSON.parse(raw) as AgentStudioApiResponse<AgentLaunchReadModel>;
  }


  public async triggerLaunch(request: TriggerAgentLaunchRequest): Promise<AgentStudioApiResponse<AgentLaunchReadModel>> {
    const raw = await this.requireBridge().triggerLaunch(JSON.stringify(request));
    return JSON.parse(raw) as AgentStudioApiResponse<AgentLaunchReadModel>;
  }

  public async listSessions(agentId: string): Promise<AgentStudioApiResponse<ReadonlyArray<AgentSessionSummaryReadModel>>> {
    const raw = await this.requireBridge().listSessions(agentId);
    return JSON.parse(raw) as AgentStudioApiResponse<ReadonlyArray<AgentSessionSummaryReadModel>>;
  }

  public async getSessionDetail(sessionId: string): Promise<AgentStudioApiResponse<AgentSessionDetailReadModel>> {
    const raw = await this.requireBridge().getSessionDetail(sessionId);
    return JSON.parse(raw) as AgentStudioApiResponse<AgentSessionDetailReadModel>;
  }

  public async cancelSession(sessionId: string): Promise<AgentStudioApiResponse<AgentSessionSummaryReadModel>> {
    return this.controlRun(sessionId, "cancel");
  }

  public async controlRun(
    sessionId: string,
    action: AgentRunControlAction,
  ): Promise<AgentStudioApiResponse<AgentSessionSummaryReadModel>> {
    const raw = await this.requireBridge().controlRun(JSON.stringify({ sessionId, action }));
    return JSON.parse(raw) as AgentStudioApiResponse<AgentSessionSummaryReadModel>;
  }

  public async configureGoals(request: ConfigureAgentGoalsRequest): Promise<AgentStudioApiResponse<AgentAuthoringApiReadModel>> {
    const raw = await this.requireBridge().configureGoals(JSON.stringify(request));
    return JSON.parse(raw) as AgentStudioApiResponse<AgentAuthoringApiReadModel>;
  }

  public async configurePolicy(agentId: string, policy: AgentPolicy): Promise<AgentStudioApiResponse<AgentAuthoringApiReadModel>> {
    const raw = await this.requireBridge().configurePolicy(agentId, JSON.stringify(policy));
    return JSON.parse(raw) as AgentStudioApiResponse<AgentAuthoringApiReadModel>;
  }

  public async configureTools(agentId: string, tools: AgentToolAccessPolicy): Promise<AgentStudioApiResponse<AgentAuthoringApiReadModel>> {
    const raw = await this.requireBridge().configureTools(agentId, JSON.stringify(tools));
    return JSON.parse(raw) as AgentStudioApiResponse<AgentAuthoringApiReadModel>;
  }

  public async configureMemory(agentId: string, memory: AgentMemoryConfiguration): Promise<AgentStudioApiResponse<AgentAuthoringApiReadModel>> {
    const raw = await this.requireBridge().configureMemory(agentId, JSON.stringify(memory));
    return JSON.parse(raw) as AgentStudioApiResponse<AgentAuthoringApiReadModel>;
  }

  public async configureStrategy(agentId: string, strategy: AgentPlanningStrategy): Promise<AgentStudioApiResponse<AgentAuthoringApiReadModel>> {
    const raw = await this.requireBridge().configureStrategy(agentId, JSON.stringify(strategy));
    return JSON.parse(raw) as AgentStudioApiResponse<AgentAuthoringApiReadModel>;
  }
}

