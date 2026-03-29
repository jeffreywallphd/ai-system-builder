import { AssetId } from "../assets/AssetId";
import type { CompositionTaxonomyDescriptor, TaxonomySemanticRole } from "../taxonomy/CompositionTaxonomy";
import { TaxonomySemanticRoles } from "../taxonomy/CompositionTaxonomy";

export const AssetSelectorSelectionModes = Object.freeze({
  singleSelect: "single-select",
  multiSelect: "multi-select",
});

export type AssetSelectorSelectionMode = typeof AssetSelectorSelectionModes[keyof typeof AssetSelectorSelectionModes];

export const AssetSelectorSelectionTypes = Object.freeze({
  existingAsset: "existing-asset",
  createNewAsset: "create-new-asset",
});

export type AssetSelectorSelectionType = typeof AssetSelectorSelectionTypes[keyof typeof AssetSelectorSelectionTypes];

export const AssetSelectorResultKinds = Object.freeze({
  selected: "selected",
  cancelled: "cancelled",
});

export type AssetSelectorResultKind = typeof AssetSelectorResultKinds[keyof typeof AssetSelectorResultKinds];

export interface AssetSelectorContext {
  readonly originatingStudio: string;
  readonly originatingField: string;
  readonly launchSource?: "studio" | "wizard" | "canvas" | "handoff" | "unknown";
  readonly usageContext?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface AssetSelectorSelectionConstraints {
  readonly required?: boolean;
  readonly minSelections?: number;
  readonly maxSelections?: number;
}

export interface AssetSelectorRequest {
  readonly requestId: string;
  readonly assetType: TaxonomySemanticRole;
  readonly selectionMode: AssetSelectorSelectionMode;
  readonly allowedSelectionTypes: ReadonlyArray<AssetSelectorSelectionType>;
  readonly constraints: AssetSelectorSelectionConstraints;
  readonly context: AssetSelectorContext;
}

export interface AssetSelectorAssetReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly assetType: TaxonomySemanticRole;
  readonly displayName?: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
}

export interface AssetSelectorSelectedResult {
  readonly kind: typeof AssetSelectorResultKinds.selected;
  readonly selectionType: AssetSelectorSelectionType;
  readonly assets: ReadonlyArray<AssetSelectorAssetReference>;
}

export interface AssetSelectorCancelledResult {
  readonly kind: typeof AssetSelectorResultKinds.cancelled;
  readonly reason?: string;
}

export type AssetSelectorResult = AssetSelectorSelectedResult | AssetSelectorCancelledResult;

export const AssetSelectorValidationIssueCodes = Object.freeze({
  invalidAssetType: "invalid-asset-type",
  invalidSelectionMode: "invalid-selection-mode",
  invalidSelectionType: "invalid-selection-type",
  missingLaunchContext: "missing-launch-context",
  invalidSelectionConstraint: "invalid-selection-constraint",
  selectionLimitViolation: "selection-limit-violation",
  malformedReturnPayload: "malformed-return-payload",
  unsupportedSelectionType: "unsupported-selection-type",
  returnAssetTypeMismatch: "return-asset-type-mismatch",
  returnTaxonomyMismatch: "return-taxonomy-mismatch",
});

export type AssetSelectorValidationIssueCode =
  typeof AssetSelectorValidationIssueCodes[keyof typeof AssetSelectorValidationIssueCodes];

export interface AssetSelectorValidationIssue {
  readonly code: AssetSelectorValidationIssueCode;
  readonly message: string;
  readonly path?: string;
}

export interface AssetSelectorValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<AssetSelectorValidationIssue>;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function assertSupportedAssetType(value: string, label: string): TaxonomySemanticRole {
  const normalized = normalizeRequired(value, label);
  const supported = Object.values(TaxonomySemanticRoles);
  if (!supported.includes(normalized as TaxonomySemanticRole)) {
    throw new Error(`${label} '${normalized}' is not supported.`);
  }
  return normalized as TaxonomySemanticRole;
}

function normalizeSelectionMode(value: string): AssetSelectorSelectionMode {
  if (!Object.values(AssetSelectorSelectionModes).includes(value as AssetSelectorSelectionMode)) {
    throw new Error(`Asset selector selection mode '${value}' is not supported.`);
  }
  return value as AssetSelectorSelectionMode;
}

