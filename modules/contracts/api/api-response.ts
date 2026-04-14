import {
  type ContractErrorDetails,
  type ContractFailure,
  type ContractSuccess,
  createFailureResult,
  createSuccessResult,
} from "../shared";
import type { TransportEnvelope } from "../transport";
import type { ApiError } from "./api-error";
import type { ApiMetadata, ApiOperation } from "./api-operation";

export type ApiSuccessResponse<
  TPayload,
  TOperation extends ApiOperation = ApiOperation,
  TMetadata extends ApiMetadata = ApiMetadata,
> = TransportEnvelope<TOperation, TMetadata> & ContractSuccess<TPayload>;

export type ApiFailureResponse<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
  TOperation extends ApiOperation = ApiOperation,
  TMetadata extends ApiMetadata = ApiMetadata,
> = Omit<ContractFailure<TDetails>, "error"> &
  TransportEnvelope<TOperation, TMetadata> & {
    error: ApiError<TDetails, TOperation, TMetadata>;
  };

export type ApiResponse<
  TPayload,
  TDetails extends ContractErrorDetails = ContractErrorDetails,
  TOperation extends ApiOperation = ApiOperation,
  TMetadata extends ApiMetadata = ApiMetadata,
> =
  | ApiSuccessResponse<TPayload, TOperation, TMetadata>
  | ApiFailureResponse<TDetails, TOperation, TMetadata>;

export function createApiSuccessResponse<
  TPayload,
  TOperation extends ApiOperation = ApiOperation,
  TMetadata extends ApiMetadata = ApiMetadata,
>(
  operation: TOperation,
  value: TPayload,
  options?: {
    requestId?: string;
    correlationId?: string;
    metadata?: TMetadata;
  },
): ApiSuccessResponse<TPayload, TOperation, TMetadata> {
  const result = createSuccessResult(value, {
    requestId: options?.requestId,
    correlationId: options?.correlationId,
  });

  return {
    ...result,
    operation,
    metadata: options?.metadata,
  };
}

export function createApiFailureResponse<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
  TOperation extends ApiOperation = ApiOperation,
  TMetadata extends ApiMetadata = ApiMetadata,
>(
  error: ApiError<TDetails, TOperation, TMetadata>,
  options?: {
    requestId?: string;
    correlationId?: string;
    metadata?: TMetadata;
  },
): ApiFailureResponse<TDetails, TOperation, TMetadata> {
  const result = createFailureResult(error, {
    requestId: options?.requestId,
    correlationId: options?.correlationId,
  });

  return {
    ...result,
    operation: error.operation,
    metadata: options?.metadata ?? error.metadata,
  };
}
