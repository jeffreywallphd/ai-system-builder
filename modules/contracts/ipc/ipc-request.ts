import {
  createTransportRequest,
  type TransportRequest,
} from "../transport";
import type { IpcChannelValue } from "./ipc-channel";
import type { IpcMetadata, IpcOperation } from "./ipc-operation";

export interface IpcRequest<
  TPayload = unknown,
  TOperation extends IpcOperation = IpcOperation,
  TMetadata extends IpcMetadata = IpcMetadata,
  TChannel extends IpcChannelValue = IpcChannelValue,
> extends TransportRequest<TPayload, TOperation, TMetadata> {
  channel: TChannel;
}

export function createIpcRequest<
  TPayload,
  TOperation extends IpcOperation = IpcOperation,
  TMetadata extends IpcMetadata = IpcMetadata,
  TChannel extends IpcChannelValue = IpcChannelValue,
>(
  channel: TChannel,
  operation: TOperation,
  payload: TPayload,
  options?: {
    requestId?: string;
    correlationId?: string;
    metadata?: TMetadata;
  },
): IpcRequest<TPayload, TOperation, TMetadata, TChannel> {
  return {
    ...createTransportRequest(operation, payload, options),
    channel,
  };
}
