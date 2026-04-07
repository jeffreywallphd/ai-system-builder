import type { IMcpRuntimeClient } from "../ports/interfaces/IMcpRuntimeClient";
import type { McpServerSearchCriteria } from "./models/McpServerSearchCriteria";
import type { McpServerSearchResult } from "./models/McpServerSearchResult";
import type { McpServerDescriptor } from "./models/McpServerDescriptor";

export interface ISearchMcpServersRequest {
  readonly criteria?: McpServerSearchCriteria;
}

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;

export class SearchMcpServersUseCase {
  constructor(private readonly runtimeClient: IMcpRuntimeClient) {}

  public async execute(request: ISearchMcpServersRequest = {}): Promise<McpServerSearchResult> {
    const criteria = request.criteria;
    const normalizedCriteria = {
      query: criteria?.query?.trim() || undefined,
      statuses: normalizeDistinct(criteria?.statuses),
      transports: normalizeDistinct(criteria?.transports),
      limit: normalizeLimit(criteria?.limit),
    } satisfies McpServerSearchCriteria;

    const result = await this.runtimeClient.searchServers(normalizedCriteria);
    const limitedServers = dedupeServers(result.servers).slice(0, normalizedCriteria.limit ?? DEFAULT_LIMIT);

    return Object.freeze({
      query: result.query.trim(),
      totalCount: Math.max(result.totalCount, limitedServers.length),
      limit: normalizedCriteria.limit ?? DEFAULT_LIMIT,
      servers: Object.freeze(limitedServers),
      status: Object.freeze({
        ...result.status,
        servers: Object.freeze([...(result.status.servers ?? [])]),
        capabilities: Object.freeze({ ...(result.status.capabilities ?? {}) }),
        metadata: result.status.metadata
          ? Object.freeze(JSON.parse(JSON.stringify(result.status.metadata)) as Record<string, unknown>)
          : undefined,
      }),
    });
  }
}

function normalizeLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function normalizeDistinct<T extends string>(values?: ReadonlyArray<T>): ReadonlyArray<T> | undefined {
  if (!values?.length) {
    return undefined;
  }

  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))] as T[];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function dedupeServers(servers: ReadonlyArray<McpServerDescriptor>): ReadonlyArray<McpServerDescriptor> {
  const byId = new Map<string, McpServerDescriptor>();

  for (const server of servers) {
    const normalizedId = server.id.trim();
    if (!normalizedId) {
      continue;
    }

    if (!byId.has(normalizedId)) {
      byId.set(normalizedId, normalizeServer(server, normalizedId));
    }
  }

  return Object.freeze([...byId.values()]);
}

function normalizeServer(server: McpServerDescriptor, id: string): McpServerDescriptor {
  return Object.freeze({
    id,
    name: server.name.trim() || id,
    transport: server.transport,
    enabled: server.enabled,
    command: server.command?.trim() || undefined,
    args: server.args ? Object.freeze(server.args.map((value) => value.trim())) : undefined,
    url: server.url?.trim() || undefined,
    env: server.env ? Object.freeze({ ...server.env }) : undefined,
    timeoutMs: server.timeoutMs,
    connectOnStartup: server.connectOnStartup,
    status: server.status,
    connected: server.connected,
    checkedAt: server.checkedAt,
    connectedAt: server.connectedAt,
    disconnectedAt: server.disconnectedAt,
    toolCount: Math.max(0, Math.floor(server.toolCount)),
    resourceCount: Math.max(0, Math.floor(server.resourceCount)),
    capabilities: Object.freeze({ ...(server.capabilities ?? {}) }),
    metadata: server.metadata
      ? Object.freeze(JSON.parse(JSON.stringify(server.metadata)) as Record<string, unknown>)
      : undefined,
    errorMessage: server.errorMessage?.trim() || undefined,
  });
}
