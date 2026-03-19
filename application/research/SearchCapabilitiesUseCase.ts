import type { McpServerSearchCriteria } from "../mcp/models/McpServerSearchCriteria";
import type { IMcpToolCatalog } from "../ports/interfaces/IMcpToolCatalog";
import type { IMcpRuntimeClient } from "../ports/interfaces/IMcpRuntimeClient";
import type { IToolCapabilityCatalog } from "../ports/interfaces/IToolCapabilityCatalog";
import type { ToolCapabilityDescriptor } from "../tools/models/ToolCapabilityDescriptor";
import type { CapabilitySearchQuery } from "./models/CapabilitySearchQuery";
import type {
  CapabilitySearchCandidate,
  CapabilitySearchCandidateKind,
  CapabilitySearchResult,
} from "./models/CapabilitySearchResult";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 12;
const MCP_SERVER_SEARCH_LIMIT = 12;

export interface SearchCapabilitiesUseCaseOptions {
  readonly mcpToolCatalog?: IMcpToolCatalog;
  readonly mcpRuntimeClient?: Pick<IMcpRuntimeClient, "searchServers">;
}

export class SearchCapabilitiesUseCase {
  constructor(
    private readonly toolCatalog: IToolCapabilityCatalog,
    private readonly options: SearchCapabilitiesUseCaseOptions = {}
  ) {}

  public async execute(query: CapabilitySearchQuery = {}): Promise<CapabilitySearchResult> {
    const normalizedQuery = query.query?.trim() ?? "";
    const normalizedLimit = normalizeLimit(query.limit);
    const allowedProviderKinds = new Set(query.providerKinds ?? []);
    const shouldSearchServers = query.includeMcpServers !== false && normalizedQuery.length > 0;
    const shouldListResources = query.includeMcpResources !== false;

    const [capabilities, serverResult, resources] = await Promise.all([
      this.toolCatalog.listCapabilities(),
      shouldSearchServers ? this.searchMcpServers(normalizedQuery, normalizedLimit) : Promise.resolve(undefined),
      shouldListResources ? this.listMcpResources() : Promise.resolve(Object.freeze([] as const)),
    ]);

    const candidates = [
      ...capabilities
        .filter((capability) => matchesProviderKinds(capability, allowedProviderKinds))
        .map((capability) => this.buildCapabilityCandidate(capability, normalizedQuery)),
      ...(serverResult?.servers.map((server) => this.buildServerCandidate(server, normalizedQuery)) ?? []),
      ...resources.map((resource) => this.buildResourceCandidate(resource, normalizedQuery)),
    ].filter((candidate): candidate is CapabilitySearchCandidate => candidate.score > 0);

    const sorted = candidates.sort(compareCandidates);
    const bounded = sorted.slice(0, normalizedLimit);

    return Object.freeze({
      query: normalizedQuery,
      limit: normalizedLimit,
      totalCandidateCount: sorted.length,
      truncated: sorted.length > normalizedLimit,
      sources: Object.freeze({
        toolCapabilities: sorted.filter((candidate) => candidate.kind === "tool-capability").length,
        mcpServers: sorted.filter((candidate) => candidate.kind === "mcp-server").length,
        mcpResources: sorted.filter((candidate) => candidate.kind === "mcp-resource").length,
      }),
      candidates: Object.freeze(bounded),
    });
  }

  private async searchMcpServers(query: string, limit: number) {
    if (!this.options.mcpRuntimeClient) {
      return undefined;
    }

    const criteria: McpServerSearchCriteria = {
      query,
      limit: Math.min(limit, MCP_SERVER_SEARCH_LIMIT),
    };
    return this.options.mcpRuntimeClient.searchServers(criteria);
  }

  private async listMcpResources() {
    if (typeof this.options.mcpToolCatalog?.listResources !== "function") {
      return Object.freeze([]);
    }

    return this.options.mcpToolCatalog.listResources();
  }

  private buildCapabilityCandidate(
    capability: ToolCapabilityDescriptor,
    query: string
  ): CapabilitySearchCandidate {
    const match = scoreTextMatch({
      query,
      primaryText: [capability.displayName, capability.publication.title, capability.id],
      secondaryText: [
        capability.description,
        capability.publication.description,
        capability.provider.label,
        capability.publication.category,
        capability.source.workflowToolSlug,
        capability.source.localToolName,
        capability.source.serverId,
        capability.source.toolName,
      ],
      emptyQueryBase: 1,
    });

    return Object.freeze({
      id: capability.id,
      kind: "tool-capability",
      title: capability.displayName,
      subtitle: capability.provider.label,
      description: capability.description ?? capability.publication.description,
      providerKind: capability.provider.kind,
      score: match.score,
      matchReasons: match.reasons,
      capability,
    });
  }

