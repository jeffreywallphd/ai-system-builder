import type { TaxonomySemanticRole } from "../../domain/taxonomy/CompositionTaxonomy";
import { TaxonomySemanticRoles } from "../../domain/taxonomy/CompositionTaxonomy";
import {
  AssetSelectorValidationIssueCodes,
  createAssetSelectorRequest,
  type AssetSelectorRequest,
  type AssetSelectorResult,
  type AssetSelectorValidationIssue,
  validateAssetSelectorResult,
} from "../../domain/studio-shell/AssetSelectorContract";

export const AssetSelectorUsageContexts = Object.freeze({
  workflowInput: "workflow-input",
  workflowStep: "workflow-step",
  workflowModel: "workflow-model",
  workflowTool: "workflow-tool",
  workflowSystem: "workflow-system",
});

export type AssetSelectorUsageContext = typeof AssetSelectorUsageContexts[keyof typeof AssetSelectorUsageContexts];

export interface AssetSelectorCapabilityDescriptor {
  readonly usageContext: string;
  readonly allowedAssetTypes: ReadonlyArray<TaxonomySemanticRole>;
  readonly metadata?: Readonly<Record<string, string>>;
}

const defaultCapabilityDescriptors: ReadonlyArray<AssetSelectorCapabilityDescriptor> = Object.freeze([
  Object.freeze({
    usageContext: AssetSelectorUsageContexts.workflowInput,
    allowedAssetTypes: Object.freeze([TaxonomySemanticRoles.dataset]),
  }),
  Object.freeze({
    usageContext: AssetSelectorUsageContexts.workflowStep,
    allowedAssetTypes: Object.freeze([TaxonomySemanticRoles.agent]),
  }),
  Object.freeze({
    usageContext: AssetSelectorUsageContexts.workflowModel,
    allowedAssetTypes: Object.freeze([TaxonomySemanticRoles.model]),
  }),
  Object.freeze({
    usageContext: AssetSelectorUsageContexts.workflowTool,
    allowedAssetTypes: Object.freeze([TaxonomySemanticRoles.tool]),
  }),
  Object.freeze({
    usageContext: AssetSelectorUsageContexts.workflowSystem,
    allowedAssetTypes: Object.freeze([TaxonomySemanticRoles.system]),
  }),
]);

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeMetadata(metadata?: Readonly<Record<string, string>>): Readonly<Record<string, string>> | undefined {
  if (!metadata) {
    return undefined;
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(metadata)
      .map(([key, value]) => [key.trim(), value.trim()])
      .filter(([key, value]) => key.length > 0 && value.length > 0),
  ));
}

function normalizeAllowedAssetTypes(types: ReadonlyArray<TaxonomySemanticRole>): ReadonlyArray<TaxonomySemanticRole> {
  const supported = Object.values(TaxonomySemanticRoles);
  const deduped = new Set<TaxonomySemanticRole>();
  for (const type of types) {
    const normalized = normalizeRequired(type, "Asset selector capability asset type");
    if (!supported.includes(normalized as TaxonomySemanticRole)) {
      throw new Error(`Asset selector capability asset type '${normalized}' is not supported.`);
    }
    deduped.add(normalized as TaxonomySemanticRole);
  }
  if (deduped.size === 0) {
    throw new Error("Asset selector capability descriptor must include at least one allowed asset type.");
  }
  return Object.freeze([...deduped.values()]);
}

function normalizeCapabilityDescriptor(descriptor: AssetSelectorCapabilityDescriptor): AssetSelectorCapabilityDescriptor {
  return Object.freeze({
    usageContext: normalizeRequired(descriptor.usageContext, "Asset selector usage context"),
    allowedAssetTypes: normalizeAllowedAssetTypes(descriptor.allowedAssetTypes),
    metadata: normalizeMetadata(descriptor.metadata),
  });
}

export class AssetSelectorCapabilityRegistry {
  private readonly byUsageContext = new Map<string, AssetSelectorCapabilityDescriptor>();

  public constructor(
    descriptors: ReadonlyArray<AssetSelectorCapabilityDescriptor> = defaultCapabilityDescriptors,
  ) {
    this.replaceAll(descriptors);
  }

  public register(descriptor: AssetSelectorCapabilityDescriptor): void {
    const normalized = normalizeCapabilityDescriptor(descriptor);
    if (this.byUsageContext.has(normalized.usageContext)) {
      throw new Error(`Asset selector usage context '${normalized.usageContext}' is already registered.`);
    }
    this.byUsageContext.set(normalized.usageContext, normalized);
  }

