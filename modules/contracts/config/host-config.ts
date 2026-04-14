import { resolveHostKind, type HostKind } from "../host";

export interface HostConfig {
  kind: HostKind;
  id?: string;
}

export function createHostConfig(options?: {
  kind?: string;
  id?: string;
}): HostConfig {
  return {
    kind: resolveHostKind(options?.kind),
    id: options?.id,
  };
}
