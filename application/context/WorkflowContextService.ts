import { InspectContextAssemblyUseCase } from "./InspectContextAssemblyUseCase";
import type { ContextInspectionResult } from "./models/ContextInspectionResult";
import type { ContextFragmentKind } from "./models/ContextFragment";
import type { IContextPackageRepository } from "../ports/interfaces/IContextPackageRepository";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import { ExecutionContextEnvelope, type IExecutionContextToolUsePolicy } from "./models/ExecutionContextEnvelope";
import type { DynamicContextSourceInput } from "./models/ContextAssemblyRequest";

export interface IResolveWorkflowContextRequest {
  readonly workflow: IWorkflow;
  readonly selectedPackageIds?: ReadonlyArray<string>;
  readonly dynamicSources?: ReadonlyArray<DynamicContextSourceInput>;
  readonly visibilityMode?: "basic" | "advanced";
  readonly maxCharacters?: number;
  readonly maxTokens?: number;
  readonly trimPartialFragments?: boolean;
}

export interface IResolveWorkflowContextResult {
  readonly inspection: ContextInspectionResult;
  readonly selectedPackageIds: ReadonlyArray<string>;
  readonly packageLabels: Readonly<Record<string, string>>;
  readonly packageReferences: ReadonlyArray<{
    readonly packageId: string;
    readonly alias?: string;
    readonly fragmentIds?: ReadonlyArray<string>;
  }>;
  readonly executionContext: ExecutionContextEnvelope;
}

function normalizeIds(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]);
}

function normalizeKinds(values?: ReadonlyArray<string>): ReadonlyArray<ContextFragmentKind> {
  return Object.freeze(
    [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))] as ContextFragmentKind[]
  );
}


