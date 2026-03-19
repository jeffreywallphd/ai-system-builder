import type { IToolCapabilityCatalog } from "../ports/interfaces/IToolCapabilityCatalog";
import type { ToolCapabilityDescriptor } from "./models/ToolCapabilityDescriptor";

export interface ListToolCapabilitiesResult {
  readonly capabilities: ReadonlyArray<ToolCapabilityDescriptor>;
}

export class ListToolCapabilitiesUseCase {
  constructor(private readonly catalog: IToolCapabilityCatalog) {}

  public async execute(): Promise<ListToolCapabilitiesResult> {
    const capabilities = await this.catalog.listCapabilities();
    const uniqueById = new Map<string, ToolCapabilityDescriptor>();

    for (const capability of capabilities) {
      if (!uniqueById.has(capability.id)) {
        uniqueById.set(capability.id, capability);
      }
    }

    const sorted = [...uniqueById.values()].sort((left, right) => {
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

      const byDisplayName = left.displayName.localeCompare(right.displayName);
      if (byDisplayName !== 0) {
        return byDisplayName;
      }

      return left.id.localeCompare(right.id);
    });

    return Object.freeze({
      capabilities: Object.freeze(sorted),
    });
  }
}
