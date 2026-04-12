import type { IMcpToolCatalog } from "../ports/interfaces/IMcpToolCatalog";
import { normalizeMcpToolDescriptor, type McpToolDescriptor } from "./models/McpToolDescriptor";
import type { McpToolSearchQuery } from "./models/McpToolSearchQuery";
import type { McpToolSearchResult } from "./models/McpToolSearchResult";

export interface ISearchMcpToolsRequest {
  readonly query?: McpToolSearchQuery;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export class SearchMcpToolsUseCase {
  constructor(private readonly catalog: IMcpToolCatalog) {}

  public async execute(request: ISearchMcpToolsRequest = {}): Promise<McpToolSearchResult> {
    const normalizedQuery = normalizeQuery(request.query);

    if (typeof this.catalog.searchTools === "function") {
      const result = await this.catalog.searchTools(normalizedQuery);
      return Object.freeze({
        query: result.query.trim(),
        totalCount: Math.max(result.totalCount, result.tools.length),
        limit: normalizedQuery.limit ?? DEFAULT_LIMIT,
        tools: Object.freeze(result.tools.map((tool) => normalizeMcpToolDescriptor(tool))),
      });
    }

    const matches = filterTools(await this.catalog.listTools(), normalizedQuery);
    const limitedTools = matches.slice(0, normalizedQuery.limit ?? DEFAULT_LIMIT);

    return Object.freeze({
      query: normalizedQuery.query ?? "",
      totalCount: matches.length,
      limit: normalizedQuery.limit ?? DEFAULT_LIMIT,
      tools: Object.freeze(limitedTools.map((tool) => normalizeMcpToolDescriptor(tool))),
    });
  }
}

function normalizeQuery(query?: McpToolSearchQuery): McpToolSearchQuery {
  return Object.freeze({
    query: query?.query?.trim() || undefined,
    serverIds: normalizeStringArray(query?.serverIds),
    categories: normalizeStringArray(query?.categories),
    tags: normalizeStringArray(query?.tags),
    limit: normalizeLimit(query?.limit),
  });
}

function filterTools(
  tools: ReadonlyArray<McpToolDescriptor>,
  query: McpToolSearchQuery
): ReadonlyArray<McpToolDescriptor> {
  const normalizedText = query.query?.toLowerCase();
  const serverIds = new Set(query.serverIds ?? []);
  const categories = new Set(query.categories ?? []);
  const tags = new Set(query.tags ?? []);

  return Object.freeze(
    tools
      .map((tool) => normalizeMcpToolDescriptor(tool))
      .filter((tool) => {
        if (serverIds.size > 0 && !serverIds.has(tool.serverId)) {
          return false;
        }

        if (categories.size > 0 && !tool.categories.some((category) => categories.has(category))) {
          return false;
        }

        if (tags.size > 0 && !tool.tags.some((tag) => tags.has(tag))) {
          return false;
        }

        if (!normalizedText) {
          return true;
        }

        const haystack = [
          tool.id,
          tool.name,
          tool.title,
          tool.description,
          tool.serverId,
          ...tool.categories,
          ...tool.tags,
          ...tool.arguments.flatMap((argument) => [argument.name, argument.title, argument.description, argument.type]),
        ]
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedText);
      })
      .sort((left, right) => {
        const byTitle = (left.title ?? left.name).localeCompare(right.title ?? right.name);
        if (byTitle !== 0) {
          return byTitle;
        }

        return left.id.localeCompare(right.id);
      })
  );
}

function normalizeLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function normalizeStringArray(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values?.length) {
    return undefined;
  }

  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}