function toStringList(value: unknown): ReadonlyArray<string> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = [...new Set(value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function mergeToolUsePolicy(
  fragments: ReadonlyArray<{ readonly metadata?: Readonly<Record<string, unknown>> }>
): IExecutionContextToolUsePolicy | undefined {
  const instructions: string[] = [];
  const allowedProviderKinds = new Set<"workflow" | "local" | "mcp">();
  const blockedProviderKinds = new Set<"workflow" | "local" | "mcp">();
  const allowedServerIds = new Set<string>();
  const blockedServerIds = new Set<string>();
  const allowedToolNames = new Set<string>();
  const blockedToolNames = new Set<string>();

  for (const fragment of fragments) {
    const metadata = fragment.metadata;
    if (!metadata || typeof metadata !== "object") {
      continue;
    }

    const toolInstructions = typeof metadata.toolInstructions === "string" ? metadata.toolInstructions.trim() : "";
    if (toolInstructions) {
      instructions.push(toolInstructions);
    }

    const toolUsePolicy =
      metadata.toolUsePolicy && typeof metadata.toolUsePolicy === "object"
        ? (metadata.toolUsePolicy as Record<string, unknown>)
        : undefined;
    if (!toolUsePolicy) {
      continue;
    }

    const policyInstructions = typeof toolUsePolicy.instructions === "string" ? toolUsePolicy.instructions.trim() : "";
    if (policyInstructions) {
      instructions.push(policyInstructions);
    }

    for (const value of toStringList(toolUsePolicy.allowedProviderKinds) ?? []) {
      if (value === "workflow" || value === "local" || value === "mcp") {
        allowedProviderKinds.add(value);
      }
    }

    for (const value of toStringList(toolUsePolicy.blockedProviderKinds) ?? []) {
      if (value === "workflow" || value === "local" || value === "mcp") {
        blockedProviderKinds.add(value);
      }
    }

    const mcp = toolUsePolicy.mcp && typeof toolUsePolicy.mcp === "object"
      ? (toolUsePolicy.mcp as Record<string, unknown>)
      : undefined;
    if (!mcp) {
      continue;
    }

    for (const value of toStringList(mcp.allowedServerIds) ?? []) {
      allowedServerIds.add(value);
    }
    for (const value of toStringList(mcp.blockedServerIds) ?? []) {
      blockedServerIds.add(value);
    }
    for (const value of toStringList(mcp.allowedToolNames) ?? []) {
      allowedToolNames.add(value);
    }
    for (const value of toStringList(mcp.blockedToolNames) ?? []) {
      blockedToolNames.add(value);
    }
  }

  if (
    instructions.length === 0 &&
    allowedProviderKinds.size === 0 &&
    blockedProviderKinds.size === 0 &&
    allowedServerIds.size === 0 &&
    blockedServerIds.size === 0 &&
    allowedToolNames.size === 0 &&
    blockedToolNames.size === 0
  ) {
    return undefined;
  }

  return Object.freeze({
    instructions: instructions.length > 0 ? instructions.join("\n\n") : undefined,
    allowedProviderKinds: allowedProviderKinds.size > 0 ? Object.freeze([...allowedProviderKinds]) : undefined,
    blockedProviderKinds: blockedProviderKinds.size > 0 ? Object.freeze([...blockedProviderKinds]) : undefined,
    mcp:
      allowedServerIds.size > 0 ||
      blockedServerIds.size > 0 ||
      allowedToolNames.size > 0 ||
      blockedToolNames.size > 0
        ? Object.freeze({
            allowedServerIds: allowedServerIds.size > 0 ? Object.freeze([...allowedServerIds]) : undefined,
            blockedServerIds: blockedServerIds.size > 0 ? Object.freeze([...blockedServerIds]) : undefined,
            allowedToolNames: allowedToolNames.size > 0 ? Object.freeze([...allowedToolNames]) : undefined,
            blockedToolNames: blockedToolNames.size > 0 ? Object.freeze([...blockedToolNames]) : undefined,
          })
        : undefined,
  });
}

export class WorkflowContextService {
  public constructor(
    private readonly contextPackageRepository: IContextPackageRepository,
    private readonly inspectContextAssemblyUseCase: InspectContextAssemblyUseCase = new InspectContextAssemblyUseCase()
  ) {}

  public async inspectWorkflowContext(
    request: IResolveWorkflowContextRequest
  ): Promise<IResolveWorkflowContextResult> {
    const contextConfiguration = request.workflow.metadata.contextConfiguration;
    const configuredReferences = (contextConfiguration?.packageReferences ?? []).filter(
      (reference) => reference.isEnabled !== false
    );
    const selectedPackageIds = normalizeIds(
      request.selectedPackageIds ?? contextConfiguration?.selectedPackageIds ?? configuredReferences.map((reference) => reference.packageId)
    );

    const selectedReferences = configuredReferences.filter(
      (reference) => selectedPackageIds.length === 0 || selectedPackageIds.includes(reference.packageId)
    );
    const packages = await Promise.all(
      selectedReferences.map(async (reference, index) => {
        const contextPackage = await this.contextPackageRepository.load(reference.packageId);
        if (!contextPackage) {
          throw new Error(`Workflow context package '${reference.packageId}' was not found.`);
        }

        return {
          contextPackage,
          alias: reference.alias,
          includeFragmentIds: reference.includeFragmentIds,
          excludeFragmentIds: reference.excludeFragmentIds,
          order: index,
        };
      })
    );

    const inspection = this.inspectContextAssemblyUseCase.execute({
      assembly: {
        packages,
        dynamicSources: request.dynamicSources,
      },
      trimmingPolicy: {
        visibilityMode: request.visibilityMode ?? contextConfiguration?.visibilityMode,
        includeKinds: normalizeKinds(contextConfiguration?.includeKinds),
        excludeKinds: normalizeKinds(contextConfiguration?.excludeKinds),
      },
      budget: {
        maxCharacters: request.maxCharacters ?? contextConfiguration?.maxCharacters,
        maxTokens: request.maxTokens ?? contextConfiguration?.maxTokens,
        trimPartialFragments: request.trimPartialFragments ?? contextConfiguration?.trimPartialFragments,
      },
    });

    const packageReferences = Object.freeze(
      selectedReferences.map((reference) =>
        Object.freeze({
          packageId: reference.packageId,
          alias: reference.alias?.trim() || undefined,
          fragmentIds: (() => {
            const fragmentIds = [
              ...new Set(
                [
                  ...(reference.includeFragmentIds ?? []),
                  ...(reference.excludeFragmentIds ?? []),
                ]
                  .map((value) => value.trim())
                  .filter(Boolean)
              ),
            ];
            return fragmentIds.length > 0 ? Object.freeze(fragmentIds) : undefined;
          })(),
        })
      )
    );
    const executionContext = new ExecutionContextEnvelope({
      packageReferences,
      assembledContext: inspection.assembly.assembledContext,
      trimmingPolicy: {
        visibilityMode: request.visibilityMode ?? contextConfiguration?.visibilityMode,
        includeKinds: normalizeKinds(contextConfiguration?.includeKinds),
        excludeKinds: normalizeKinds(contextConfiguration?.excludeKinds),
      },
      budget: {
        maxCharacters: request.maxCharacters ?? contextConfiguration?.maxCharacters,
        maxTokens: request.maxTokens ?? contextConfiguration?.maxTokens,
        trimPartialFragments: request.trimPartialFragments ?? contextConfiguration?.trimPartialFragments,
      },
      inspection: {
        assembledPromptText: inspection.assembledPromptText,
        finalPromptText: inspection.finalPromptText,
        finalFragmentIds: inspection.finalFragments.map((fragment) => fragment.id),
        entries: inspection.entries,
      },
      toolUsePolicy: mergeToolUsePolicy(inspection.finalFragments),
    });

    return Object.freeze({
      inspection,
      selectedPackageIds,
      packageLabels: Object.freeze(
        Object.fromEntries(
          configuredReferences.map((reference) => [reference.packageId, reference.alias ?? reference.packageId])
        )
      ),
      packageReferences,
      executionContext,
    });
  }
}
