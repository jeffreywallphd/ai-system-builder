import {
  ContextPackageReference,
  type IContextPackageReference,
} from "./ContextPackageReference";

export type ContextRecipeKnowledgePreference = "none" | "prefer" | "require";
export type ContextRecipeDetailLevel = "concise" | "balanced" | "detailed";
export type ContextRecipeResponseStyle = "conversational" | "structured" | "strict-structured";
export type ContextRecipeToolUseMode = "manual" | "guided" | "strict";

export interface IContextRecipeAuditInfo {
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface IContextRecipeDynamicSourcePreferences {
  readonly knowledgePreference?: ContextRecipeKnowledgePreference;
  readonly includeConversationMemory?: boolean;
  readonly includeCapabilityGuidance?: boolean;
  readonly preferredSourceKinds?: ReadonlyArray<string>;
}

export interface IContextRecipeBudgetingDefaults {
  readonly maxCharacters?: number;
  readonly maxTokens?: number;
  readonly trimPartialFragments?: boolean;
}

export interface IContextRecipeGuidance {
  readonly responseStyle?: ContextRecipeResponseStyle;
  readonly detailLevel?: ContextRecipeDetailLevel;
  readonly formattingInstructions?: string;
  readonly strictStructuredOutput?: boolean;
}

export interface IContextRecipeToolUseGuidance {
  readonly mode?: ContextRecipeToolUseMode;
  readonly instructions?: string;
  readonly allowedProviderKinds?: ReadonlyArray<"workflow" | "local" | "mcp">;
  readonly blockedProviderKinds?: ReadonlyArray<"workflow" | "local" | "mcp">;
  readonly allowedServerIds?: ReadonlyArray<string>;
  readonly blockedServerIds?: ReadonlyArray<string>;
  readonly allowedToolNames?: ReadonlyArray<string>;
  readonly blockedToolNames?: ReadonlyArray<string>;
}

export interface IContextRecipe {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly tags: ReadonlyArray<string>;
  readonly packageReferences: ReadonlyArray<IContextPackageReference>;
  readonly dynamicSourcePreferences?: IContextRecipeDynamicSourcePreferences;
  readonly budgetingDefaults?: IContextRecipeBudgetingDefaults;
  readonly guidance?: IContextRecipeGuidance;
  readonly toolUseGuidance?: IContextRecipeToolUseGuidance;
  readonly audit?: IContextRecipeAuditInfo;
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`ContextRecipe.${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalInteger(value?: number, fieldName?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`ContextRecipe.${fieldName ?? "numeric value"} must be a finite positive number or zero.`);
  }

  return Math.floor(value);
}

function freezeStrings(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function freezeTags(tags?: ReadonlyArray<string>): ReadonlyArray<string> {
  return freezeStrings(tags) ?? Object.freeze([]);
}

function cloneDate(value?: Date): Date | undefined {
  return value ? new Date(value.getTime()) : undefined;
}

function freezeAudit(audit?: IContextRecipeAuditInfo): IContextRecipeAuditInfo | undefined {
  if (!audit) {
    return undefined;
  }

  return Object.freeze({
    createdAt: cloneDate(audit.createdAt),
    updatedAt: cloneDate(audit.updatedAt),
  });
}

function freezePackageReferences(
  references?: ReadonlyArray<IContextPackageReference>
): ReadonlyArray<ContextPackageReference> {
  const deduped = new Map<string, ContextPackageReference>();

  for (const reference of references ?? []) {
    const normalized = ContextPackageReference.from(reference);
    if (!deduped.has(normalized.packageId)) {
      deduped.set(normalized.packageId, normalized);
    }
  }

  return Object.freeze([...deduped.values()]);
}

function freezeDynamicSourcePreferences(
  preferences?: IContextRecipeDynamicSourcePreferences
): IContextRecipeDynamicSourcePreferences | undefined {
  if (!preferences) {
    return undefined;
  }

  const knowledgePreference = preferences.knowledgePreference;
  if (
    knowledgePreference !== undefined &&
    knowledgePreference !== "none" &&
    knowledgePreference !== "prefer" &&
    knowledgePreference !== "require"
  ) {
    throw new Error("ContextRecipe.dynamicSourcePreferences.knowledgePreference must be 'none', 'prefer', or 'require'.");
  }

  const normalized = Object.freeze({
    knowledgePreference,
    includeConversationMemory: preferences.includeConversationMemory ?? false,
    includeCapabilityGuidance: preferences.includeCapabilityGuidance ?? false,
    preferredSourceKinds: freezeStrings(preferences.preferredSourceKinds),
  });

  return (
    normalized.knowledgePreference !== undefined ||
    normalized.includeConversationMemory ||
    normalized.includeCapabilityGuidance ||
    normalized.preferredSourceKinds
  )
    ? normalized
    : undefined;
}

function freezeBudgetingDefaults(
  defaults?: IContextRecipeBudgetingDefaults
): IContextRecipeBudgetingDefaults | undefined {
  if (!defaults) {
    return undefined;
  }

  const normalized = Object.freeze({
    maxCharacters: normalizeOptionalInteger(defaults.maxCharacters, "budgetingDefaults.maxCharacters"),
    maxTokens: normalizeOptionalInteger(defaults.maxTokens, "budgetingDefaults.maxTokens"),
    trimPartialFragments: defaults.trimPartialFragments ?? true,
  });

  return (
    normalized.maxCharacters !== undefined ||
    normalized.maxTokens !== undefined ||
    normalized.trimPartialFragments !== true
  )
    ? normalized
    : undefined;
}

function freezeGuidance(guidance?: IContextRecipeGuidance): IContextRecipeGuidance | undefined {
  if (!guidance) {
    return undefined;
  }

  const responseStyle = guidance.responseStyle;
  if (
    responseStyle !== undefined &&
    responseStyle !== "conversational" &&
    responseStyle !== "structured" &&
    responseStyle !== "strict-structured"
  ) {
    throw new Error("ContextRecipe.guidance.responseStyle must be 'conversational', 'structured', or 'strict-structured'.");
  }

  const detailLevel = guidance.detailLevel;
  if (detailLevel !== undefined && detailLevel !== "concise" && detailLevel !== "balanced" && detailLevel !== "detailed") {
    throw new Error("ContextRecipe.guidance.detailLevel must be 'concise', 'balanced', or 'detailed'.");
  }

  const normalized = Object.freeze({
    responseStyle,
    detailLevel,
    formattingInstructions: normalizeOptional(guidance.formattingInstructions),
    strictStructuredOutput: guidance.strictStructuredOutput ?? false,
  });

  return (
    normalized.responseStyle !== undefined ||
    normalized.detailLevel !== undefined ||
    normalized.formattingInstructions !== undefined ||
    normalized.strictStructuredOutput
  )
    ? normalized
    : undefined;
}

function freezeProviderKinds(
  values?: ReadonlyArray<"workflow" | "local" | "mcp">
): ReadonlyArray<"workflow" | "local" | "mcp"> | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = [...new Set(values.filter((value) => value === "workflow" || value === "local" || value === "mcp"))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function freezeToolUseGuidance(
  guidance?: IContextRecipeToolUseGuidance
): IContextRecipeToolUseGuidance | undefined {
  if (!guidance) {
    return undefined;
  }

  const mode = guidance.mode;
  if (mode !== undefined && mode !== "manual" && mode !== "guided" && mode !== "strict") {
    throw new Error("ContextRecipe.toolUseGuidance.mode must be 'manual', 'guided', or 'strict'.");
  }

  const normalized = Object.freeze({
    mode,
    instructions: normalizeOptional(guidance.instructions),
    allowedProviderKinds: freezeProviderKinds(guidance.allowedProviderKinds),
    blockedProviderKinds: freezeProviderKinds(guidance.blockedProviderKinds),
    allowedServerIds: freezeStrings(guidance.allowedServerIds),
    blockedServerIds: freezeStrings(guidance.blockedServerIds),
    allowedToolNames: freezeStrings(guidance.allowedToolNames),
    blockedToolNames: freezeStrings(guidance.blockedToolNames),
  });

  return (
    normalized.mode !== undefined ||
    normalized.instructions !== undefined ||
    normalized.allowedProviderKinds ||
    normalized.blockedProviderKinds ||
    normalized.allowedServerIds ||
    normalized.blockedServerIds ||
    normalized.allowedToolNames ||
    normalized.blockedToolNames
  )
    ? normalized
    : undefined;
}

export class ContextRecipe implements IContextRecipe {
  public readonly id: string;
  public readonly name: string;
  public readonly description?: string;
  public readonly version?: string;
  public readonly tags: ReadonlyArray<string>;
  public readonly packageReferences: ReadonlyArray<ContextPackageReference>;
  public readonly dynamicSourcePreferences?: IContextRecipeDynamicSourcePreferences;
  public readonly budgetingDefaults?: IContextRecipeBudgetingDefaults;
  public readonly guidance?: IContextRecipeGuidance;
  public readonly toolUseGuidance?: IContextRecipeToolUseGuidance;
  public readonly audit?: IContextRecipeAuditInfo;

  constructor(params: {
    id: string;
    name: string;
    description?: string;
    version?: string;
    tags?: ReadonlyArray<string>;
    packageReferences?: ReadonlyArray<IContextPackageReference>;
    dynamicSourcePreferences?: IContextRecipeDynamicSourcePreferences;
    budgetingDefaults?: IContextRecipeBudgetingDefaults;
    guidance?: IContextRecipeGuidance;
    toolUseGuidance?: IContextRecipeToolUseGuidance;
    audit?: IContextRecipeAuditInfo;
  }) {
    this.id = normalizeRequired(params.id, "id");
    this.name = normalizeRequired(params.name, "name");
    this.description = normalizeOptional(params.description);
    this.version = normalizeOptional(params.version);
    this.tags = freezeTags(params.tags);
    this.packageReferences = freezePackageReferences(params.packageReferences);
    this.dynamicSourcePreferences = freezeDynamicSourcePreferences(params.dynamicSourcePreferences);
    this.budgetingDefaults = freezeBudgetingDefaults(params.budgetingDefaults);
    this.guidance = freezeGuidance(params.guidance);
    this.toolUseGuidance = freezeToolUseGuidance(params.toolUseGuidance);
    this.audit = freezeAudit(params.audit);
  }

  public static from(recipe: IContextRecipe): ContextRecipe {
    return new ContextRecipe({
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      version: recipe.version,
      tags: recipe.tags,
      packageReferences: recipe.packageReferences,
      dynamicSourcePreferences: recipe.dynamicSourcePreferences,
      budgetingDefaults: recipe.budgetingDefaults,
      guidance: recipe.guidance,
      toolUseGuidance: recipe.toolUseGuidance,
      audit: recipe.audit,
    });
  }
}
