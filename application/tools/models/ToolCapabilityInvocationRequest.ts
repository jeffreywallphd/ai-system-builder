import type { ExecutionContextEnvelope } from "../../context/models/ExecutionContextEnvelope";

import type {
  ToolCapabilityProviderDescriptor,
  ToolCapabilitySerializableValue,
  ToolCapabilitySourceDescriptor,
} from "./ToolCapabilityDescriptor";

export interface ToolCapabilityInvocationRequest {
  readonly context?: ExecutionContextEnvelope;
  readonly capabilityId: string;
  readonly provider: ToolCapabilityProviderDescriptor;
  readonly source?: ToolCapabilitySourceDescriptor;
  readonly arguments?: Readonly<Record<string, ToolCapabilitySerializableValue>>;
  readonly executionId?: string;
  readonly metadata?: Readonly<Record<string, ToolCapabilitySerializableValue>>;
}
