import type {
  ToolCapabilityProviderKind,
  ToolCapabilitySourceDescriptor,
} from "../../tools/models/ToolCapabilityDescriptor";

export interface AgentToolSelection {
  readonly mode: "all" | "capabilityIds" | "providerKinds" | "source" | "mixed";
  readonly capabilityIds?: ReadonlyArray<string>;
  readonly providerKinds?: ReadonlyArray<ToolCapabilityProviderKind>;
  readonly source?: ToolCapabilitySourceDescriptor;
}
