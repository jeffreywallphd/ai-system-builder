import type { ContractErrorCode, ContractErrorDetails } from "../shared";
import {
  createTransportError,
  type TransportError,
} from "../transport";
import type { IpcChannelValue } from "./ipc-channel";
import type { IpcMetadata, IpcOperation } from "./ipc-operation";

export interface IpcError<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
  TOperation extends IpcOperation = IpcOperation,
  TMetadata extends IpcMetadata = IpcMetadata,
  TChannel extends IpcChannelValue = IpcChannelValue,
> extends TransportError<TDetails, TOperation, TMetadata> {
  channel: TChannel;
}

export function createIpcError<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
  TOperation extends IpcOperation = IpcOperation,
  TMetadata extends IpcMetadata = IpcMetadata,
  TChannel extends IpcChannelValue = IpcChannelValue,
>(
  channel: TChannel,
  operation: TOperation,
  code: ContractErrorCode,
  message: string,
  options?: {
    details?: TDetails;
    requestId?: string;
    correlationId?: string;
    metadata?: TMetadata;
  },
): IpcError<TDetails, TOperation, TMetadata, TChannel> {
  return {
    ...createTransportError(operation, code, message, {
      details: options?.details,
      requestId: options?.requestId,
      correlationId: options?.correlationId,
      metadata: options?.metadata,
    }),
    channel,
  };
}
