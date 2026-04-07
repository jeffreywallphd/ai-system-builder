import type {
  ToolCapabilityProviderDescriptor,
  ToolCapabilitySerializableValue,
  ToolCapabilitySourceDescriptor,
} from "./ToolCapabilityDescriptor";

export interface ToolCapabilityInvocationResult {
  readonly capabilityId: string;
  readonly executionId: string;
  readonly status: "completed" | "failed" | "cancelled";
  readonly provider: ToolCapabilityProviderDescriptor;
  readonly source?: ToolCapabilitySourceDescriptor;
  readonly content: ReadonlyArray<Readonly<Record<string, ToolCapabilitySerializableValue>>>;
  readonly structuredContent?: Readonly<Record<string, ToolCapabilitySerializableValue>>;
  readonly metadata?: Readonly<Record<string, ToolCapabilitySerializableValue>>;
  readonly errorMessage?: string;
}
