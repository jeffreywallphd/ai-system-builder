import type { ExecutionContextEnvelope } from "./ExecutionContextEnvelope";
import type { ContextInspectionResult } from "./ContextInspectionResult";
import type {
  ToolCapabilityDescriptor,
  ToolCapabilityProviderKind,
  ToolCapabilitySourceDescriptor,
} from "../../tools/models/ToolCapabilityDescriptor";

export type ContextPreviewTargetKind = "workflow" | "tool" | "agent";

export interface ContextPreviewDeliveryTarget {
  readonly channel:
    | "prompt"
    | "workflow-execution"
    | "tool-execution"
    | "agent-execution"
    | "tool-policy"
    | "mcp-capabilities";
  readonly label: string;
  readonly summary: string;
  readonly content?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ContextPreviewCapabilityDecision {
  readonly capabilityId: string;
  readonly displayName: string;
  readonly providerKind: ToolCapabilityProviderKind;
  readonly providerLabel: string;
  readonly source: ToolCapabilitySourceDescriptor;
  readonly status: "allowed" | "blocked";
  readonly reason: string;
}

export interface ContextPreviewResult {
  readonly target: Readonly<{
    kind: ContextPreviewTargetKind;
    id: string;
    label: string;
    workflowId?: string;
    workflowLabel?: string;
  }>;
  readonly inspection: ContextInspectionResult;
  readonly executionContext: ExecutionContextEnvelope;
  readonly selectedRecipeIds: ReadonlyArray<string>;
  readonly selectedPackageIds: ReadonlyArray<string>;
  readonly recipeLabels: Readonly<Record<string, string>>;
  readonly packageLabels: Readonly<Record<string, string>>;
  readonly deliveryTargets: ReadonlyArray<ContextPreviewDeliveryTarget>;
  readonly capabilityDecisions?: ReadonlyArray<ContextPreviewCapabilityDecision>;
}
