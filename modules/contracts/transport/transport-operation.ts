import type { ContractBoundaryContext } from "../shared";

export type TransportOperation = string;

export type TransportMetadata = Readonly<Record<string, unknown>>;

export interface TransportEnvelope<
  TOperation extends TransportOperation = TransportOperation,
  TMetadata extends TransportMetadata = TransportMetadata,
> extends ContractBoundaryContext {
  operation: TOperation;
  metadata?: TMetadata;
}
