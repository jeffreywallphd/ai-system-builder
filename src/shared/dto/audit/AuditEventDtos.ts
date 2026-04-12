import {
  normalizeAuditEventListQuery,
  toAuditEventDetailView,
  toAuditEventSummaryView,
  type AuditEventDetailViewDto,
  type AuditEventEnvelopeDto,
  type AuditEventListQueryDto,
  type AuditEventSummaryViewDto,
} from "../../contracts/audit/AuditEventContracts";

export interface AuditLedgerAppendMutationDto {
  readonly operationKey: string;
  readonly actorId: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
}

export interface AuditLedgerAppendRequestDto {
  readonly event: AuditEventEnvelopeDto;
  readonly mutation: AuditLedgerAppendMutationDto;
}

export interface AuditLedgerAppendResponseDto {
  readonly changed: boolean;
  readonly wasReplay: boolean;
  readonly sequence: number;
  readonly event: AuditEventSummaryViewDto;
}

export interface AuditLedgerListQueryDto extends AuditEventListQueryDto {}

export interface AuditLedgerListResponseDto {
  readonly events: ReadonlyArray<AuditEventSummaryViewDto>;
  readonly totalCount: number;
  readonly query: AuditLedgerListQueryDto;
}

export interface AuditLedgerGetDetailResponseDto {
  readonly event: AuditEventDetailViewDto;
}

export function toAuditLedgerAppendResponseDto(input: {
  readonly changed: boolean;
  readonly wasReplay: boolean;
  readonly sequence: number;
  readonly event: AuditEventEnvelopeDto;
}): AuditLedgerAppendResponseDto {
  return Object.freeze({
    changed: input.changed,
    wasReplay: input.wasReplay,
    sequence: input.sequence,
    event: toAuditEventSummaryView(input.event),
  });
}

export function toAuditLedgerListResponseDto(input: {
  readonly events: ReadonlyArray<AuditEventEnvelopeDto>;
  readonly query: AuditLedgerListQueryDto;
  readonly totalCount?: number;
}): AuditLedgerListResponseDto {
  const query = normalizeAuditEventListQuery(input.query);
  const events = Object.freeze(input.events.map((event) => toAuditEventSummaryView(event)));
  return Object.freeze({
    events,
    totalCount: input.totalCount ?? events.length,
    query,
  });
}

export function toAuditLedgerGetDetailResponseDto(input: {
  readonly event: AuditEventEnvelopeDto;
  readonly visibility?: "user-safe" | "admin";
}): AuditLedgerGetDetailResponseDto {
  return Object.freeze({
    event: toAuditEventDetailView(input.event, input.visibility ?? "user-safe"),
  });
}
