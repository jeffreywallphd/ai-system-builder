import type { ToolCapabilityInvocationResult } from "../../tools/models/ToolCapabilityInvocationResult";
import type {
  ToolCapabilityProviderDescriptor,
  ToolCapabilitySourceDescriptor,
} from "../../tools/models/ToolCapabilityDescriptor";

export interface AgentStepResult {
  readonly stepIndex: number;
  readonly taskInput?: string;
  readonly capabilityId: string;
  readonly displayName: string;
  readonly provider: ToolCapabilityProviderDescriptor;
  readonly source?: ToolCapabilitySourceDescriptor;
  readonly status: ToolCapabilityInvocationResult["status"] | "skipped";
  readonly reasoning?: string;
  readonly invocationArguments?: Readonly<Record<string, unknown>>;
  readonly result?: ToolCapabilityInvocationResult;
  readonly resultText?: string;
  readonly errorMessage?: string;
}
