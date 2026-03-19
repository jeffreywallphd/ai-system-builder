import type {
  ToolCapabilityProviderDescriptor,
  ToolCapabilitySourceDescriptor,
} from "./ToolCapabilityDescriptor";

export interface ToolCapabilityInvocationResult {
  readonly capabilityId: string;
  readonly executionId: string;
  readonly status: "completed" | "failed" | "cancelled";
  readonly provider: ToolCapabilityProviderDescriptor;
  readonly source?: ToolCapabilitySourceDescriptor;
  readonly content: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly structuredContent?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly errorMessage?: string;
}
