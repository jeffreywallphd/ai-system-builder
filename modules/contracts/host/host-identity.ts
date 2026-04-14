import type { HostKind } from "./host-kind";

export interface HostIdentity {
  kind: HostKind;
  id?: string;
}

export function createHostIdentity(
  kind: HostKind,
  options?: {
    id?: string;
  },
): HostIdentity {
  return {
    kind,
    id: options?.id,
  };
}
