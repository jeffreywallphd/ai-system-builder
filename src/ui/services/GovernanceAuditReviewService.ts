import type {
  AuditLedgerApiResponse,
  ListGovernanceAuditEventsApiResponse,
} from "@infrastructure/api/audit/sdk/PublicAuditLedgerApiContract";
import {
  appendSharedApiListQueryConventions,
  appendSharedApiQueryBoolean,
  appendSharedApiQueryList,
  toSharedApiQuerySuffix,
} from "@shared/contracts/api/SharedApiQueryConventions";
import {
  GovernanceAuditSortBy,
  normalizeGovernanceAuditQuery,
  type GovernanceAuditEventRecord,
  type GovernanceAuditReviewListQuery,
  type GovernanceAuditReviewListResult,
} from "@ui/shared/admin/GovernanceAuditReviewModel";
import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

export interface GovernanceAuditReviewClient {
  listGovernanceAuditEvents(
    request: {
      readonly workspaceId: string;
      readonly query: GovernanceAuditReviewListQuery;
    },
    sessionToken: string,
  ): Promise<AuditLedgerApiResponse<ListGovernanceAuditEventsApiResponse>>;
}

export interface GovernanceAuditReviewServiceDependencies {
  readonly client: GovernanceAuditReviewClient;
}

export class GovernanceAuditReviewService {
  private readonly dependencies: GovernanceAuditReviewServiceDependencies;

  public constructor(dependencies?: Partial<GovernanceAuditReviewServiceDependencies>) {
    this.dependencies = Object.freeze({
      client: dependencies?.client ?? createDefaultGovernanceAuditReviewClient(),
    });
  }

  public async listGovernanceAuditEvents(input: {
    readonly actorUserIdentityId: string;
    readonly sessionToken: string;
    readonly query: GovernanceAuditReviewListQuery;
  }): Promise<{ readonly ok: true; readonly data: GovernanceAuditReviewListResult } | {
    readonly ok: false;
    readonly error: { readonly message: string };
  }> {
    const actorUserIdentityId = input.actorUserIdentityId.trim();
    const sessionToken = input.sessionToken.trim();
    if (!actorUserIdentityId || !sessionToken) {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          message: "Unable to load governance audit events.",
        }),
      });
    }

    try {
      const normalizedQuery = normalizeGovernanceAuditQuery(input.query);
      const workspaceId = normalizedQuery.workspaceId?.trim();
      if (!workspaceId) {
        return Object.freeze({
          ok: false,
          error: Object.freeze({
            message: "Unable to load governance audit events.",
          }),
        });
      }

      const apiResponse = await this.dependencies.client.listGovernanceAuditEvents({
        workspaceId,
        query: normalizedQuery,
      }, sessionToken);

      if (!apiResponse.ok || !apiResponse.data) {
        return Object.freeze({
          ok: false,
          error: Object.freeze({
            message: apiResponse.error?.message?.trim() || "Unable to load governance audit events.",
          }),
        });
      }

      return Object.freeze({
        ok: true,
        data: Object.freeze({
          events: Object.freeze(apiResponse.data.events.map((event) => toGovernanceAuditEventRecord(event))),
          totalCount: apiResponse.data.totalCount,
          facets: apiResponse.data.facets,
          explanatory: apiResponse.data.explanatory,
        }),
      });
    } catch {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          message: "Unable to load governance audit events.",
        }),
      });
    }
  }
}

function toGovernanceAuditEventRecord(
  event: ListGovernanceAuditEventsApiResponse["events"][number],
): GovernanceAuditEventRecord {
  return Object.freeze({
    eventId: event.eventId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    outcome: event.outcome as GovernanceAuditEventRecord["outcome"],
    summary: event.summary,
    actorId: event.actorId,
    workspaceId: event.workspaceId,
    targetRef: event.targetRef,
    details: event.details,
  });
}

function createDefaultGovernanceAuditReviewClient(): GovernanceAuditReviewClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpGovernanceAuditReviewClient(baseUrl);
}

class HttpGovernanceAuditReviewClient implements GovernanceAuditReviewClient {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    const normalized = baseUrl.trim();
    this.baseUrl = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }

  public async listGovernanceAuditEvents(
    request: {
      readonly workspaceId: string;
      readonly query: GovernanceAuditReviewListQuery;
    },
    sessionToken: string,
  ): Promise<AuditLedgerApiResponse<ListGovernanceAuditEventsApiResponse>> {
    const query = new URLSearchParams();
    appendSharedApiListQueryConventions(query, {
      workspaceId: request.workspaceId,
      search: request.query.search,
      pagination: request.query.pagination,
      sorting: {
        sortBy: request.query.sorting?.sortBy === GovernanceAuditSortBy.eventType
          ? GovernanceAuditSortBy.eventType
          : GovernanceAuditSortBy.occurredAt,
        sortDirection: request.query.sorting?.sortDirection,
      },
    });
    appendSharedApiQueryList(query, "eventType", request.query.eventTypes);
    appendSharedApiQueryList(query, "outcome", request.query.outcomes);
    appendSharedApiQueryBoolean(query, "includeThinSafeOnly", request.query.includeThinSafeOnly);

    const response = await fetch(`${this.baseUrl}/api/v1/audit/governance/events${toSharedApiQuerySuffix(query)}`, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sessionToken}`,
      },
    });
    return await response.json() as AuditLedgerApiResponse<ListGovernanceAuditEventsApiResponse>;
  }
}
