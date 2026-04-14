import type { ContractBoundaryContext } from "../shared";
import { createHostIdentity, type HostIdentity } from "./host-identity";
import type { HostKind } from "./host-kind";

export type HostContextMetadata = Readonly<Record<string, unknown>>;

export interface HostContext extends ContractBoundaryContext {
  host: HostIdentity;
  metadata?: HostContextMetadata;
}

export function createHostContext(
  host: HostIdentity | HostKind,
  options?: {
    hostId?: string;
    requestId?: string;
    correlationId?: string;
    metadata?: HostContextMetadata;
  },
): HostContext {
  const resolvedHost =
    typeof host === "string"
      ? createHostIdentity(host, { id: options?.hostId })
      : host;

  return {
    host: resolvedHost,
    requestId: options?.requestId,
    correlationId: options?.correlationId,
    metadata: options?.metadata,
  };
}
