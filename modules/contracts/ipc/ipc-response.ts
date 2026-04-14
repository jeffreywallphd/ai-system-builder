import {
  type ContractErrorDetails,
  type ContractFailure,
  type ContractSuccess,
  createFailureResult,
  createSuccessResult,
} from "../shared";
import type { TransportEnvelope } from "../transport";
import type { IpcChannelValue } from "./ipc-channel";
import type { IpcError } from "./ipc-error";
import type { IpcMetadata, IpcOperation } from "./ipc-operation";

export interface IpcEnvelope<
  TOperation extends IpcOperation = IpcOperation,
  TMetadata extends IpcMetadata = IpcMetadata,
  TChannel extends IpcChannelValue = IpcChannelValue,
> extends TransportEnvelope<TOperation, TMetadata> {
  channel: TChannel;
}

export type IpcSuccessResponse<
  TPayload,
  TOperation extends IpcOperation = IpcOperation,
  TMetadata extends IpcMetadata = IpcMetadata,
  TChannel extends IpcChannelValue = IpcChannelValue,
> = IpcEnvelope<TOperation, TMetadata, TChannel> & ContractSuccess<TPayload>;

export type IpcFailureResponse<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
  TOperation extends IpcOperation = IpcOperation,
  TMetadata extends IpcMetadata = IpcMetadata,
  TChannel extends IpcChannelValue = IpcChannelValue,
> = Omit<ContractFailure<TDetails>, "error"> &
  IpcEnvelope<TOperation, TMetadata, TChannel> & {
    error: IpcError<TDetails, TOperation, TMetadata, TChannel>;
  };

export type IpcResponse<
  TPayload,
  TDetails extends ContractErrorDetails = ContractErrorDetails,
  TOperation extends IpcOperation = IpcOperation,
  TMetadata extends IpcMetadata = IpcMetadata,
  TChannel extends IpcChannelValue = IpcChannelValue,
> =
  | IpcSuccessResponse<TPayload, TOperation, TMetadata, TChannel>
  | IpcFailureResponse<TDetails, TOperation, TMetadata, TChannel>;

export function createIpcSuccessResponse<
  TPayload,
  TOperation extends IpcOperation = IpcOperation,
  TMetadata extends IpcMetadata = IpcMetadata,
  TChannel extends IpcChannelValue = IpcChannelValue,
>(
  channel: TChannel,
  operation: TOperation,
  value: TPayload,
  options?: {
    requestId?: string;
    correlationId?: string;
    metadata?: TMetadata;
  },
): IpcSuccessResponse<TPayload, TOperation, TMetadata, TChannel> {
  const result = createSuccessResult(value, {
    requestId: options?.requestId,
    correlationId: options?.correlationId,
  });

  return {
    ...result,
    channel,
    operation,
    metadata: options?.metadata,
  };
}

export function createIpcFailureResponse<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
  TOperation extends IpcOperation = IpcOperation,
  TMetadata extends IpcMetadata = IpcMetadata,
  TChannel extends IpcChannelValue = IpcChannelValue,
>(
  error: IpcError<TDetails, TOperation, TMetadata, TChannel>,
  options?: {
    requestId?: string;
    correlationId?: string;
    metadata?: TMetadata;
  },
): IpcFailureResponse<TDetails, TOperation, TMetadata, TChannel> {
  const result = createFailureResult(error, {
    requestId: options?.requestId,
    correlationId: options?.correlationId,
  });

  return {
    ...result,
    channel: error.channel,
    operation: error.operation,
    metadata: options?.metadata ?? error.metadata,
  };
}
