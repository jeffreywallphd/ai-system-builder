import type { IMcpConfiguredServerRepository } from "../ports/interfaces/IMcpConfiguredServerRepository";
import type { McpServerDescriptor } from "./models/McpServerDescriptor";

export interface IAddConfiguredMcpServerRequest {
  readonly server: McpServerDescriptor;
}

export class AddConfiguredMcpServerUseCase {
  constructor(private readonly repository: IMcpConfiguredServerRepository) {}

  public async execute(request: IAddConfiguredMcpServerRequest): Promise<McpServerDescriptor> {
    const server = normalizeServer(request.server);
    return this.repository.saveConfiguredServer(server);
  }
}

function normalizeServer(server: McpServerDescriptor): McpServerDescriptor {
  const id = server.id.trim();
  const name = server.name.trim();

  if (!id) {
    throw new Error("Adding an MCP server requires a server id.");
  }

  if (!name) {
    throw new Error("Adding an MCP server requires a server name.");
  }

  return Object.freeze({
    id,
    name,
    transport: server.transport,
    enabled: server.enabled ?? true,
    command: server.command?.trim() || undefined,
    args: server.args?.map((value) => value.trim()).filter((value) => value.length > 0),
    url: server.url?.trim() || undefined,
    env: normalizeEnv(server.env),
    timeoutMs: normalizeTimeout(server.timeoutMs),
    connectOnStartup: server.connectOnStartup ?? false,
    status: server.status,
    connected: server.connected ?? false,
    checkedAt: server.checkedAt,
    connectedAt: server.connectedAt,
    disconnectedAt: server.disconnectedAt,
    toolCount: normalizeCount(server.toolCount),
    resourceCount: normalizeCount(server.resourceCount),
    capabilities: Object.freeze({ ...(server.capabilities ?? {}) }),
    metadata: normalizeMetadata(server.metadata),
    errorMessage: server.errorMessage?.trim() || undefined,
  });
}

function normalizeTimeout(timeoutMs?: number): number | undefined {
  if (timeoutMs === undefined || Number.isNaN(timeoutMs) || timeoutMs <= 0) {
    return undefined;
  }

  return Math.floor(timeoutMs);
}

function normalizeCount(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function normalizeEnv(
  env?: Readonly<Record<string, string>>
): Readonly<Record<string, string>> | undefined {
  if (!env) {
    return undefined;
  }

  const entries = Object.entries(env)
    .map(([key, value]) => [key.trim(), value] as const)
    .filter(([key]) => key.length > 0);

  return entries.length > 0 ? Object.freeze(Object.fromEntries(entries)) : undefined;
}

function normalizeMetadata(
  metadata?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> | undefined {
  if (!metadata) {
    return undefined;
  }

  return Object.freeze(JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>);
}