  private buildServerCandidate(server: Awaited<ReturnType<NonNullable<SearchCapabilitiesUseCaseOptions["mcpRuntimeClient"]>["searchServers"]>>["servers"][number], query: string): CapabilitySearchCandidate {
    const match = scoreTextMatch({
      query,
      primaryText: [server.name, server.id, server.transport, server.status],
      secondaryText: [
        `${server.toolCount} tools`,
        `${server.resourceCount} resources`,
        ...Object.entries(server.capabilities).flatMap(([key, value]) => (value ? [key] : [])),
        ...Object.entries(server.metadata ?? {}).map(([key, value]) => `${key}:${String(value)}`),
      ],
      emptyQueryBase: 0,
    });

    return Object.freeze({
      id: `mcp-server:${server.id}`,
      kind: "mcp-server",
      title: server.name,
      subtitle: `${server.transport} · ${server.status}`,
      description: `${server.toolCount} tools · ${server.resourceCount} resources`,
      providerKind: "mcp",
      score: match.score,
      matchReasons: match.reasons,
      server,
    });
  }

  private buildResourceCandidate(resource: Awaited<ReturnType<NonNullable<IMcpToolCatalog["listResources"]>>>[number], query: string): CapabilitySearchCandidate {
    const match = scoreTextMatch({
      query,
      primaryText: [resource.title, resource.name, resource.uri],
      secondaryText: [resource.description, resource.mimeType, resource.serverId],
      emptyQueryBase: 0,
    });

    return Object.freeze({
      id: `mcp-resource:${resource.serverId}:${resource.uri}`,
      kind: "mcp-resource",
      title: resource.title ?? resource.name ?? resource.uri,
      subtitle: resource.serverId,
      description: resource.description ?? resource.mimeType ?? resource.uri,
      providerKind: "mcp",
      score: match.score,
      matchReasons: match.reasons,
      resource,
    });
  }
}

function matchesProviderKinds(
  capability: ToolCapabilityDescriptor,
  allowedProviderKinds: ReadonlySet<ToolCapabilityDescriptor["provider"]["kind"]>
): boolean {
  return allowedProviderKinds.size === 0 || allowedProviderKinds.has(capability.provider.kind);
}

function normalizeLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function compareCandidates(left: CapabilitySearchCandidate, right: CapabilitySearchCandidate): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const byKind = compareKind(left.kind, right.kind);
  if (byKind !== 0) {
    return byKind;
  }

  const byTitle = left.title.localeCompare(right.title);
  if (byTitle !== 0) {
    return byTitle;
  }

  return left.id.localeCompare(right.id);
}

function compareKind(left: CapabilitySearchCandidateKind, right: CapabilitySearchCandidateKind): number {
  const order: Readonly<Record<CapabilitySearchCandidateKind, number>> = {
    "tool-capability": 0,
    "mcp-server": 1,
    "mcp-resource": 2,
  };

  return order[left] - order[right];
}

function scoreTextMatch({
  query,
  primaryText,
  secondaryText,
  emptyQueryBase,
}: {
  readonly query: string;
  readonly primaryText: ReadonlyArray<string | undefined>;
  readonly secondaryText: ReadonlyArray<string | undefined>;
  readonly emptyQueryBase: number;
}): { readonly score: number; readonly reasons: ReadonlyArray<string> } {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return { score: emptyQueryBase, reasons: emptyQueryBase > 0 ? ["browse"] : [] };
  }

  const primary = primaryText.map(normalizeText).filter(Boolean);
  const secondary = secondaryText.map(normalizeText).filter(Boolean);
  const reasons = new Set<string>();
  let score = 0;

  for (const text of primary) {
    if (text === normalizedQuery) {
      score += 120;
      reasons.add("exact-primary-match");
    } else if (text.startsWith(normalizedQuery)) {
      score += 90;
      reasons.add("prefix-primary-match");
    } else if (text.includes(normalizedQuery)) {
      score += 70;
      reasons.add("substring-primary-match");
    }
  }

  for (const text of secondary) {
    if (text.includes(normalizedQuery)) {
      score += 30;
      reasons.add("secondary-match");
    }
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    for (const text of primary) {
      if (text.includes(token)) {
        score += 12;
        reasons.add(`token:${token}`);
      }
    }
    for (const text of secondary) {
      if (text.includes(token)) {
        score += 5;
        reasons.add(`token:${token}`);
      }
    }
  }

  return { score, reasons: Object.freeze([...reasons]) };
}

function normalizeText(value?: string): string {
  return value?.trim().toLowerCase() ?? "";
}
