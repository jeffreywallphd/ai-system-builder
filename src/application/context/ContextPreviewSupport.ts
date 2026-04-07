import type { IResolveWorkflowContextResult } from "./WorkflowContextService";
import type {
  ContextPreviewCapabilityDecision,
  ContextPreviewDeliveryTarget,
  ContextPreviewResult,
  ContextPreviewTargetKind,
} from "./models/ContextPreview";
import type {
  ToolCapabilityDescriptor,
  ToolCapabilityProviderKind,
} from "../tools/models/ToolCapabilityDescriptor";

function describeProviderKinds(values?: ReadonlyArray<ToolCapabilityProviderKind>): string {
  if (!values || values.length === 0) {
    return "all providers";
  }

  return values.join(", ");
}

export function createBasePreviewResult(params: {
  readonly target: {
    readonly kind: ContextPreviewTargetKind;
    readonly id: string;
    readonly label: string;
    readonly workflowId?: string;
    readonly workflowLabel?: string;
  };
  readonly resolved: IResolveWorkflowContextResult;
  readonly deliveryTargets: ReadonlyArray<ContextPreviewDeliveryTarget>;
  readonly capabilityDecisions?: ReadonlyArray<ContextPreviewCapabilityDecision>;
}): ContextPreviewResult {
  return Object.freeze({
    target: Object.freeze({ ...params.target }),
    inspection: params.resolved.inspection,
    executionContext: params.resolved.executionContext,
    selectedRecipeIds: params.resolved.selectedRecipeIds,
    selectedPackageIds: params.resolved.selectedPackageIds,
    recipeLabels: params.resolved.recipeLabels,
    packageLabels: params.resolved.packageLabels,
    deliveryTargets: Object.freeze(params.deliveryTargets.map((target) => Object.freeze({ ...target }))),
    capabilityDecisions: params.capabilityDecisions
      ? Object.freeze(params.capabilityDecisions.map((decision) => Object.freeze({ ...decision })))
      : undefined,
  });
}

export function createDeliveryTargets(params: {
  readonly kind: ContextPreviewTargetKind;
  readonly finalPromptText: string;
  readonly assembledPromptText: string;
  readonly toolUsePolicy?: IResolveWorkflowContextResult["executionContext"]["toolUsePolicy"];
  readonly capabilityDecisions?: ReadonlyArray<ContextPreviewCapabilityDecision>;
}): ReadonlyArray<ContextPreviewDeliveryTarget> {
  const { kind, finalPromptText, assembledPromptText, toolUsePolicy, capabilityDecisions } = params;
  const targets: ContextPreviewDeliveryTarget[] = [
    Object.freeze({
      channel: "prompt",
      label: "Prompt Context",
      summary: "Exact prompt-ready context after assembly, trimming, and budgeting.",
      content: finalPromptText,
      metadata: Object.freeze({ assembledPromptText }),
    }),
  ];

  if (kind === "workflow") {
    targets.push(
      Object.freeze({
        channel: "workflow-execution",
        label: "Workflow Execution Metadata",
        summary: "Injected into workflow execution metadata so nodes and runtime integrations can reuse the same context snapshot.",
        content: finalPromptText,
      })
    );
  }

  if (kind === "tool") {
    targets.push(
      Object.freeze({
        channel: "tool-execution",
        label: "Tool Run Metadata",
        summary: "Passed into the workflow-backed tool path without exposing author-only controls in the end-user tool UI.",
        content: finalPromptText,
      })
    );
  }

  if (kind === "agent") {
    targets.push(
      Object.freeze({
        channel: "agent-execution",
        label: "Agent Context Envelope",
        summary: "Forwarded to the agent orchestrator together with inspection details and tool-use policy.",
        content: finalPromptText,
      })
    );
  }

  if (toolUsePolicy) {
    targets.push(
      Object.freeze({
        channel: "tool-policy",
        label: "Tool Use Policy",
        summary: `Provider access resolves to ${describeProviderKinds(toolUsePolicy.allowedProviderKinds)} with policy instructions applied to tools, agents, and MCP calls.`,
        content: toolUsePolicy.instructions,
        metadata: Object.freeze({
          allowedProviderKinds: toolUsePolicy.allowedProviderKinds,
          blockedProviderKinds: toolUsePolicy.blockedProviderKinds,
          mcp: toolUsePolicy.mcp,
        }),
      })
    );
  }

  if (capabilityDecisions) {
    const allowed = capabilityDecisions.filter((decision) => decision.status === "allowed").length;
    const blocked = capabilityDecisions.length - allowed;
    targets.push(
      Object.freeze({
        channel: "mcp-capabilities",
        label: "Capability Reachability",
        summary: `${allowed} capability(s) allowed, ${blocked} blocked by the current context policy.`,
      })
    );
  }

  return Object.freeze(targets);
}

export function createCapabilityDecision(
  capability: ToolCapabilityDescriptor,
  status: "allowed" | "blocked",
  reason: string,
): ContextPreviewCapabilityDecision {
  return Object.freeze({
    capabilityId: capability.id,
    displayName: capability.displayName,
    providerKind: capability.provider.kind,
    providerLabel: capability.provider.label,
    source: Object.freeze({ ...capability.source }),
    status,
    reason,
  });
}
