import type { AssetContractDescriptor } from "../../domain/contracts/AssetContract";
import type {
  MultiAssetStudioHandoffContract,
  StudioHandoffContract,
  TargetStudioInputContract,
} from "../../domain/studio-handoff/StudioHandoffContract";
import type { CompositionTaxonomyDescriptor } from "../../domain/taxonomy/CompositionTaxonomy";
import { listStudioHandoffPrefillKeys } from "../../domain/studio-handoff/StudioHandoffContext";

export const StudioHandoffCompatibilityIssueCodes = Object.freeze({
  targetStudioUnsupported: "target-studio-unsupported",
  sourceTargetSameStudio: "source-target-same-studio",
  targetInputContractMissing: "target-input-contract-missing",
  taxonomyIncompatible: "taxonomy-incompatible",
  contractIncompatible: "contract-incompatible",
  versionReferenceInvalid: "version-reference-invalid",
  contextKeyNotAllowed: "context-key-not-allowed",
  bundleAssetMissing: "bundle-asset-missing",
  bundleAssetIncompatible: "bundle-asset-incompatible",
});

export type StudioHandoffCompatibilityIssueCode =
  typeof StudioHandoffCompatibilityIssueCodes[keyof typeof StudioHandoffCompatibilityIssueCodes];

export interface StudioHandoffCompatibilityIssue {
  readonly code: StudioHandoffCompatibilityIssueCode;
  readonly message: string;
  readonly path?: string;
}

export interface StudioHandoffCompatibilityDecision {
  readonly compatible: boolean;
  readonly targetStudioType: string;
  readonly matchedContractId?: string;
  readonly multiAsset?: MultiAssetCompatibilityDecision;
  readonly issues: ReadonlyArray<StudioHandoffCompatibilityIssue>;
}

export interface MultiAssetCompatibilityDecision {
  readonly grouped: true;
  readonly requireAllAssets: boolean;
  readonly compatible: boolean;
  readonly entries: ReadonlyArray<{
    readonly role: string;
    readonly ordinal: number;
    readonly assetId: string;
    readonly versionId: string;
    readonly compatible: boolean;
    readonly issues: ReadonlyArray<StudioHandoffCompatibilityIssue>;
  }>;
}

export interface StudioCapabilityDescriptor {
  readonly studioType: string;
  readonly displayName?: string;
  readonly acceptedInputs: ReadonlyArray<TargetStudioInputContract>;
}

function isTaxonomyAccepted(
  taxonomy: CompositionTaxonomyDescriptor,
  contract: TargetStudioInputContract,
): boolean {
  if (contract.acceptedStructuralKinds && !contract.acceptedStructuralKinds.includes(taxonomy.structuralKind)) {
    return false;
  }
  if (contract.acceptedSemanticRoles && !contract.acceptedSemanticRoles.includes(taxonomy.semanticRole)) {
    return false;
  }
  if (contract.acceptedBehaviorKinds && !contract.acceptedBehaviorKinds.includes(taxonomy.behaviorKind)) {
    return false;
  }
  return true;
}

function isExpectedParameterCompatible(input: {
  readonly expected: AssetContractDescriptor["parameters"][number];
  readonly actual: AssetContractDescriptor["parameters"][number] | undefined;
}): boolean {
  if (!input.actual) {
    return false;
  }
  if (input.actual.required !== input.expected.required) {
    return false;
  }
  if (input.expected.valueType && input.actual.valueType !== input.expected.valueType) {
    return false;
  }
  return true;
}

function isContractCompatible(
  expected: AssetContractDescriptor,
  actual: AssetContractDescriptor | undefined,
): boolean {
  if (!actual) {
    return false;
  }

  if (expected.input.kind !== actual.input.kind) {
    return false;
  }
  if (expected.output.kind !== actual.output.kind) {
    return false;
  }

  for (const parameter of expected.parameters) {
    const candidate = actual.parameters.find((entry) => entry.id === parameter.id);
    if (!isExpectedParameterCompatible({ expected: parameter, actual: candidate })) {
      return false;
    }
  }

  return true;
}

