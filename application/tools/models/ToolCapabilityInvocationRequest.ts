import type {
  ToolCapabilityProviderDescriptor,
  ToolCapabilitySourceDescriptor,
} from "./ToolCapabilityDescriptor";

export interface ToolCapabilityInvocationRequest {
  readonly capabilityId: string;
  readonly provider: ToolCapabilityProviderDescriptor;
  readonly source?: ToolCapabilitySourceDescriptor;
  readonly arguments?: Readonly<Record<string, unknown>>;
  readonly executionId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
