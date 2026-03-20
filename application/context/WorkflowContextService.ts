import { InspectContextAssemblyUseCase } from "./InspectContextAssemblyUseCase";
import type { ContextInspectionResult } from "./models/ContextInspectionResult";
import type { ContextFragmentKind } from "./models/ContextFragment";
import type { IContextPackageRepository } from "../ports/interfaces/IContextPackageRepository";
import type { IContextRecipeRepository } from "../ports/interfaces/IContextRecipeRepository";
import type { IWorkflow, IWorkflowContextPackageReference } from "../../domain/workflows/interfaces/IWorkflow";
import { ExecutionContextEnvelope, type IExecutionContextToolUsePolicy } from "./models/ExecutionContextEnvelope";
import type { DynamicContextSourceInput } from "./models/ContextAssemblyRequest";
import { DynamicContextSource } from "./models/DynamicContextSource";
import type { ContextRecipe } from "./models/ContextRecipe";

export interface IResolveWorkflowContextRequest {
  readonly workflow: IWorkflow;
  readonly selectedRecipeIds?: ReadonlyArray<string>;
  readonly selectedPackageIds?: ReadonlyArray<string>;
  readonly dynamicSources?: ReadonlyArray<DynamicContextSourceInput>;
  readonly visibilityMode?: "basic" | "advanced";
  readonly maxCharacters?: number;
  readonly maxTokens?: number;
  readonly trimPartialFragments?: boolean;
}