export class StudioHandoffCompatibilityValidator {
  public constructor(
    private readonly options: {
      readonly validateVersionReference?: (reference: { readonly assetId: string; readonly versionId: string }) => boolean;
    } = {},
  ) {}

  private validateSingleAssetAgainstContract(input: {
    readonly contract: TargetStudioInputContract;
    readonly taxonomy: CompositionTaxonomyDescriptor;
    readonly actualContract?: AssetContractDescriptor;
    readonly assetId: string;
    readonly versionId: string;
    readonly allowedContextKeys?: ReadonlyArray<string>;
    readonly contextPathPrefix?: string;
    readonly sourcePathPrefix?: string;
  }): ReadonlyArray<StudioHandoffCompatibilityIssue> {
    const issues: StudioHandoffCompatibilityIssue[] = [];

    if (!isTaxonomyAccepted(input.taxonomy, input.contract)) {
      issues.push(Object.freeze({
        code: StudioHandoffCompatibilityIssueCodes.taxonomyIncompatible,
        message: `Handoff taxonomy '${input.taxonomy.structuralKind}/${input.taxonomy.semanticRole}/${input.taxonomy.behaviorKind}' is not accepted by target studio contract '${input.contract.contractId}'.`,
        path: input.sourcePathPrefix ? `${input.sourcePathPrefix}.taxonomy` : "payload.taxonomy",
      }));
    }

    if (input.contract.expectedContract && !isContractCompatible(input.contract.expectedContract, input.actualContract)) {
      issues.push(Object.freeze({
        code: StudioHandoffCompatibilityIssueCodes.contractIncompatible,
        message: `Handoff asset contract is incompatible with target studio input contract '${input.contract.contractId}'.`,
        path: input.sourcePathPrefix ? `${input.sourcePathPrefix}.contract` : "payload.contract",
      }));
    }

    if (input.contract.requireVersionedAsset ?? true) {
      const referenceIsValid = this.options.validateVersionReference
        ? this.options.validateVersionReference({
          assetId: input.assetId,
          versionId: input.versionId,
        })
        : input.versionId.trim().length > 0;

      if (!referenceIsValid) {
        issues.push(Object.freeze({
          code: StudioHandoffCompatibilityIssueCodes.versionReferenceInvalid,
          message: `Asset '${input.assetId}' version reference '${input.versionId}' is invalid for handoff.`,
          path: input.sourcePathPrefix ? `${input.sourcePathPrefix}.versionId` : "payload.versionId",
        }));
      }
    }

    if (input.contract.allowedContextKeys && input.allowedContextKeys) {
      const allowed = new Set(input.contract.allowedContextKeys);
      for (const key of input.allowedContextKeys) {
        if (!allowed.has(key)) {
          issues.push(Object.freeze({
            code: StudioHandoffCompatibilityIssueCodes.contextKeyNotAllowed,
            message: `Handoff context key '${key}' is not accepted by target input contract '${input.contract.contractId}'.`,
            path: input.contextPathPrefix ? `${input.contextPathPrefix}.${key}` : `context.config.${key}`,
          }));
        }
      }
    }

    return Object.freeze(issues);
  }

  private validateMultiAssetBundle(input: {
    readonly bundle: MultiAssetStudioHandoffContract;
    readonly contract: TargetStudioInputContract;
    readonly contextKeys: ReadonlyArray<string>;
  }): MultiAssetCompatibilityDecision {
    const entries = input.bundle.assets.map((entry, index) => {
      const assetIssues = this.validateSingleAssetAgainstContract({
        contract: input.contract,
        taxonomy: entry.taxonomy,
        actualContract: entry.contract,
        assetId: entry.assetId,
        versionId: entry.versionId,
        allowedContextKeys: input.contextKeys,
        contextPathPrefix: "context.config",
        sourcePathPrefix: `multiAsset.assets[${index}]`,
      });
      return Object.freeze({
        role: entry.role,
        ordinal: entry.ordinal ?? index,
        assetId: entry.assetId,
        versionId: entry.versionId,
        compatible: assetIssues.length === 0,
        issues: assetIssues,
      });
    });

    const bundleIssues: StudioHandoffCompatibilityIssue[] = [];
    if (entries.length === 0) {
      bundleIssues.push(Object.freeze({
        code: StudioHandoffCompatibilityIssueCodes.bundleAssetMissing,
        message: "Grouped multi-asset handoff requires at least one asset entry.",
        path: "multiAsset.assets",
      }));
    }
    for (const entry of entries) {
      if (!entry.compatible) {
        bundleIssues.push(Object.freeze({
          code: StudioHandoffCompatibilityIssueCodes.bundleAssetIncompatible,
          message: `Bundled handoff asset '${entry.assetId}' is incompatible with the target studio input contract.`,
          path: `multiAsset.assets[${entry.ordinal}]`,
        }));
      }
    }

    return Object.freeze({
      grouped: true,
      requireAllAssets: input.bundle.requireAllAssets,
      compatible: bundleIssues.length === 0,
      entries: Object.freeze(entries),
    });
  }

