import type {
  CancelImageRunResponseDto as CancelImageRunResponseContract,
  GetImageRunExecutionReadinessResponseDto as GetImageRunExecutionReadinessResponseContract,
  GetImageRunResponseDto as GetImageRunResponseContract,
  GetImageRunStatusResponseDto as GetImageRunStatusResponseContract,
  ImageRunDetailDto,
  ImageRunEventEnvelopeDto,
  ImageRunExecutionReadinessSummaryDto,
  ImageRunSummaryDto,
  ListImageRunEventsResponseDto as ListImageRunEventsResponseContract,
  ListImageRunsResponseDto as ListImageRunsResponseContract,
  SubmitImageRunResponseDto as SubmitImageRunResponseContract,
} from "@shared/contracts/image-workflows/ImageRunApiContracts";
import type { SharedApiMutationResult } from "@shared/contracts/api/SharedApiContractPrimitives";

export interface SubmitImageRunResponseDto extends SubmitImageRunResponseContract {}
export interface GetImageRunResponseDto extends GetImageRunResponseContract {}
export interface ListImageRunsResponseDto extends ListImageRunsResponseContract {}
export interface GetImageRunStatusResponseDto extends GetImageRunStatusResponseContract {}
export interface CancelImageRunResponseDto extends CancelImageRunResponseContract {}
export interface GetImageRunExecutionReadinessResponseDto extends GetImageRunExecutionReadinessResponseContract {}
export interface ListImageRunEventsResponseDto extends ListImageRunEventsResponseContract {}

export function toSubmitImageRunResponseDto(input: {
  readonly contractVersion: SubmitImageRunResponseDto["contractVersion"];
  readonly run: ImageRunDetailDto;
  readonly mutation: SharedApiMutationResult;
}): SubmitImageRunResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    run: input.run,
    mutation: input.mutation,
  });
}

export function toGetImageRunResponseDto(input: {
  readonly contractVersion: GetImageRunResponseDto["contractVersion"];
  readonly run: ImageRunDetailDto;
}): GetImageRunResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    run: input.run,
  });
}

export function toListImageRunsResponseDto(input: {
  readonly contractVersion: ListImageRunsResponseDto["contractVersion"];
  readonly items: ReadonlyArray<ImageRunSummaryDto>;
  readonly pagination: ListImageRunsResponseDto["pagination"];
}): ListImageRunsResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    items: Object.freeze([...input.items]),
    pagination: input.pagination,
  });
}

export function toGetImageRunStatusResponseDto(input: GetImageRunStatusResponseDto): GetImageRunStatusResponseDto {
  return Object.freeze({
    ...input,
  });
}

export function toCancelImageRunResponseDto(input: {
  readonly contractVersion: CancelImageRunResponseDto["contractVersion"];
  readonly run: ImageRunDetailDto;
  readonly mutation: SharedApiMutationResult;
}): CancelImageRunResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    run: input.run,
    mutation: input.mutation,
  });
}

export function toGetImageRunExecutionReadinessResponseDto(input: {
  readonly contractVersion: GetImageRunExecutionReadinessResponseDto["contractVersion"];
  readonly readiness: ImageRunExecutionReadinessSummaryDto;
}): GetImageRunExecutionReadinessResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    readiness: input.readiness,
  });
}

export function toListImageRunEventsResponseDto(input: {
  readonly contractVersion: ListImageRunEventsResponseDto["contractVersion"];
  readonly items: ReadonlyArray<ImageRunEventEnvelopeDto>;
  readonly nextCursor?: string;
}): ListImageRunEventsResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    items: Object.freeze([...input.items]),
    nextCursor: input.nextCursor,
  });
}