export interface IResolveWorkflowContextResult {
  readonly inspection: ContextInspectionResult;
  readonly selectedRecipeIds: ReadonlyArray<string>;
  readonly selectedPackageIds: ReadonlyArray<string>;
  readonly recipeLabels: Readonly<Record<string, string>>;
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

function mergePackageReferences(
  workflowReferences: ReadonlyArray<IWorkflowContextPackageReference>,
  recipeReferences: ReadonlyArray<IWorkflowContextPackageReference>
): ReadonlyArray<IWorkflowContextPackageReference> {
  const merged = new Map<string, IWorkflowContextPackageReference>();

  for (const reference of workflowReferences) {
    merged.set(reference.packageId, reference);
  }

  for (const reference of recipeReferences) {
    if (!merged.has(reference.packageId)) {
      merged.set(reference.packageId, reference);
    }
  }

  return Object.freeze([...merged.values()]);
}

function buildRecipeDynamicSource(recipe: ContextRecipe, selectionAlias?: string): DynamicContextSourceInput | undefined {
  const fragments: Array<{
    id: string;
    kind: ContextFragmentKind;
    title: string;
    content: string;
    order: number;
    metadata?: Readonly<Record<string, unknown>>;
  }> = [];
  const sourceLabel = selectionAlias?.trim() || recipe.name;
  const guidanceLines: string[] = [];
  const sourcePreferenceLines: string[] = [];

  if (recipe.guidance?.responseStyle) {
    guidanceLines.push(`Response style: ${recipe.guidance.responseStyle}.`);
  }
  if (recipe.guidance?.detailLevel) {
    guidanceLines.push(`Detail level: ${recipe.guidance.detailLevel}.`);
  }
  if (recipe.dynamicSourcePreferences?.knowledgePreference && recipe.dynamicSourcePreferences.knowledgePreference !== "none") {
    sourcePreferenceLines.push(
      recipe.dynamicSourcePreferences.knowledgePreference === "require"
        ? "Use company knowledge as a required grounding source when available."
        : "Prefer company knowledge when available."
    );
  }
  if (recipe.dynamicSourcePreferences?.includeConversationMemory) {
    sourcePreferenceLines.push("Incorporate relevant conversation memory when it helps answer accurately.");
  }
  if (recipe.dynamicSourcePreferences?.includeCapabilityGuidance) {
    sourcePreferenceLines.push("Use capability guidance to stay aligned with the workflow's supported behaviors.");
  }
  if (recipe.dynamicSourcePreferences?.preferredSourceKinds && recipe.dynamicSourcePreferences.preferredSourceKinds.length > 0) {
    sourcePreferenceLines.push(
      `Prefer these source types when choosing context: ${recipe.dynamicSourcePreferences.preferredSourceKinds.join(", ")}.`
    );
  }

  if (guidanceLines.length > 0 || sourcePreferenceLines.length > 0) {
    fragments.push({
      id: `${recipe.id}__instructions`,
      kind: "instructions",
      title: `${sourceLabel} instructions`,
      content: [...guidanceLines, ...sourcePreferenceLines].join("\n"),
      order: 0,
    });
  }

  const formattingLines: string[] = [];
  if (recipe.guidance?.formattingInstructions) {
    formattingLines.push(recipe.guidance.formattingInstructions);
  }
  if (recipe.guidance?.strictStructuredOutput) {
    formattingLines.push("Use strict structured output and do not add extra commentary outside the requested structure.");
  }
  if (formattingLines.length > 0) {
    fragments.push({
      id: `${recipe.id}__formatting`,
      kind: "formatting-constraints",
      title: `${sourceLabel} formatting`,
      content: formattingLines.join("\n"),
      order: 1,
    });
  }

  const toolMetadata: Record<string, unknown> = {};
  if (recipe.toolUseGuidance?.instructions) {
    toolMetadata.toolInstructions = recipe.toolUseGuidance.instructions;
  }

  if (
    recipe.toolUseGuidance?.mode === "strict" ||
    recipe.toolUseGuidance?.allowedProviderKinds ||
    recipe.toolUseGuidance?.blockedProviderKinds ||
    recipe.toolUseGuidance?.allowedServerIds ||
    recipe.toolUseGuidance?.blockedServerIds ||
    recipe.toolUseGuidance?.allowedToolNames ||
    recipe.toolUseGuidance?.blockedToolNames
  ) {
    toolMetadata.toolUsePolicy = {
      instructions: recipe.toolUseGuidance?.mode ? `Tool use mode: ${recipe.toolUseGuidance.mode}.` : undefined,
      allowedProviderKinds: recipe.toolUseGuidance?.allowedProviderKinds,
      blockedProviderKinds: recipe.toolUseGuidance?.blockedProviderKinds,
      mcp:
        recipe.toolUseGuidance?.allowedServerIds ||
        recipe.toolUseGuidance?.blockedServerIds ||
        recipe.toolUseGuidance?.allowedToolNames ||
        recipe.toolUseGuidance?.blockedToolNames
          ? {
              allowedServerIds: recipe.toolUseGuidance?.allowedServerIds,
              blockedServerIds: recipe.toolUseGuidance?.blockedServerIds,
              allowedToolNames: recipe.toolUseGuidance?.allowedToolNames,
              blockedToolNames: recipe.toolUseGuidance?.blockedToolNames,
            }
          : undefined,
    };
  }

  if (Object.keys(toolMetadata).length > 0) {
    fragments.push({
      id: `${recipe.id}__tools`,
      kind: "instructions",
      title: `${sourceLabel} tool guidance`,
      content: recipe.toolUseGuidance?.instructions ?? `Tool use mode: ${recipe.toolUseGuidance?.mode ?? "guided"}.`,
      order: 2,
      metadata: toolMetadata,
    });
  }

  if (fragments.length === 0) {
    return undefined;
  }

  return new DynamicContextSource({
    id: `recipe:${recipe.id}`,
    sourceType: "runtime",
    label: sourceLabel,
    precedence: 20,
    fragments,
  });
}

export class WorkflowContextService {
  public constructor(
    private readonly contextPackageRepository: IContextPackageRepository,
    private readonly contextRecipeRepository?: IContextRecipeRepository,
    private readonly inspectContextAssemblyUseCase: InspectContextAssemblyUseCase = new InspectContextAssemblyUseCase()
  ) {}