  public replaceAll(descriptors: ReadonlyArray<AssetSelectorCapabilityDescriptor>): void {
    this.byUsageContext.clear();
    for (const descriptor of descriptors) {
      this.register(descriptor);
    }
  }

  public get(usageContext: string): AssetSelectorCapabilityDescriptor | undefined {
    return this.byUsageContext.get(usageContext.trim());
  }

  public list(): ReadonlyArray<AssetSelectorCapabilityDescriptor> {
    return Object.freeze(
      [...this.byUsageContext.values()].sort((left, right) => left.usageContext.localeCompare(right.usageContext)),
    );
  }

  public isAssetTypeAllowed(usageContext: string, assetType: TaxonomySemanticRole): boolean {
    const descriptor = this.get(usageContext);
    if (!descriptor) {
      return false;
    }
    return descriptor.allowedAssetTypes.includes(assetType);
  }

  public assertAllowed(usageContext: string, assetType: TaxonomySemanticRole): void {
    const descriptor = this.get(usageContext);
    if (!descriptor) {
      throw new Error(`Asset selector usage context '${usageContext}' is not registered.`);
    }
    if (!descriptor.allowedAssetTypes.includes(assetType)) {
      throw new Error(
        `Asset type '${assetType}' is not allowed for usage context '${usageContext}'. ` +
        `Allowed: ${descriptor.allowedAssetTypes.join(", ")}.`,
      );
    }
  }
}

export interface AssetSelectorApplicationValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<AssetSelectorValidationIssue>;
}

export class AssetSelectorApplicationValidationService {
  public constructor(
    private readonly capabilityRegistry: Pick<AssetSelectorCapabilityRegistry, "get" | "isAssetTypeAllowed">,
  ) {}

  public validateRequest(request: AssetSelectorRequest): AssetSelectorApplicationValidationResult {
    let normalizedRequest: AssetSelectorRequest;
    const issues: AssetSelectorValidationIssue[] = [];
    try {
      normalizedRequest = createAssetSelectorRequest(request);
    } catch (error) {
      return Object.freeze({
        valid: false,
        issues: Object.freeze([{
          code: AssetSelectorValidationIssueCodes.malformedReturnPayload,
          message: error instanceof Error ? error.message : "Asset selector request is malformed.",
          path: "request",
        }]),
      });
    }

    if (normalizedRequest.context.usageContext) {
      const capability = this.capabilityRegistry.get(normalizedRequest.context.usageContext);
      if (!capability) {
        issues.push({
          code: AssetSelectorValidationIssueCodes.invalidSelectionConstraint,
          message: `Asset selector usage context '${normalizedRequest.context.usageContext}' is not registered.`,
          path: "request.context.usageContext",
        });
      } else if (!this.capabilityRegistry.isAssetTypeAllowed(normalizedRequest.context.usageContext, normalizedRequest.assetType)) {
        issues.push({
          code: AssetSelectorValidationIssueCodes.invalidAssetType,
          message: `Asset type '${normalizedRequest.assetType}' is not allowed for usage context '${normalizedRequest.context.usageContext}'.`,
          path: "request.assetType",
        });
      }
    }

    return Object.freeze({
      valid: issues.length === 0,
      issues: Object.freeze(issues),
    });
  }

  public validateResult(input: {
    readonly request: AssetSelectorRequest;
    readonly result: AssetSelectorResult;
  }): AssetSelectorApplicationValidationResult {
    const requestValidation = this.validateRequest(input.request);
    const resultValidation = validateAssetSelectorResult({
      request: input.request,
      result: input.result,
    });

    const issues = [...requestValidation.issues, ...resultValidation.issues];
    return Object.freeze({
      valid: issues.length === 0,
      issues: Object.freeze(issues),
    });
  }

  public assertValidRequest(request: AssetSelectorRequest): AssetSelectorRequest {
    const normalizedRequest = createAssetSelectorRequest(request);
    const validation = this.validateRequest(normalizedRequest);
    if (!validation.valid) {
      const summary = validation.issues.map((issue) => issue.code).join(", ");
      throw new Error(`Asset selector request is invalid: ${summary}.`);
    }
    return normalizedRequest;
  }

  public assertValidResult(input: {
    readonly request: AssetSelectorRequest;
    readonly result: AssetSelectorResult;
  }): void {
    const validation = this.validateResult(input);
    if (!validation.valid) {
      const summary = validation.issues.map((issue) => issue.code).join(", ");
      throw new Error(`Asset selector result is invalid: ${summary}.`);
    }
  }
}

export function createDefaultAssetSelectorCapabilityRegistry(): AssetSelectorCapabilityRegistry {
  return new AssetSelectorCapabilityRegistry(defaultCapabilityDescriptors);
}
