import type { ToolCapabilityProviderKind } from "../../tools/models/ToolCapabilityDescriptor";

export interface CapabilitySearchQuery {
  readonly query?: string;
  readonly limit?: number;
  readonly providerKinds?: ReadonlyArray<ToolCapabilityProviderKind>;
  readonly includeMcpServers?: boolean;
  readonly includeMcpResources?: boolean;
}
