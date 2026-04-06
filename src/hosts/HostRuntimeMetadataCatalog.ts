import {
  type HostCapabilityFlag,
  type HostRuntimeIdentity,
  type HostRuntimeKind,
} from "../domain/hosts/HostRuntimeDomain";
import { createHostRuntimeMetadata, type HostRuntimeMetadata } from "../application/common/HostCompositionContracts";
import { HostRuntimeCatalog } from "./HostRuntimeCatalog";

export const HostRuntimeMetadataArtifactKey = "artifact:host:runtime:metadata";

export function advertiseHostRuntimeMetadata(input: {
  readonly host: HostRuntimeIdentity;
  readonly advertisedCapabilities?: ReadonlyArray<HostCapabilityFlag>;
  readonly metadata?: Readonly<Record<string, string | undefined>>;
}): HostRuntimeMetadata {
  return createHostRuntimeMetadata({
    host: input.host,
    advertisedCapabilities: input.advertisedCapabilities,
    metadata: input.metadata,
  });
}

export function resolveHostRuntimeMetadataFromCatalog(
  kind: HostRuntimeKind,
  options?: {
    readonly advertisedCapabilities?: ReadonlyArray<HostCapabilityFlag>;
    readonly metadata?: Readonly<Record<string, string | undefined>>;
  },
): HostRuntimeMetadata {
  return advertiseHostRuntimeMetadata({
    host: HostRuntimeCatalog[kind],
    advertisedCapabilities: options?.advertisedCapabilities,
    metadata: options?.metadata,
  });
}

export function listHostRuntimeMetadataCatalog(): ReadonlyArray<HostRuntimeMetadata> {
  return Object.freeze(
    Object.values(HostRuntimeCatalog).map((host) => advertiseHostRuntimeMetadata({ host })),
  );
}
