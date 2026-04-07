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

