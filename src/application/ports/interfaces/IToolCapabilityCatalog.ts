import type { ToolCapabilityDescriptor } from "../../tools/models/ToolCapabilityDescriptor";

export interface IToolCapabilityCatalog {
  listCapabilities(): Promise<ReadonlyArray<ToolCapabilityDescriptor>>;
}
