import type { IpcOperation } from "./ipc-operation";

export type IpcChannelValue = `${string}.${string}`;

export interface IpcChannel<
  TOperation extends IpcOperation = IpcOperation,
  TChannel extends IpcChannelValue = IpcChannelValue,
> {
  operation: TOperation;
  value: TChannel;
}

function normalizeIpcChannelSegment(segment: string): string {
  const normalized = segment.trim();

  if (!normalized) {
    throw new Error("IPC channel segments must be non-empty strings.");
  }

  return normalized;
}

export function createIpcChannelValue(
  firstSegment: string,
  secondSegment: string,
  ...remainingSegments: readonly string[]
): IpcChannelValue {
  const segments = [firstSegment, secondSegment, ...remainingSegments].map(
    normalizeIpcChannelSegment,
  );

  return segments.join(".") as IpcChannelValue;
}

export function createIpcChannel<
  TOperation extends IpcOperation = IpcOperation,
  TChannel extends IpcChannelValue = IpcChannelValue,
>(operation: TOperation, channelValue: TChannel): IpcChannel<TOperation, TChannel> {
  return {
    operation,
    value: channelValue,
  };
}
