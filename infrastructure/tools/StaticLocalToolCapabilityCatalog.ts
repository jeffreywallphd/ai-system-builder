import type { IToolCapabilityCatalog } from "../../application/ports/interfaces/IToolCapabilityCatalog";
import type { ToolCapabilityDescriptor } from "../../application/tools/models/ToolCapabilityDescriptor";

export const LOCAL_TOOL_CAPABILITY_PROVIDER = Object.freeze({
  kind: "local",
  id: "local-runtime",
  label: "Local Tools",
} as const);

export class StaticLocalToolCapabilityCatalog implements IToolCapabilityCatalog {
  constructor(
    private readonly capabilities: ReadonlyArray<ToolCapabilityDescriptor>
  ) {}

  public async listCapabilities(): Promise<ReadonlyArray<ToolCapabilityDescriptor>> {
    return Object.freeze([...this.capabilities]);
  }
}
