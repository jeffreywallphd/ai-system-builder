import type { ContractBoundaryContext } from "../shared";
import {
  normalizeStagedDataDescriptorInput,
  type StagedDataDescriptorInput,
  type StagedDataMetadata,
} from "./staged-data-descriptor";

export interface RegisterStagedDataRequest<
  TContent = Uint8Array,
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
> extends ContractBoundaryContext {
  descriptor: StagedDataDescriptorInput<TMetadata>;
  content: TContent;
  overwrite?: boolean;
}

export function createRegisterStagedDataRequest<
  TContent,
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
>(
  content: TContent,
  options?: {
    descriptor?: StagedDataDescriptorInput<TMetadata>;
    overwrite?: boolean;
    requestId?: string;
    correlationId?: string;
  },
): RegisterStagedDataRequest<TContent, TMetadata> {
  return {
    descriptor: normalizeStagedDataDescriptorInput(options?.descriptor),
    content,
    overwrite: options?.overwrite,
    requestId: options?.requestId,
    correlationId: options?.correlationId,
  };
}
