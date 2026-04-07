import type { IToolCapabilityCatalog } from "@application/ports/interfaces/IToolCapabilityCatalog";
import type { ToolCapabilityDescriptor } from "@application/tools/models/ToolCapabilityDescriptor";
import {
  buildToolCapabilityId,
  createToolCapabilityDescriptor,
} from "@application/tools/models/ToolCapabilityDescriptor";

export const LOCAL_TOOL_CAPABILITY_PROVIDER = Object.freeze({
  kind: "local",
  id: "local-runtime",
  label: "Local Tools",
} as const);

export type StaticLocalToolCapabilityDefinition = Omit<ToolCapabilityDescriptor, "identity" | "routingName"> & {
  readonly identity?: ToolCapabilityDescriptor["identity"];
  readonly routingName?: string;
};

export class StaticLocalToolCapabilityCatalog implements IToolCapabilityCatalog {
  constructor(
    private readonly capabilities: ReadonlyArray<StaticLocalToolCapabilityDefinition>
  ) {}

  public async listCapabilities(): Promise<ReadonlyArray<ToolCapabilityDescriptor>> {
    return Object.freeze(
      this.capabilities.map((capability) =>
        createToolCapabilityDescriptor({
          ...capability,
          id:
            capability.id ||
            buildToolCapabilityId("local", capability.source.localToolName ?? capability.displayName),
          identity:
            capability.identity ??
            Object.freeze({
              stableId: capability.source.localToolName ?? capability.id,
              providerScopedId: capability.source.localToolName ?? capability.id,
            }),
          routingName:
            capability.routingName ??
            capability.source.localToolName ??
            capability.publication.slug ??
            capability.displayName,
          provider: capability.provider,
          source: Object.freeze({
            kind: "local",
            ...capability.source,
          }),
          publication: capability.publication,
        })
      )
    );
  }
}

