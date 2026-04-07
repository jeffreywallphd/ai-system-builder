export interface McpRuntimeServerConfig {
  readonly id: string;
  readonly name: string;
  readonly enabled?: boolean;
  readonly transport: "stdio" | "http" | "sse" | "inmemory";
  readonly command?: string;
  readonly args?: ReadonlyArray<string>;
  readonly url?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly connectOnStartup?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface McpRuntimeConfigValues {
  readonly enabled?: boolean;
  readonly timeoutMs?: number;
  readonly connectOnStartup?: boolean;
  readonly servers?: ReadonlyArray<McpRuntimeServerConfig>;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function normalizePositiveNumber(value: number | undefined): number | undefined {
  if (value === undefined || Number.isNaN(value) || value <= 0) {
    return undefined;
  }

  return Math.floor(value);
}

function normalizeServer(server: McpRuntimeServerConfig): McpRuntimeServerConfig {
  return Object.freeze({
    id: server.id.trim(),
    name: server.name.trim(),
    enabled: server.enabled ?? true,
    transport: server.transport,
    command: server.command?.trim() || undefined,
    args: server.args ? Object.freeze([...server.args]) : undefined,
    url: server.url?.trim() || undefined,
    env: server.env ? Object.freeze({ ...server.env }) : undefined,
    timeoutMs: normalizePositiveNumber(server.timeoutMs),
    connectOnStartup: server.connectOnStartup,
    metadata: server.metadata ? Object.freeze({ ...server.metadata }) : undefined,
  });
}

export class McpRuntimeConfig {
  public readonly enabled: boolean;
  public readonly timeoutMs: number;
  public readonly connectOnStartup: boolean;
  public readonly servers: ReadonlyArray<McpRuntimeServerConfig>;

  constructor(values: McpRuntimeConfigValues = {}) {
    this.enabled = values.enabled ?? false;
    this.timeoutMs = normalizePositiveNumber(values.timeoutMs) ?? 10_000;
    this.connectOnStartup = values.connectOnStartup ?? false;
    this.servers = Object.freeze((values.servers ?? []).map(normalizeServer));

    if (this.servers.some((server) => !server.id || !server.name)) {
      throw new Error("Configured MCP servers require non-empty id and name values.");
    }

    const ids = new Set<string>();
    for (const server of this.servers) {
      if (ids.has(server.id)) {
        throw new Error(`Duplicate MCP server id '${server.id}' is not allowed.`);
      }
      ids.add(server.id);

      if (server.transport === "stdio" && !server.command && server.enabled !== false) {
        throw new Error(`Configured stdio MCP server '${server.id}' requires a command.`);
      }
      if ((server.transport === "http" || server.transport === "sse") && !server.url && server.enabled !== false) {
        throw new Error(`Configured ${server.transport} MCP server '${server.id}' requires a url.`);
      }
    }
  }

  public static fromEnv(env: Readonly<Record<string, string | undefined>>): McpRuntimeConfig {
    const serversRaw = env.MCP_RUNTIME_SERVERS_JSON?.trim();
    const parsedServers = serversRaw
      ? (JSON.parse(serversRaw) as ReadonlyArray<McpRuntimeServerConfig>)
      : undefined;

    return new McpRuntimeConfig({
      enabled: parseBoolean(env.MCP_RUNTIME_ENABLED) ?? false,
      timeoutMs: env.MCP_RUNTIME_TIMEOUT_MS ? Number(env.MCP_RUNTIME_TIMEOUT_MS) : undefined,
      connectOnStartup: parseBoolean(env.MCP_RUNTIME_CONNECT_ON_STARTUP),
      servers: parsedServers,
    });
  }
}
