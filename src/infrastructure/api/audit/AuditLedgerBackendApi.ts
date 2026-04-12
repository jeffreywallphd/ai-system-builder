import {
  AuditLedgerQueryErrorCodes,
  type AuditLedgerQueryService,
} from "@application/audit/use-cases/AuditLedgerQueryService";
import {
  redactAuditOperationalErrorMessage,
  sanitizeAuditOperationalDetails,
} from "@application/audit/shared/AuditOperationalSignalRedaction";
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
import { AuditLedgerObservability } from "./AuditLedgerObservability";

export interface AuditLedgerBackendApiDependencies {
  readonly auditLedgerQueryService: AuditLedgerQueryService;
  readonly governanceProjectionQueryService?: AuditGovernanceProjectionQueryService;
  readonly observability?: AuditLedgerObservability;
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
      await this.recordObservability({
        event: "audit-ledger.query.failed",
        operation: "list",
        outcome: "failure",
        severity: "warn",
        actorUserIdentityId,
        workspaceId,
        details: Object.freeze({
          reason: "missing-actor-or-workspace",
        }),
      });
      return this.failed(
        AuditLedgerApiErrorCodes.invalidRequest,
        "actorUserIdentityId and workspaceId are required.",
      );
    }

    let outcome: Awaited<ReturnType<AuditLedgerQueryService["listAuditEvents"]>>;
    try {
      outcome = await this.dependencies.auditLedgerQueryService.listAuditEvents({
        requesterId: actorUserIdentityId,
        query: Object.freeze({
          ...(request.query ?? {}),
          workspaceId,
        }),
      });
    } catch (error) {
      await this.recordQueryFailure({
        operation: "list",
        actorUserIdentityId,
        workspaceId,
        error,
      });
      return this.failed(
        AuditLedgerApiErrorCodes.internal,
        "Audit ledger query failed.",
      );
    }
    if (!outcome.ok) {
      await this.recordObservability({
        event: "audit-ledger.query.failed",
        operation: "list",
        outcome: "failure",
        severity: outcome.error.code === AuditLedgerQueryErrorCodes.queryFailed ? "error" : "warn",
        actorUserIdentityId,
        workspaceId,
        details: Object.freeze({
          code: outcome.error.code,
          message: outcome.error.message,
        }),
      });
      return this.failedFromQueryOutcome(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    await this.recordObservability({
      event: "audit-ledger.query.completed",
      operation: "list",
      outcome: "success",
      severity: "info",
      actorUserIdentityId,
      workspaceId,
      counters: Object.freeze({
        returned: outcome.value.pagination.returned,
        totalCount: outcome.value.response.totalCount,
      }),
      details: Object.freeze({
        hasMore: outcome.value.pagination.hasMore,
      }),
    });

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
      await this.recordObservability({
        event: "audit-ledger.query.failed",
        operation: "detail",
        outcome: "failure",
        severity: "warn",
        actorUserIdentityId,
        workspaceId,
        eventId,
        details: Object.freeze({
          reason: "missing-actor-workspace-or-event",
        }),
      });
      return this.failed(
        AuditLedgerApiErrorCodes.invalidRequest,
        "actorUserIdentityId, workspaceId, and eventId are required.",
      );
    }

    let outcome: Awaited<ReturnType<AuditLedgerQueryService["getAuditEventDetail"]>>;
    try {
      outcome = await this.dependencies.auditLedgerQueryService.getAuditEventDetail({
        requesterId: actorUserIdentityId,
        workspaceId,
        eventId,
      });
    } catch (error) {
      await this.recordQueryFailure({
        operation: "detail",
        actorUserIdentityId,
        workspaceId,
        eventId,
        error,
      });
      return this.failed(
        AuditLedgerApiErrorCodes.internal,
        "Audit ledger query failed.",
      );
    }
    if (!outcome.ok) {
      await this.recordObservability({
        event: "audit-ledger.query.failed",
        operation: "detail",
        outcome: "failure",
        severity: outcome.error.code === AuditLedgerQueryErrorCodes.queryFailed ? "error" : "warn",
        actorUserIdentityId,
        workspaceId,
        eventId,
        details: Object.freeze({
          code: outcome.error.code,
          message: outcome.error.message,
        }),
      });
      return this.failedFromQueryOutcome(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    await this.recordObservability({
      event: "audit-ledger.query.completed",
      operation: "detail",
      outcome: "success",
      severity: "info",
      actorUserIdentityId,
      workspaceId,
      eventId,
    });

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
      await this.recordObservability({
        event: "audit-ledger.query.failed",
        operation: "governance-list",
        outcome: "failure",
        severity: "warn",
        actorUserIdentityId,
        workspaceId,
        details: Object.freeze({
          reason: "missing-actor-or-workspace",
        }),
      });
      return this.failed(
        AuditLedgerApiErrorCodes.invalidRequest,
        "actorUserIdentityId and workspaceId are required.",
      );
    }

    let outcome: Awaited<ReturnType<AuditGovernanceProjectionQueryService["listGovernanceAuditEvents"]>>;
    try {
      outcome = await this.governanceProjectionQueryService.listGovernanceAuditEvents({
        requesterId: actorUserIdentityId,
        query: Object.freeze({
          ...(request.query ?? {}),
          workspaceId,
        }),
      });
    } catch (error) {
      await this.recordQueryFailure({
        operation: "governance-list",
        actorUserIdentityId,
        workspaceId,
        error,
      });
      return this.failed(
        AuditLedgerApiErrorCodes.internal,
        "Audit ledger query failed.",
      );
    }
    if (!outcome.ok) {
      await this.recordObservability({
        event: "audit-ledger.query.failed",
        operation: "governance-list",
        outcome: "failure",
        severity: outcome.error.code === AuditLedgerQueryErrorCodes.queryFailed ? "error" : "warn",
        actorUserIdentityId,
        workspaceId,
        details: Object.freeze({
          code: outcome.error.code,
          message: outcome.error.message,
        }),
      });
      return this.failedFromQueryOutcome(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    await this.recordObservability({
      event: "audit-ledger.query.completed",
      operation: "governance-list",
      outcome: "success",
      severity: "info",
      actorUserIdentityId,
      workspaceId,
      counters: Object.freeze({
        returned: outcome.value.pagination.returned,
        totalCount: outcome.value.totalCount,
      }),
      details: Object.freeze({
        hasMore: outcome.value.pagination.hasMore,
      }),
    });

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
      await this.recordObservability({
        event: "audit-ledger.query.failed",
        operation: "governance-detail",
        outcome: "failure",
        severity: "warn",
        actorUserIdentityId,
        workspaceId,
        eventId,
        details: Object.freeze({
          reason: "missing-actor-workspace-or-event",
        }),
      });
      return this.failed(
        AuditLedgerApiErrorCodes.invalidRequest,
        "actorUserIdentityId, workspaceId, and eventId are required.",
      );
    }

    let outcome: Awaited<ReturnType<AuditGovernanceProjectionQueryService["getGovernanceAuditEventDetail"]>>;
    try {
      outcome = await this.governanceProjectionQueryService.getGovernanceAuditEventDetail({
        requesterId: actorUserIdentityId,
        workspaceId,
        eventId,
      });
    } catch (error) {
      await this.recordQueryFailure({
        operation: "governance-detail",
        actorUserIdentityId,
        workspaceId,
        eventId,
        error,
      });
      return this.failed(
        AuditLedgerApiErrorCodes.internal,
        "Audit ledger query failed.",
      );
    }
    if (!outcome.ok) {
      await this.recordObservability({
        event: "audit-ledger.query.failed",
        operation: "governance-detail",
        outcome: "failure",
        severity: outcome.error.code === AuditLedgerQueryErrorCodes.queryFailed ? "error" : "warn",
        actorUserIdentityId,
        workspaceId,
        eventId,
        details: Object.freeze({
          code: outcome.error.code,
          message: outcome.error.message,
        }),
      });
      return this.failedFromQueryOutcome(
        outcome.error.code,
        outcome.error.message,
        outcome.error.details,
      );
    }

    await this.recordObservability({
      event: "audit-ledger.query.completed",
      operation: "governance-detail",
      outcome: "success",
      severity: "info",
      actorUserIdentityId,
      workspaceId,
      eventId,
    });

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
      case AuditLedgerQueryErrorCodes.queryFailed:
        return this.failed(AuditLedgerApiErrorCodes.internal, "Audit ledger query failed.", details);
      default:
        return this.failed(AuditLedgerApiErrorCodes.internal, message, details);
    }
  }

  private failed(
    code: AuditLedgerApiError["code"],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AuditLedgerApiResponse<never> {
    const safeDetails = sanitizeAuditOperationalDetails(details);
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        message: redactAuditOperationalErrorMessage(message, message),
        validationErrors: extractValidationErrors(safeDetails),
        details: safeDetails,
      }),
    });
  }

  private async recordQueryFailure(input: {
    readonly operation: "list" | "detail" | "governance-list" | "governance-detail";
    readonly actorUserIdentityId?: string;
    readonly workspaceId?: string;
    readonly eventId?: string;
    readonly error: unknown;
  }): Promise<void> {
    await this.recordObservability({
      event: "audit-ledger.query.failed",
      operation: input.operation,
      outcome: "failure",
      severity: "error",
      actorUserIdentityId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      eventId: input.eventId,
      details: Object.freeze({
        message: redactAuditOperationalErrorMessage(input.error),
      }),
    });
  }

  private async recordObservability(
    input: Parameters<AuditLedgerObservability["recordQuery"]>[0],
  ): Promise<void> {
    if (!this.dependencies.observability) {
      return;
    }

    try {
      await this.dependencies.observability.recordQuery({
        ...input,
        details: sanitizeAuditOperationalDetails(input.details),
      });
    } catch {
      // Audit API observability is intentionally non-blocking.
    }
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

