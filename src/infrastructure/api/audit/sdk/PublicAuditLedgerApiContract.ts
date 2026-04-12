import type {
  AuditEventDetailViewDto,
  AuditEventSummaryViewDto,
} from "@shared/contracts/audit/AuditEventContracts";
import type { AuditLedgerListQueryDto } from "@shared/dto/audit/AuditEventDtos";

export const AuditLedgerApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  internal: "internal",
} as const);

export type AuditLedgerApiErrorCode =
  typeof AuditLedgerApiErrorCodes[keyof typeof AuditLedgerApiErrorCodes];

export interface AuditLedgerApiValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface AuditLedgerApiError {
  readonly code: AuditLedgerApiErrorCode;
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<AuditLedgerApiValidationError>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AuditLedgerApiResponse<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: AuditLedgerApiError;
}

export interface ListAuditLedgerEventsApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly query?: AuditLedgerListQueryDto;
}

export interface ListAuditLedgerEventsApiResponse {
  readonly events: ReadonlyArray<AuditEventSummaryViewDto>;
  readonly totalCount: number;
  readonly query: AuditLedgerListQueryDto;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface GetAuditLedgerEventDetailApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly eventId: string;
}

export interface GetAuditLedgerEventDetailApiResponse {
  readonly event: AuditEventDetailViewDto;
}

export interface GovernanceAuditProjectionFacetOptionApiDto {
  readonly value: string;
  readonly count: number;
}

export interface GovernanceAuditProjectionFacetApiDto {
  readonly key: "eventType" | "outcome" | "category";
  readonly options: ReadonlyArray<GovernanceAuditProjectionFacetOptionApiDto>;
}

export interface GovernanceAuditEventSummaryProjectionApiDto {
  readonly eventId: string;
  readonly eventType: string;
  readonly category: string;
  readonly action: string;
  readonly outcome: string;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly summary: string;
  readonly actorId: string;
  readonly actorKind: string;
  readonly workspaceId?: string;
  readonly targetRef?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly hasProtectedData: boolean;
  readonly redactionReasons: ReadonlyArray<string>;
}

export interface GovernanceAuditEventDetailProjectionApiDto {
  readonly summary: GovernanceAuditEventSummaryProjectionApiDto;
  readonly visibility: "user-safe" | "admin";
  readonly adminOnlyDetails?: Readonly<Record<string, unknown>>;
  readonly explanatory: {
    readonly roleSensitivity: "workspace-member" | "workspace-admin";
    readonly notes: ReadonlyArray<string>;
  };
}

export interface ListGovernanceAuditEventsApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly query?: AuditLedgerListQueryDto;
}

export interface ListGovernanceAuditEventsApiResponse {
  readonly events: ReadonlyArray<GovernanceAuditEventSummaryProjectionApiDto>;
  readonly facets: ReadonlyArray<GovernanceAuditProjectionFacetApiDto>;
  readonly totalCount: number;
  readonly query: AuditLedgerListQueryDto;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
  readonly explanatory: {
    readonly detailVisibility: "user-safe";
    readonly facetCoverage: "page";
    readonly notes: ReadonlyArray<string>;
  };
}

export interface GetGovernanceAuditEventDetailApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly eventId: string;
}

export interface GetGovernanceAuditEventDetailApiResponse {
  readonly event: GovernanceAuditEventDetailProjectionApiDto;
}

