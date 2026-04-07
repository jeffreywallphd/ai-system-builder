import type { McpResourceDescriptor } from "../../mcp/models/McpResourceDescriptor";
import type { McpServerDescriptor } from "../../mcp/models/McpServerDescriptor";
import type {
  ToolCapabilityDescriptor,
  ToolCapabilityProviderKind,
} from "../../tools/models/ToolCapabilityDescriptor";

export type CapabilitySearchCandidateKind = "tool-capability" | "mcp-server" | "mcp-resource";

export interface CapabilitySearchCandidate {
  readonly id: string;
  readonly kind: CapabilitySearchCandidateKind;
  readonly title: string;
  readonly subtitle?: string;
  readonly description?: string;
  readonly providerKind?: ToolCapabilityProviderKind | "mcp";
  readonly score: number;
  readonly matchReasons: ReadonlyArray<string>;
  readonly capability?: ToolCapabilityDescriptor;
  readonly server?: McpServerDescriptor;
  readonly resource?: McpResourceDescriptor;
}

export interface CapabilitySearchSourceSummary {
  readonly toolCapabilities: number;
  readonly mcpServers: number;
  readonly mcpResources: number;
}

export interface CapabilitySearchResult {
  readonly query: string;
  readonly limit: number;
  readonly totalCandidateCount: number;
  readonly truncated: boolean;
  readonly sources: CapabilitySearchSourceSummary;
  readonly candidates: ReadonlyArray<CapabilitySearchCandidate>;
}