function normalizeSelectionType(value: string): AssetSelectorSelectionType {
  if (!Object.values(AssetSelectorSelectionTypes).includes(value as AssetSelectorSelectionType)) {
    throw new Error(`Asset selector selection type '${value}' is not supported.`);
  }
  return value as AssetSelectorSelectionType;
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

function normalizeContext(context: AssetSelectorContext): AssetSelectorContext {
  return Object.freeze({
    originatingStudio: normalizeRequired(context.originatingStudio, "Asset selector originating studio"),
    originatingField: normalizeRequired(context.originatingField, "Asset selector originating field"),
    launchSource: context.launchSource ?? "unknown",
    usageContext: normalizeOptional(context.usageContext),
    metadata: normalizeMetadata(context.metadata),
  });
}

function normalizeConstraints(input: AssetSelectorSelectionConstraints | undefined): AssetSelectorSelectionConstraints {
  const required = input?.required ?? false;
  const minSelections = input?.minSelections ?? (required ? 1 : 0);
  const maxSelections = input?.maxSelections;

  if (!Number.isInteger(minSelections) || minSelections < 0) {
    throw new Error("Asset selector minSelections must be a non-negative integer.");
  }
  if (maxSelections !== undefined && (!Number.isInteger(maxSelections) || maxSelections < 1)) {
    throw new Error("Asset selector maxSelections must be a positive integer when provided.");
  }
  if (maxSelections !== undefined && minSelections > maxSelections) {
    throw new Error("Asset selector minSelections cannot exceed maxSelections.");
  }

  return Object.freeze({
    required,
    minSelections,
    maxSelections,
  });
}

function normalizeAllowedSelectionTypes(
  selectionTypes: ReadonlyArray<AssetSelectorSelectionType> | undefined,
): ReadonlyArray<AssetSelectorSelectionType> {
  const source = selectionTypes ?? [AssetSelectorSelectionTypes.existingAsset];
  const deduped = new Set<AssetSelectorSelectionType>();
  for (const entry of source) {
    deduped.add(normalizeSelectionType(entry));
  }
  if (deduped.size === 0) {
    throw new Error("Asset selector request must allow at least one selection type.");
  }

  return Object.freeze([...deduped.values()]);
}

function normalizeAssetReference(reference: AssetSelectorAssetReference): AssetSelectorAssetReference {
  const assetId = AssetId.from(reference.assetId).value;
  const assetType = assertSupportedAssetType(reference.assetType, "Asset selector result assetType");
  const versionId = normalizeOptional(reference.versionId);
  const displayName = normalizeOptional(reference.displayName);
  if (
    reference.taxonomy
    && reference.taxonomy.semanticRole !== assetType
  ) {
    throw new Error(
      `Asset selector result taxonomy semantic role '${reference.taxonomy.semanticRole}' does not match assetType '${assetType}'.`,
    );
  }

  return Object.freeze({
    assetId,
    versionId,
    assetType,
    displayName,
    taxonomy: reference.taxonomy,
  });
}

export function createAssetSelectorRequest(request: AssetSelectorRequest): AssetSelectorRequest {
  const normalized = Object.freeze({
    requestId: normalizeRequired(request.requestId, "Asset selector request id"),
    assetType: assertSupportedAssetType(request.assetType, "Asset selector assetType"),
    selectionMode: normalizeSelectionMode(request.selectionMode),
    allowedSelectionTypes: normalizeAllowedSelectionTypes(request.allowedSelectionTypes),
    constraints: normalizeConstraints(request.constraints),
    context: normalizeContext(request.context),
  });

  if (
    normalized.selectionMode === AssetSelectorSelectionModes.singleSelect
    && (normalized.constraints.maxSelections ?? 1) > 1
  ) {
    throw new Error("Single-select requests cannot allow more than one selection.");
  }
  if (
    normalized.selectionMode === AssetSelectorSelectionModes.singleSelect
    && normalized.constraints.minSelections > 1
  ) {
    throw new Error("Single-select requests cannot require more than one selection.");
  }

  return normalized;
}

function validateCancelledResult(result: AssetSelectorCancelledResult): ReadonlyArray<AssetSelectorValidationIssue> {
  if ("assets" in (result as Record<string, unknown>) || "selectionType" in (result as Record<string, unknown>)) {
    return Object.freeze([{
      code: AssetSelectorValidationIssueCodes.malformedReturnPayload,
      message: "Cancelled asset selector result cannot include selected assets or selection type.",
      path: "result",
    }]);
  }
  return Object.freeze([]);
}

export function validateAssetSelectorResult(input: {
  readonly request: AssetSelectorRequest;
  readonly result: AssetSelectorResult;
}): AssetSelectorValidationResult {
  const issues: AssetSelectorValidationIssue[] = [];
  let request: AssetSelectorRequest;
  try {
    request = createAssetSelectorRequest(input.request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asset selector request is malformed.";
    return Object.freeze({
      valid: false,
      issues: Object.freeze([{
        code: AssetSelectorValidationIssueCodes.malformedReturnPayload,
        message,
        path: "request",
      }]),
    });
  }

  if (input.result.kind === AssetSelectorResultKinds.cancelled) {
    issues.push(...validateCancelledResult(input.result));
    return Object.freeze({
      valid: issues.length === 0,
      issues: Object.freeze(issues),
    });
  }

  if (!input.result.selectionType) {
    issues.push({
      code: AssetSelectorValidationIssueCodes.malformedReturnPayload,
      message: "Selected asset selector result must include selectionType.",
      path: "result.selectionType",
    });
  }

  if (!request.allowedSelectionTypes.includes(input.result.selectionType)) {
    issues.push({
      code: AssetSelectorValidationIssueCodes.unsupportedSelectionType,
      message: `Selection type '${input.result.selectionType}' is not allowed by this request.`,
      path: "result.selectionType",
    });
  }

  const resultAssets = input.result.assets ?? [];
  if (!Array.isArray(resultAssets) || resultAssets.length === 0) {
    issues.push({
      code: AssetSelectorValidationIssueCodes.malformedReturnPayload,
      message: "Selected asset selector result must include at least one asset.",
      path: "result.assets",
    });
  }

  const selectionCount = resultAssets.length;
  const minSelections = request.constraints.minSelections;
  const maxSelections = request.constraints.maxSelections
    ?? (request.selectionMode === AssetSelectorSelectionModes.singleSelect ? 1 : Number.POSITIVE_INFINITY);
  if (selectionCount < minSelections || selectionCount > maxSelections) {
    issues.push({
      code: AssetSelectorValidationIssueCodes.selectionLimitViolation,
      message: `Selected asset count '${selectionCount}' violates allowed range '${minSelections}..${maxSelections}'.`,
      path: "result.assets",
    });
  }

  for (let index = 0; index < resultAssets.length; index += 1) {
    const reference = resultAssets[index];
    try {
      const normalized = normalizeAssetReference(reference);
      if (normalized.assetType !== request.assetType) {
        issues.push({
          code: AssetSelectorValidationIssueCodes.returnAssetTypeMismatch,
          message: `Result asset type '${normalized.assetType}' does not match requested asset type '${request.assetType}'.`,
          path: `result.assets[${index}].assetType`,
        });
      }
      if (normalized.taxonomy && normalized.taxonomy.semanticRole !== request.assetType) {
        issues.push({
          code: AssetSelectorValidationIssueCodes.returnTaxonomyMismatch,
          message: `Result asset taxonomy semantic role '${normalized.taxonomy.semanticRole}' does not match requested asset type '${request.assetType}'.`,
          path: `result.assets[${index}].taxonomy.semanticRole`,
        });
      }
    } catch (error) {
      issues.push({
        code: AssetSelectorValidationIssueCodes.malformedReturnPayload,
        message: error instanceof Error ? error.message : "Result asset reference is malformed.",
        path: `result.assets[${index}]`,
      });
    }
  }

  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues),
  });
}

export function createAssetSelectorResult(input: {
  readonly request: AssetSelectorRequest;
  readonly result: AssetSelectorResult;
}): AssetSelectorResult {
  const validation = validateAssetSelectorResult(input);
  if (!validation.valid) {
    const summary = validation.issues.map((issue) => issue.code).join(", ");
    throw new Error(`Asset selector result is invalid: ${summary}.`);
  }

  if (input.result.kind === AssetSelectorResultKinds.cancelled) {
    return Object.freeze({
      kind: AssetSelectorResultKinds.cancelled,
      reason: normalizeOptional(input.result.reason),
    });
  }

  return Object.freeze({
    kind: AssetSelectorResultKinds.selected,
    selectionType: normalizeSelectionType(input.result.selectionType),
    assets: Object.freeze(input.result.assets.map((entry) => normalizeAssetReference(entry))),
  });
}
