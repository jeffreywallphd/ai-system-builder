import type { ToolCapabilityInvocationRequest } from "../../tools/models/ToolCapabilityInvocationRequest";
import type { ToolCapabilityInvocationResult } from "../../tools/models/ToolCapabilityInvocationResult";

export interface IToolCapabilityExecutor {
  invoke(request: ToolCapabilityInvocationRequest): Promise<ToolCapabilityInvocationResult>;
}
