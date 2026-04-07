import {
  AuditLedgerQueryErrorCodes,
  type AuditLedgerQueryService,
} from "@application/audit/use-cases/AuditLedgerQueryService";
import { AuditGovernanceProjectionQueryService } from "@application/audit/use-cases/AuditGovernanceProjectionQueryService";
import {
  AuditLedgerApiErrorCodes,
  type AuditLedgerApiError,
  type AuditLedgerApiResponse,
  type GetGovernanceAuditEventDetailApiRequest,
  type GetGovernanceAuditEventDetailApiResponse,
  type GetAuditLedgerEventDetailApiRequest,
  type GetAuditLedgerEventDetailApiResponse,
  type ListGovernanceAuditEventsApiRequest,
  type ListGovernanceAuditEventsApiResponse,
  type ListAuditLedgerEventsApiRequest,
  type ListAuditLedgerEventsApiResponse,
} from "./sdk/PublicAuditLedgerApiContract";

export interface AuditLedgerBackendApiDependencies {
  readonly auditLedgerQueryService: AuditLedgerQueryService;
  readonly governanceProjectionQueryService?: AuditGovernanceProjectionQueryService;
}

export class AuditLedgerBackendApi {
  private readonly governanceProjectionQueryService: AuditGovernanceProjectionQueryService;
  private readonly dependencies: AuditLedgerBackendApiDependencies;

  public constructor(dependencies: AuditLedgerBackendApiDependencies) {
    this.dependencies = dependencies;
    this.governanceProjectionQueryService = dependencies.governanceProjectionQueryService
      ?? new AuditGovernanceProjectionQueryService({
        auditLedgerQueryService: dependencies.auditLedgerQueryService,
      });
  }

  public async listAuditEvents(
    request: ListAuditLedgerEventsApiRequest,
  ): Promise<AuditLedgerApiResponse<ListAuditLedgerEventsApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    const workspaceId = normalizeRequired(request.workspaceId);
    if (!actorUserIdentityId || !workspaceId) {
      return this.failed(
        AuditLedgerApiErrorCodes.invalidRequest,
        "actorUserIdentityId and workspaceId are required.",
      );
    }

    const outcome = await this.dependencies.auditLedgerQueryService.listAuditEvents({
      requesterId: actorUserIdentityId,
      query: Object.freeze({
        ...(request.query ?? {}),
        workspaceId,
      }),
    });
    if (!outcome.ok) {
      return this.failedFromQueryOutcome(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        events: outcome.value.response.events,
        totalCount: outcome.value.response.totalCount,
        query: outcome.value.response.query,
        pagination: outcome.value.pagination,
      }),
    });
  }

  public async getAuditEventDetail(
    request: GetAuditLedgerEventDetailApiRequest,
  ): Promise<AuditLedgerApiResponse<GetAuditLedgerEventDetailApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    const workspaceId = normalizeRequired(request.workspaceId);
    const eventId = normalizeRequired(request.eventId);
    if (!actorUserIdentityId || !workspaceId || !eventId) {
      return this.failed(
        AuditLedgerApiErrorCodes.invalidRequest,
        "actorUserIdentityId, workspaceId, and eventId are required.",
      );
    }

    const outcome = await this.dependencies.auditLedgerQueryService.getAuditEventDetail({
      requesterId: actorUserIdentityId,
      workspaceId,
      eventId,
    });
    if (!outcome.ok) {
      return this.failedFromQueryOutcome(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        event: outcome.value.event,
      }),
    });
  }

  public async listGovernanceAuditEvents(
    request: ListGovernanceAuditEventsApiRequest,
  ): Promise<AuditLedgerApiResponse<ListGovernanceAuditEventsApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    const workspaceId = normalizeRequired(request.workspaceId);
    if (!actorUserIdentityId || !workspaceId) {
      return this.failed(
        AuditLedgerApiErrorCodes.invalidRequest,
        "actorUserIdentityId and workspaceId are required.",
      );
    }

    const outcome = await this.governanceProjectionQueryService.listGovernanceAuditEvents({
      requesterId: actorUserIdentityId,
      query: Object.freeze({
        ...(request.query ?? {}),
        workspaceId,
      }),
    });
    if (!outcome.ok) {
      return this.failedFromQueryOutcome(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        events: outcome.value.events,
        facets: outcome.value.facets,
        totalCount: outcome.value.totalCount,
        query: outcome.value.query,
        pagination: outcome.value.pagination,
        explanatory: outcome.value.explanatory,
      }),
    });
  }

  public async getGovernanceAuditEventDetail(
    request: GetGovernanceAuditEventDetailApiRequest,
  ): Promise<AuditLedgerApiResponse<GetGovernanceAuditEventDetailApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    const workspaceId = normalizeRequired(request.workspaceId);
    const eventId = normalizeRequired(request.eventId);
    if (!actorUserIdentityId || !workspaceId || !eventId) {
      return this.failed(
        AuditLedgerApiErrorCodes.invalidRequest,
        "actorUserIdentityId, workspaceId, and eventId are required.",
      );
    }

    const outcome = await this.governanceProjectionQueryService.getGovernanceAuditEventDetail({
      requesterId: actorUserIdentityId,
      workspaceId,
      eventId,
    });
    if (!outcome.ok) {
      return this.failedFromQueryOutcome(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        event: outcome.value,
      }),
    });
  }

  private failedFromQueryOutcome(
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AuditLedgerApiResponse<never> {
    switch (code) {
      case AuditLedgerQueryErrorCodes.invalidRequest:
        return this.failed(AuditLedgerApiErrorCodes.invalidRequest, message, details);
      case AuditLedgerQueryErrorCodes.forbidden:
        return this.failed(AuditLedgerApiErrorCodes.forbidden, message, details);
      case AuditLedgerQueryErrorCodes.notFound:
        return this.failed(AuditLedgerApiErrorCodes.notFound, message, details);
      default:
        return this.failed(AuditLedgerApiErrorCodes.internal, message, details);
    }
  }

  private failed(
    code: AuditLedgerApiError["code"],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AuditLedgerApiResponse<never> {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        message,
        validationErrors: extractValidationErrors(details),
        details,
      }),
    });
  }
}

function extractValidationErrors(
  details?: Readonly<Record<string, unknown>>,
): ReadonlyArray<{ readonly path: string; readonly code: string; readonly message: string }> | undefined {
  const issues = details?.issues;
  if (!Array.isArray(issues) || issues.length < 1) {
    return undefined;
  }

  const validationErrors = issues.flatMap((issue) => {
    if (!issue || typeof issue !== "object") {
      return [];
    }

    const path = normalizeRequired((issue as { path?: string }).path) ?? "payload";
    const code = normalizeRequired((issue as { code?: string }).code) ?? "custom";
    const message = normalizeRequired((issue as { message?: string }).message) ?? "Invalid value.";
    return [Object.freeze({ path, code, message })];
  });

  return validationErrors.length > 0 ? Object.freeze(validationErrors) : undefined;
}

function normalizeRequired(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

