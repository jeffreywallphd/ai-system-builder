import type { IMcpServerManager } from "../ports/interfaces/IMcpServerManager";
import type { LocalMcpToolDraft } from "./models/LocalMcpToolDraft";
import type { LocalMcpServerCreateResult } from "./models/LocalMcpServerCreateResult";

export interface ICreateLocalMcpServerRequest {
  readonly draft: LocalMcpToolDraft;
}

export class CreateLocalMcpServerUseCase {
  constructor(private readonly serverManager: IMcpServerManager) {}

  public async execute(request: ICreateLocalMcpServerRequest): Promise<LocalMcpServerCreateResult> {
    const draft = normalizeDraft(request.draft);
    return this.serverManager.createLocalServer(draft);
  }
}

function normalizeDraft(draft: LocalMcpToolDraft): LocalMcpToolDraft {
  const serverId = draft.serverId.trim();
  const serverName = draft.serverName.trim();
  const toolName = draft.toolName.trim();
  const code = draft.code.trim();

  if (!serverId) {
    throw new Error("Creating a local MCP server requires a serverId.");
  }

  if (!serverName) {
    throw new Error("Creating a local MCP server requires a serverName.");
  }

  if (!toolName) {
    throw new Error("Creating a local MCP server requires a toolName.");
  }

  if (!code) {
    throw new Error("Creating a local MCP server requires tool logic.");
  }

  return Object.freeze({
    ...draft,
    serverId,
    serverName,
    serverDescription: draft.serverDescription?.trim() || undefined,
    toolName,
    toolTitle: draft.toolTitle?.trim() || undefined,
    toolDescription: draft.toolDescription?.trim() || undefined,
    code,
    connectOnStartup: draft.connectOnStartup ?? true,
    timeoutMs: draft.timeoutMs && draft.timeoutMs > 0 ? Math.floor(draft.timeoutMs) : undefined,
    inputSchema: draft.inputSchema ? Object.freeze(JSON.parse(JSON.stringify(draft.inputSchema)) as Record<string, unknown>) : undefined,
    outputSchema: draft.outputSchema ? Object.freeze(JSON.parse(JSON.stringify(draft.outputSchema)) as Record<string, unknown>) : undefined,
    metadata: draft.metadata ? Object.freeze(JSON.parse(JSON.stringify(draft.metadata)) as Record<string, unknown>) : undefined,
  });
}
