import type { IToolCapabilityCatalog } from "../ports/interfaces/IToolCapabilityCatalog";
import type { ToolCapabilityDescriptor } from "./models/ToolCapabilityDescriptor";

export interface ListToolCapabilitiesResult {
  readonly capabilities: ReadonlyArray<ToolCapabilityDescriptor>;
}

export class ListToolCapabilitiesUseCase {
  constructor(private readonly catalog: IToolCapabilityCatalog) {}

  public async execute(): Promise<ListToolCapabilitiesResult> {
    const capabilities = await this.catalog.listCapabilities();
    const sorted = [...capabilities].sort((left, right) => {
      const byName = left.displayName.localeCompare(right.displayName);
      if (byName !== 0) {
        return byName;
      }

      return left.id.localeCompare(right.id);
    });

    return Object.freeze({
      capabilities: Object.freeze(sorted),
    });
  }
}