  public async inspectWorkflowContext(
    request: IResolveWorkflowContextRequest
  ): Promise<IResolveWorkflowContextResult> {
    const contextConfiguration = request.workflow.metadata.contextConfiguration;
    const configuredRecipeSelections = (contextConfiguration?.recipeSelections ?? []).filter(
      (selection) => selection.isEnabled !== false
    );
    const selectedRecipeIds = normalizeIds(
      request.selectedRecipeIds ?? contextConfiguration?.selectedRecipeIds ?? configuredRecipeSelections.map((selection) => selection.recipeId)
    );
    const activeRecipeSelections = configuredRecipeSelections.filter(
      (selection) => selectedRecipeIds.length === 0 || selectedRecipeIds.includes(selection.recipeId)
    );

    const selectedRecipes = this.contextRecipeRepository
      ? await Promise.all(
          activeRecipeSelections.map(async (selection) => {
            const contextRecipe = await this.contextRecipeRepository?.load(selection.recipeId);
            if (!contextRecipe) {
              throw new Error(`Workflow context recipe '${selection.recipeId}' was not found.`);
            }
            return {
              contextRecipe,
              alias: selection.alias,
            };
          })
        )
      : [];

    const recipeDerivedPackageReferences = selectedRecipes.flatMap(({ contextRecipe }) =>
      contextRecipe.packageReferences.map((reference) => ({
        packageId: reference.packageId,
        alias: reference.alias,
        version: reference.version,
        includeFragmentIds: reference.fragmentIds,
        excludeFragmentIds: undefined,
        isEnabled: true,
      }))
    );
    const configuredReferences = mergePackageReferences(
      (contextConfiguration?.packageReferences ?? []).filter((reference) => reference.isEnabled !== false),
      recipeDerivedPackageReferences
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

    const recipeDynamicSources = selectedRecipes
      .map(({ contextRecipe, alias }) => buildRecipeDynamicSource(contextRecipe, alias))
      .filter(Boolean) as ReadonlyArray<DynamicContextSourceInput>;
    const selectedRecipeDefinitions = selectedRecipes.map(({ contextRecipe }) => contextRecipe);
    const recipeBudgetDefaults = selectedRecipeDefinitions.reduce(
      (accumulator, recipe) => ({
        maxCharacters: accumulator.maxCharacters ?? recipe.budgetingDefaults?.maxCharacters,
        maxTokens: accumulator.maxTokens ?? recipe.budgetingDefaults?.maxTokens,
        trimPartialFragments: accumulator.trimPartialFragments ?? recipe.budgetingDefaults?.trimPartialFragments,
      }),
      {} as { maxCharacters?: number; maxTokens?: number; trimPartialFragments?: boolean }
    );

    const inspection = this.inspectContextAssemblyUseCase.execute({
      assembly: {
        packages,
        dynamicSources: [...recipeDynamicSources, ...(request.dynamicSources ?? [])],
      },
      trimmingPolicy: {
        visibilityMode: request.visibilityMode ?? contextConfiguration?.visibilityMode,
        includeKinds: normalizeKinds(contextConfiguration?.includeKinds),
        excludeKinds: normalizeKinds(contextConfiguration?.excludeKinds),
      },
      budget: {
        maxCharacters: request.maxCharacters ?? contextConfiguration?.maxCharacters ?? recipeBudgetDefaults.maxCharacters,
        maxTokens: request.maxTokens ?? contextConfiguration?.maxTokens ?? recipeBudgetDefaults.maxTokens,
        trimPartialFragments:
          request.trimPartialFragments ??
          contextConfiguration?.trimPartialFragments ??
          recipeBudgetDefaults.trimPartialFragments,
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
        maxCharacters: request.maxCharacters ?? contextConfiguration?.maxCharacters ?? recipeBudgetDefaults.maxCharacters,
        maxTokens: request.maxTokens ?? contextConfiguration?.maxTokens ?? recipeBudgetDefaults.maxTokens,
        trimPartialFragments:
          request.trimPartialFragments ??
          contextConfiguration?.trimPartialFragments ??
          recipeBudgetDefaults.trimPartialFragments,
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
      selectedRecipeIds,
      selectedPackageIds,
      recipeLabels: Object.freeze(
        Object.fromEntries(
          configuredRecipeSelections.map((selection) => [selection.recipeId, selection.alias ?? selection.recipeId])
        )
      ),
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
