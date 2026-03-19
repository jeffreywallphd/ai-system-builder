import { AssembledContext, type IAssembledContext } from "./AssembledContext";
import { ContextBudget, type IContextBudget } from "./ContextBudget";
import { ContextPackageReference, type IContextPackageReference } from "./ContextPackageReference";
import {
  ContextProvenanceEntry,
  type IContextProvenanceEntry,
} from "./ContextProvenanceEntry";
import { ContextTrimmingPolicy, type IContextTrimmingPolicy } from "./ContextTrimmingPolicy";
import type { ToolCapabilityProviderKind } from "../../tools/models/ToolCapabilityDescriptor";

export interface IExecutionContextMcpToolPolicy {
  readonly allowedServerIds?: ReadonlyArray<string>;
  readonly blockedServerIds?: ReadonlyArray<string>;
  readonly allowedToolNames?: ReadonlyArray<string>;
  readonly blockedToolNames?: ReadonlyArray<string>;
}

export interface IExecutionContextToolUsePolicy {
  readonly instructions?: string;
  readonly allowedProviderKinds?: ReadonlyArray<ToolCapabilityProviderKind>;
  readonly blockedProviderKinds?: ReadonlyArray<ToolCapabilityProviderKind>;
  readonly mcp?: IExecutionContextMcpToolPolicy;
}

export interface IExecutionContextInspectionSnapshot {
  readonly assembledPromptText: string;
  readonly finalPromptText: string;
  readonly finalFragmentIds: ReadonlyArray<string>;
  readonly entries: ReadonlyArray<IContextProvenanceEntry>;
}

export interface IExecutionContextEnvelope {
  readonly packageReferences: ReadonlyArray<ContextPackageReference>;
  readonly assembledContext: AssembledContext;
  readonly trimmingPolicy?: Readonly<ContextTrimmingPolicy>;
  readonly budget?: Readonly<ContextBudget>;
  readonly inspection?: Readonly<IExecutionContextInspectionSnapshot>;
  readonly toolUsePolicy?: Readonly<IExecutionContextToolUsePolicy>;
}

function normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function normalizeProviderKinds(
  values?: ReadonlyArray<ToolCapabilityProviderKind>
): ReadonlyArray<ToolCapabilityProviderKind> | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = [...new Set(values.map((value) => value.trim()))].filter(
    (value): value is ToolCapabilityProviderKind => value === "workflow" || value === "local" || value === "mcp"
  );

  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function normalizeToolUsePolicy(
  policy?: IExecutionContextToolUsePolicy
): Readonly<IExecutionContextToolUsePolicy> | undefined {
  if (!policy) {
    return undefined;
  }

  const instructions = policy.instructions?.trim() || undefined;
  const allowedProviderKinds = normalizeProviderKinds(policy.allowedProviderKinds);
  const blockedProviderKinds = normalizeProviderKinds(policy.blockedProviderKinds);
  const mcp = policy.mcp
    ? Object.freeze({
        allowedServerIds: normalizeStringList(policy.mcp.allowedServerIds),
        blockedServerIds: normalizeStringList(policy.mcp.blockedServerIds),
        allowedToolNames: normalizeStringList(policy.mcp.allowedToolNames),
        blockedToolNames: normalizeStringList(policy.mcp.blockedToolNames),
      })
    : undefined;

  if (!instructions && !allowedProviderKinds && !blockedProviderKinds && !mcp) {
    return undefined;
  }

  return Object.freeze({
    instructions,
    allowedProviderKinds,
    blockedProviderKinds,
    mcp,
  });
}

function normalizeInspection(
  inspection?: IExecutionContextInspectionSnapshot
): Readonly<IExecutionContextInspectionSnapshot> | undefined {
  if (!inspection) {
    return undefined;
  }

  const assembledPromptText = inspection.assembledPromptText.trim();
  const finalPromptText = inspection.finalPromptText.trim();
  return Object.freeze({
    assembledPromptText,
    finalPromptText,
    finalFragmentIds: Object.freeze(
      [...new Set((inspection.finalFragmentIds ?? []).map((value) => value.trim()).filter(Boolean))]
    ),
    entries: Object.freeze((inspection.entries ?? []).map((entry) => new ContextProvenanceEntry(entry))),
  });
}

export class ExecutionContextEnvelope implements IExecutionContextEnvelope {
  public readonly packageReferences: ReadonlyArray<ContextPackageReference>;
  public readonly assembledContext: AssembledContext;
  public readonly trimmingPolicy?: Readonly<ContextTrimmingPolicy>;
  public readonly budget?: Readonly<ContextBudget>;
  public readonly inspection?: Readonly<IExecutionContextInspectionSnapshot>;
  public readonly toolUsePolicy?: Readonly<IExecutionContextToolUsePolicy>;

  constructor(params: {
    packageReferences?: ReadonlyArray<IContextPackageReference>;
    assembledContext: IAssembledContext;
    trimmingPolicy?: IContextTrimmingPolicy;
    budget?: IContextBudget;
    inspection?: IExecutionContextInspectionSnapshot;
    toolUsePolicy?: IExecutionContextToolUsePolicy;
  }) {
    this.packageReferences = Object.freeze(
      (params.packageReferences ?? []).map((reference) => new ContextPackageReference(reference))
    );
    this.assembledContext = new AssembledContext(params.assembledContext);
    this.trimmingPolicy = params.trimmingPolicy
      ? Object.freeze(new ContextTrimmingPolicy(params.trimmingPolicy))
      : undefined;
    this.budget = params.budget ? Object.freeze(new ContextBudget(params.budget)) : undefined;
    this.inspection = normalizeInspection(params.inspection);
    this.toolUsePolicy = normalizeToolUsePolicy(params.toolUsePolicy);
  }
}
