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

    return Object.freeze(capabilities.flatMap((entries) => [...entries]));
  }
}
