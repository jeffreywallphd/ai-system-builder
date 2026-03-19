import type { IMcpRuntimeClient } from "../ports/interfaces/IMcpRuntimeClient";
import type { McpServerSearchCriteria } from "./models/McpServerSearchCriteria";
import type { McpServerSearchResult } from "./models/McpServerSearchResult";

export interface ISearchMcpServersRequest {
  readonly criteria?: McpServerSearchCriteria;
}

export class SearchMcpServersUseCase {
  constructor(private readonly runtimeClient: IMcpRuntimeClient) {}

  public async execute(request: ISearchMcpServersRequest = {}): Promise<McpServerSearchResult> {
    const criteria = request.criteria;

    return this.runtimeClient.searchServers({
      query: criteria?.query?.trim() || undefined,
      statuses: criteria?.statuses?.length ? Object.freeze([...criteria.statuses]) : undefined,
      transports: criteria?.transports?.length ? Object.freeze([...criteria.transports]) : undefined,
      limit: normalizeLimit(criteria?.limit),
    });
  }
}

function normalizeLimit(limit?: number): number | undefined {
  if (limit === undefined || Number.isNaN(limit)) {
    return undefined;
  }

  return Math.min(50, Math.max(1, Math.floor(limit)));
}
