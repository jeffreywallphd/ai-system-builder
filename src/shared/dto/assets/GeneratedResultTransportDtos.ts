import type {
  GetGeneratedResultLineageDetailResponseDto as GetGeneratedResultLineageDetailResponseContract,
  GetGeneratedResultLineageSummaryResponseDto as GetGeneratedResultLineageSummaryResponseContract,
  GetGeneratedResultResponseDto as GetGeneratedResultResponseContract,
  ListGeneratedResultsByRunResponseDto as ListGeneratedResultsByRunResponseContract,
  ListGeneratedResultsResponseDto as ListGeneratedResultsResponseContract,
  RequestGeneratedResultOriginalAccessResponseDto as RequestGeneratedResultOriginalAccessResponseContract,
  RequestGeneratedResultPreviewResponseDto as RequestGeneratedResultPreviewResponseContract,
  GeneratedResultDetailDto,
  GeneratedResultLineageDetailDto,
  GeneratedResultLineageSummaryDto,
  GeneratedResultSummaryDto,
} from "@shared/contracts/assets/GeneratedResultTransportContracts";

export interface ListGeneratedResultsResponseDto extends ListGeneratedResultsResponseContract {}
export interface GetGeneratedResultResponseDto extends GetGeneratedResultResponseContract {}
export interface ListGeneratedResultsByRunResponseDto extends ListGeneratedResultsByRunResponseContract {}
export interface RequestGeneratedResultPreviewResponseDto extends RequestGeneratedResultPreviewResponseContract {}
export interface RequestGeneratedResultOriginalAccessResponseDto
  extends RequestGeneratedResultOriginalAccessResponseContract {}
export interface GetGeneratedResultLineageSummaryResponseDto
  extends GetGeneratedResultLineageSummaryResponseContract {}
export interface GetGeneratedResultLineageDetailResponseDto extends GetGeneratedResultLineageDetailResponseContract {}

export function toListGeneratedResultsResponseDto(input: {
  readonly contractVersion: ListGeneratedResultsResponseDto["contractVersion"];
  readonly items: ReadonlyArray<GeneratedResultSummaryDto>;
  readonly pagination: ListGeneratedResultsResponseDto["pagination"];
}): ListGeneratedResultsResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    items: Object.freeze([...input.items]),
    pagination: input.pagination,
  });
}

export function toGetGeneratedResultResponseDto(input: {
  readonly contractVersion: GetGeneratedResultResponseDto["contractVersion"];
  readonly result: GeneratedResultDetailDto;
}): GetGeneratedResultResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    result: input.result,
  });
}

export function toListGeneratedResultsByRunResponseDto(input: {
  readonly contractVersion: ListGeneratedResultsByRunResponseDto["contractVersion"];
  readonly runId: string;
  readonly items: ReadonlyArray<GeneratedResultSummaryDto>;
  readonly pagination: ListGeneratedResultsByRunResponseDto["pagination"];
}): ListGeneratedResultsByRunResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    runId: input.runId,
    items: Object.freeze([...input.items]),
    pagination: input.pagination,
  });
}

export function toRequestGeneratedResultPreviewResponseDto(
  input: RequestGeneratedResultPreviewResponseDto,
): RequestGeneratedResultPreviewResponseDto {
  return Object.freeze({
    ...input,
  });
}

export function toRequestGeneratedResultOriginalAccessResponseDto(
  input: RequestGeneratedResultOriginalAccessResponseDto,
): RequestGeneratedResultOriginalAccessResponseDto {
  return Object.freeze({
    ...input,
  });
}

export function toGetGeneratedResultLineageSummaryResponseDto(input: {
  readonly contractVersion: GetGeneratedResultLineageSummaryResponseDto["contractVersion"];
  readonly lineage: GeneratedResultLineageSummaryDto;
}): GetGeneratedResultLineageSummaryResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    lineage: input.lineage,
  });
}

export function toGetGeneratedResultLineageDetailResponseDto(input: {
  readonly contractVersion: GetGeneratedResultLineageDetailResponseDto["contractVersion"];
  readonly lineage: GeneratedResultLineageDetailDto;
}): GetGeneratedResultLineageDetailResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    lineage: input.lineage,
  });
}
