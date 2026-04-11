import type { ConfigureAgentGoalsRequest } from "../../../src/application/agents/ConfigureAgentGoalsUseCase";
import type { TriggerAgentLaunchRequest } from "../../../src/application/agents/TriggerAgentLaunchUseCase";
import type { AgentRunControlRequest, AgentRunRequest } from "../../../src/application/agents/contracts/AgentRunContracts";
import type { AgentConfigurationValidationInput } from "../../../src/application/agents/services/AgentConfigurationValidationService";
import type { CreateAgentRequest } from "../../../src/application/agents/CreateAgentUseCase";
import type { UpdateAgentRequest } from "../../../src/application/agents/UpdateAgentUseCase";
import type { AgentMemoryConfiguration } from "../../../src/domain/agents/AgentMemory";
import type { AgentPolicy, AgentToolAccessPolicy } from "../../../src/domain/agents/AgentPolicy";
import type { AgentPlanningStrategy } from "../../../src/domain/agents/Agent";
import type { AgentStudioIpcRegistrationParams } from "./IpcRegistrationTypes";

export function registerAgentStudioIpc(params: AgentStudioIpcRegistrationParams): void {
  const { ipcMain, onDemand } = params;
  ipcMain.handle("ai-loom-desktop-agents:create", async (_event, requestJson: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    const request = JSON.parse(requestJson) as CreateAgentRequest;
    return JSON.stringify(await agentApi.createAgent(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:update", async (_event, requestJson: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    const request = JSON.parse(requestJson) as UpdateAgentRequest;
    return JSON.stringify(await agentApi.updateAgent(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:get", async (_event, agentId: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    return JSON.stringify(await agentApi.getAgent(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:list", async (_event, includeArchived = true) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    return JSON.stringify(await agentApi.listAgents(includeArchived));
  });
  ipcMain.handle("ai-loom-desktop-agents:delete", async (_event, agentId: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    return JSON.stringify(await agentApi.deleteAgent(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:archive", async (_event, agentId: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    return JSON.stringify(await agentApi.archiveAgent(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-goals", async (_event, requestJson: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    const request = JSON.parse(requestJson) as ConfigureAgentGoalsRequest;
    return JSON.stringify(await agentApi.configureGoals(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-policy", async (_event, agentId: string, policyJson: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    const policy = JSON.parse(policyJson) as AgentPolicy;
    return JSON.stringify(await agentApi.configurePolicy(agentId, policy));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-tools", async (_event, agentId: string, toolAccessJson: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    const toolAccess = JSON.parse(toolAccessJson) as AgentToolAccessPolicy;
    return JSON.stringify(await agentApi.configureTools(agentId, toolAccess));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-memory", async (_event, agentId: string, memoryJson: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    const memory = JSON.parse(memoryJson) as AgentMemoryConfiguration;
    return JSON.stringify(await agentApi.configureMemory(agentId, memory));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-strategy", async (_event, agentId: string, planningStrategyJson: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    const planningStrategy = JSON.parse(planningStrategyJson) as AgentPlanningStrategy;
    return JSON.stringify(await agentApi.configureStrategy(agentId, planningStrategy));
  });
  ipcMain.handle("ai-loom-desktop-agents:validate", async (_event, requestJson: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    const request = JSON.parse(requestJson) as AgentConfigurationValidationInput;
    return JSON.stringify(await agentApi.validateConfiguration(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:launch", async (_event, requestJson: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    const request = JSON.parse(requestJson) as AgentRunRequest;
    return JSON.stringify(await agentApi.launchAgent(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:trigger-launch", async (_event, requestJson: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    const request = JSON.parse(requestJson) as TriggerAgentLaunchRequest;
    return JSON.stringify(await agentApi.triggerLaunch(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:list-sessions", async (_event, agentId: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    return JSON.stringify(await agentApi.listSessions(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:get-session", async (_event, sessionId: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    return JSON.stringify(await agentApi.getSessionDetail(sessionId));
  });
  ipcMain.handle("ai-loom-desktop-agents:control-run", async (_event, requestJson: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    const request = JSON.parse(requestJson) as AgentRunControlRequest;
    return JSON.stringify(await agentApi.controlRun(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:studio-snapshot", async (_event, agentId: string) => {
    const agentApi = onDemand.getAgentStudioBackendApi();
    return JSON.stringify(await agentApi.getStudioSnapshot(agentId));
  });
}
