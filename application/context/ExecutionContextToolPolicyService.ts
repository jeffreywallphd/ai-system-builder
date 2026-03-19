import type { ExecutionContextEnvelope } from "./models/ExecutionContextEnvelope";
import type {
  ToolCapabilityProviderKind,
  ToolCapabilitySourceDescriptor,
} from "../tools/models/ToolCapabilityDescriptor";

function includesValue(values: ReadonlyArray<string> | undefined, candidate: string | undefined): boolean {
  if (!values || values.length === 0 || !candidate) {
    return false;
  }

  return values.includes(candidate);
}

export class ExecutionContextToolPolicyService {
  public isProviderAllowed(
    providerKind: ToolCapabilityProviderKind,
    context?: ExecutionContextEnvelope
  ): boolean {
    const policy = context?.toolUsePolicy;
    if (!policy) {
      return true;
    }

    if (policy.allowedProviderKinds && policy.allowedProviderKinds.length > 0) {
      return policy.allowedProviderKinds.includes(providerKind);
    }

    if (policy.blockedProviderKinds && policy.blockedProviderKinds.includes(providerKind)) {
      return false;
    }

    return true;
  }

  public isSourceAllowed(
    providerKind: ToolCapabilityProviderKind,
    source: ToolCapabilitySourceDescriptor | undefined,
    context?: ExecutionContextEnvelope
  ): boolean {
    if (!this.isProviderAllowed(providerKind, context)) {
      return false;
    }

    if (providerKind !== "mcp") {
      return true;
    }

    const mcpPolicy = context?.toolUsePolicy?.mcp;
    if (!mcpPolicy) {
      return true;
    }

    if (mcpPolicy.allowedServerIds && mcpPolicy.allowedServerIds.length > 0) {
      if (!includesValue(mcpPolicy.allowedServerIds, source?.serverId)) {
        return false;
      }
    }

    if (includesValue(mcpPolicy.blockedServerIds, source?.serverId)) {
      return false;
    }

    if (mcpPolicy.allowedToolNames && mcpPolicy.allowedToolNames.length > 0) {
      if (!includesValue(mcpPolicy.allowedToolNames, source?.toolName)) {
        return false;
      }
    }

    if (includesValue(mcpPolicy.blockedToolNames, source?.toolName)) {
      return false;
    }

    return true;
  }

  public assertInvocationAllowed(
    providerKind: ToolCapabilityProviderKind,
    source: ToolCapabilitySourceDescriptor | undefined,
    context?: ExecutionContextEnvelope
  ): void {
    if (!this.isSourceAllowed(providerKind, source, context)) {
      if (providerKind === "mcp") {
        throw new Error("Execution context policy blocked the requested MCP tool invocation.");
      }

      throw new Error(`Execution context policy blocked provider kind '${providerKind}'.`);
    }
  }
}
