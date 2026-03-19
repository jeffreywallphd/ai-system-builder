import type {
  ToolCapabilityProviderDescriptor,
  ToolCapabilitySerializableValue,
  ToolCapabilitySourceDescriptor,
} from "./ToolCapabilityDescriptor";

export interface ToolCapabilityInvocationRequest {
  readonly capabilityId: string;
  readonly provider: ToolCapabilityProviderDescriptor;
  readonly source?: ToolCapabilitySourceDescriptor;
  readonly arguments?: Readonly<Record<string, ToolCapabilitySerializableValue>>;
  readonly executionId?: string;
  readonly metadata?: Readonly<Record<string, ToolCapabilitySerializableValue>>;
}
