import type { DesktopIpcRendererLike } from "./types";

export function createAgentsBridge({ ipcRenderer }: { ipcRenderer: DesktopIpcRendererLike }) {
  return Object.freeze({
    createAgent(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:create", requestJson) as Promise<string>;
    },
    updateAgent(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:update", requestJson) as Promise<string>;
    },
    getAgent(agentId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:get", agentId) as Promise<string>;
    },
    listAgents(includeArchived = true) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:list", includeArchived) as Promise<string>;
    },
    deleteAgent(agentId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:delete", agentId) as Promise<string>;
    },
    archiveAgent(agentId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:archive", agentId) as Promise<string>;
    },
    configureGoals(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-goals", requestJson) as Promise<string>;
    },
    configurePolicy(agentId: string, policyJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-policy", agentId, policyJson) as Promise<string>;
    },
    configureTools(agentId: string, toolAccessJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-tools", agentId, toolAccessJson) as Promise<string>;
    },
    configureMemory(agentId: string, memoryJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-memory", agentId, memoryJson) as Promise<string>;
    },
    configureStrategy(agentId: string, planningStrategyJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:configure-strategy", agentId, planningStrategyJson) as Promise<string>;
    },
    validateConfiguration(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:validate", requestJson) as Promise<string>;
    },
    launchAgent(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:launch", requestJson) as Promise<string>;
    },
    triggerLaunch(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:trigger-launch", requestJson) as Promise<string>;
    },
    listSessions(agentId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:list-sessions", agentId) as Promise<string>;
    },
    getSessionDetail(sessionId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:get-session", sessionId) as Promise<string>;
    },
    controlRun(requestJson: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:control-run", requestJson) as Promise<string>;
    },
    getStudioSnapshot(agentId: string) {
      return ipcRenderer.invoke("ai-loom-desktop-agents:studio-snapshot", agentId) as Promise<string>;
    },
  });
}