  public validate(input: {
    readonly handoff: StudioHandoffContract;
    readonly targetCapabilities: ReadonlyArray<StudioCapabilityDescriptor>;
  }): StudioHandoffCompatibilityDecision {
    const issues: StudioHandoffCompatibilityIssue[] = [];

    if (
      input.handoff.source.studioId === input.handoff.target.studioId
      && input.handoff.source.studioType === input.handoff.target.studioType
    ) {
      issues.push(Object.freeze({
        code: StudioHandoffCompatibilityIssueCodes.sourceTargetSameStudio,
        message: "Source and target studio must be distinct for a studio-to-studio handoff.",
        path: "source",
      }));
    }

    const targetCapability = input.targetCapabilities.find((entry) => entry.studioType === input.handoff.target.studioType);
    if (!targetCapability) {
      issues.push(Object.freeze({
        code: StudioHandoffCompatibilityIssueCodes.targetStudioUnsupported,
        message: `Target studio type '${input.handoff.target.studioType}' has no registered handoff capability descriptor.`,
        path: "target.studioType",
      }));
      return Object.freeze({
        compatible: false,
        targetStudioType: input.handoff.target.studioType,
        issues: Object.freeze(issues),
      });
    }

    const requestedContractId = input.handoff.payload.targetInputContract.contractId;
    const acceptedContract = targetCapability.acceptedInputs.find((entry) => entry.contractId === requestedContractId);
    if (!acceptedContract) {
      issues.push(Object.freeze({
        code: StudioHandoffCompatibilityIssueCodes.targetInputContractMissing,
        message: `Target studio '${targetCapability.studioType}' does not expose input contract '${requestedContractId}'.`,
        path: "payload.targetInputContract.contractId",
      }));
    }

    const contractForValidation = acceptedContract ?? input.handoff.payload.targetInputContract;
    const contextKeys = listStudioHandoffPrefillKeys(input.handoff.context);
    issues.push(
      ...this.validateSingleAssetAgainstContract({
        contract: contractForValidation,
        taxonomy: input.handoff.payload.taxonomy,
        actualContract: input.handoff.payload.contract,
        assetId: input.handoff.payload.assetId,
        versionId: input.handoff.payload.versionId,
        allowedContextKeys: contextKeys,
      }),
    );

    const multiAssetDecision = input.handoff.multiAsset
      ? this.validateMultiAssetBundle({
        bundle: input.handoff.multiAsset,
        contract: contractForValidation,
        contextKeys,
      })
      : undefined;
    if (multiAssetDecision && !multiAssetDecision.compatible) {
      issues.push(...multiAssetDecision.entries.flatMap((entry) => entry.issues));
      issues.push(...multiAssetDecision.entries
        .filter((entry) => !entry.compatible)
        .map((entry) => Object.freeze({
          code: StudioHandoffCompatibilityIssueCodes.bundleAssetIncompatible,
          message: `Bundled handoff asset '${entry.assetId}' is incompatible with target contract '${contractForValidation.contractId}'.`,
          path: `multiAsset.assets[${entry.ordinal}]`,
        })));
    }

    return Object.freeze({
      compatible: issues.length === 0,
      targetStudioType: input.handoff.target.studioType,
      matchedContractId: acceptedContract?.contractId,
      multiAsset: multiAssetDecision,
      issues: Object.freeze(issues),
    });
  }
}
