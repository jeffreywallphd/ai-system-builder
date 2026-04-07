import type { IToolCapabilityCatalog } from "../../application/ports/interfaces/IToolCapabilityCatalog";
import type { ToolCapabilityDescriptor } from "../../application/tools/models/ToolCapabilityDescriptor";

export class CompositeToolCapabilityCatalog implements IToolCapabilityCatalog {
  constructor(
    private readonly catalogs: ReadonlyArray<IToolCapabilityCatalog>
  ) {}

  public async listCapabilities(): Promise<ReadonlyArray<ToolCapabilityDescriptor>> {
    const capabilities = await Promise.all(
      this.catalogs.map((catalog) => catalog.listCapabilities())
    );

    const uniqueById = new Map<string, ToolCapabilityDescriptor>();
    for (const entries of capabilities) {
      for (const capability of entries) {
        if (!uniqueById.has(capability.id)) {
          uniqueById.set(capability.id, capability);
        }
      }
    }

    return Object.freeze(
      [...uniqueById.values()].sort((left, right) => {
        const byProviderKind = left.provider.kind.localeCompare(right.provider.kind);
        if (byProviderKind !== 0) {
          return byProviderKind;
        }

        const byProviderId = left.provider.id.localeCompare(right.provider.id);
        if (byProviderId !== 0) {
          return byProviderId;
        }

        const byRoutingName = left.routingName.localeCompare(right.routingName);
        if (byRoutingName !== 0) {
          return byRoutingName;
        }

        return left.id.localeCompare(right.id);
      })
    );
  }
}
